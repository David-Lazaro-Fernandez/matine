"""El ciclo del agente: pregunta, modelo, herramientas, respuesta.

`ask` guarda la pregunta, deja que el modelo llame herramientas del servidor MCP de la cuenta (cliente en memoria) hasta
`config.AGENT_MAX_STEPS` vueltas y guarda la respuesta. Una falla no inventa respuesta: se audita, se devuelve el
motivo y la pregunta queda sin respuesta guardada. Cada pregunta deja su renglón de auditoría.
"""
import asyncio
import json
import time
from datetime import datetime, timedelta, timezone

from fastmcp import Client

from analytics.labels import AGENT_TEXT
from auth import conversations, orgs
from scraper import config

from . import providers, server, tools


class AgentError(Exception):
    """El agente no pudo responder; el mensaje es para el usuario."""


class OverLimit(AgentError):
    """La cuenta o su organización llegó a su tope de uso."""


def _check_limits(app, user):
    now = datetime.now(timezone.utc)
    if conversations.questions_since(app, user["id"], now - timedelta(hours=1)) >= config.AGENT_QUESTIONS_PER_HOUR:
        raise OverLimit(AGENT_TEXT["user_limit"])
    if conversations.tokens_since(app, user["org_id"], now - timedelta(days=1)) >= config.AGENT_ORG_TOKENS_PER_DAY:
        raise OverLimit(AGENT_TEXT["org_limit"])


def _tool_specs(listed):
    return [{"type": "function", "function": {"name": t.name, "description": t.description or "",
                                              "parameters": t.inputSchema}} for t in listed]


async def _call_tool(client, call):
    started = time.monotonic()
    if call["arguments"] is None:
        data, rows = {"error": AGENT_TEXT["bad_arguments"]}, None
    else:
        result = await client.call_tool(call["name"], call["arguments"], raise_on_error=False)
        data = result.data if not result.is_error else {"error": AGENT_TEXT["tool_failed"]}
        rows = data.get("row_count") if isinstance(data, dict) else None
    summary = {"name": call["name"], "arguments": call["arguments"], "rows": rows,
               "ms": round(1000 * (time.monotonic() - started))}
    return json.dumps(data, ensure_ascii=False, default=str), summary


async def _converse(user, chat, api_key, messages):
    used, tokens_in, tokens_out = [], 0, 0
    async with Client(server.build(user)) as client:
        specs = _tool_specs(await client.list_tools())
        for _ in range(config.AGENT_MAX_STEPS):
            reply = await asyncio.to_thread(chat, api_key, messages, specs)
            tokens_in += reply["tokens_in"]
            tokens_out += reply["tokens_out"]
            if not reply["tool_calls"]:
                return reply["content"], used, tokens_in, tokens_out
            messages.append(reply["message"])
            for call in reply["tool_calls"]:
                content, summary = await _call_tool(client, call)
                used.append(summary)
                messages.append({"role": "tool", "tool_call_id": call["id"], "content": content})
    raise AgentError(AGENT_TEXT["too_many_steps"])


def _open_conversation(app, user, conversation_id):
    if conversation_id is None:
        return conversations.start(app, user["id"]), []
    if not conversations.owns(app, user["id"], conversation_id):
        raise AgentError(AGENT_TEXT["unknown_conversation"])
    past = conversations.history(app, user["id"], conversation_id)
    return conversation_id, [{"role": m["role"], "content": m["content"]} for m in past]


def ask(app, user, question, conversation_id=None):
    """Responde `question` de la cuenta `user`. Devuelve `conversation_id`, `message_id`, `answer` y `tools`.
    Levanta `tools.AccessDenied` sin acceso y `AgentError` si no hay respuesta."""
    tools.require_access(user)
    _check_limits(app, user)
    started = time.monotonic()
    audit = {"provider": None, "tools": [], "tokens_in": None, "tokens_out": None}
    error = None
    try:
        configured = orgs.agent_provider(app, user["org_id"])
        if not configured:
            raise AgentError(AGENT_TEXT["no_provider"])
        audit["provider"], api_key = configured
        conversation_id, past = _open_conversation(app, user, conversation_id)
        conversations.add_message(app, conversation_id, "user", question)
        messages = [{"role": "system", "content": server.INSTRUCTIONS}, *past, {"role": "user", "content": question}]
        answer, audit["tools"], audit["tokens_in"], audit["tokens_out"] = asyncio.run(
            _converse(user, providers.CHAT[audit["provider"]], api_key, messages))
        if not answer:
            raise AgentError(AGENT_TEXT["empty_answer"])
        message_id = conversations.add_message(app, conversation_id, "assistant", answer)
    except AgentError as e:
        error = str(e)
        raise
    except Exception as e:
        error = f"{type(e).__name__}: {e}"
        raise AgentError(AGENT_TEXT["provider_failed"]) from e
    finally:
        conversations.audit(app, user, tools.environment(), conversation_id=conversation_id,
                            latency_ms=round(1000 * (time.monotonic() - started)), error=error, **audit)
    return {"conversation_id": conversation_id, "message_id": message_id, "answer": answer, "tools": audit["tools"]}
