"""Página del asistente (módulo `agente`): preguntar, ver una conversación y calificar una respuesta.

Cada pregunta pasa por `agent.host.ask`; aquí solo se traducen sus errores a códigos HTTP. Sin lógica de negocio.
Staff además elige el proveedor y la clave de cada organización; la clave nunca vuelve en una respuesta.
"""
import json
import os
import queue
import threading
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, StringConstraints
from typing_extensions import TypedDict

from agent import host, providers, tools
from auth import conversations, orgs

from .. import session

router = APIRouter(prefix="/agente", dependencies=[Depends(session.require_module("agente"))])

Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
User = Annotated[dict, Depends(session.current_user)]
Staff = Annotated[dict, Depends(session.require_staff)]


class Ask(BaseModel):
    question: Question
    conversation_id: int | None = None


class ToolUse(TypedDict):
    name: str
    arguments: dict | None
    rows: int | None
    ms: int
    sources: list[dict[str, str]]


class Answer(TypedDict):
    conversation_id: int
    message_id: int
    answer: str
    tools: list[ToolUse]


class Message(TypedDict):
    id: int
    role: str
    content: str


class Thumb(BaseModel):
    useful: bool


class ProviderIn(BaseModel):
    provider: str | None = None
    api_key: Annotated[str, StringConstraints(min_length=1, max_length=500)] | None = None


class OrgProvider(TypedDict):
    id: int
    name: str
    provider: str | None


def _failure(error):
    """(estado HTTP, texto para el usuario) de un error de `host.ask`."""
    if isinstance(error, tools.AccessDenied):
        return 403, str(error)
    if isinstance(error, host.OverLimit):
        return 429, str(error)
    return 502, str(error)


@router.post("/preguntar")
def ask(body: Ask, user: User) -> Answer:
    try:
        return session.with_conn(lambda conn: host.ask(conn, user, body.question, body.conversation_id))
    except (tools.AccessDenied, host.AgentError) as e:
        raise HTTPException(*_failure(e)) from None


@router.post("/preguntar/flujo")
def ask_stream(body: Ask, user: User):
    """Lo mismo que `/preguntar`, en líneas JSON: `step` por cada paso, y al final `answer` o `error`."""
    try:
        tools.require_access(user)
    except tools.AccessDenied as e:
        raise HTTPException(*_failure(e)) from None
    events = queue.Queue()

    def work():
        try:
            answer = session.with_conn(lambda conn: host.ask(
                conn, user, body.question, body.conversation_id,
                on_step=lambda step, **detail: events.put({"event": "step", "step": step, **detail})))
            events.put({"event": "answer", **answer})
        except (tools.AccessDenied, host.AgentError) as e:
            status, detail = _failure(e)
            events.put({"event": "error", "status": status, "detail": detail})
        finally:
            events.put(None)

    threading.Thread(target=work, daemon=True).start()

    def lines():
        while (event := events.get()) is not None:
            yield json.dumps(event, ensure_ascii=False) + "\n"

    return StreamingResponse(lines(), media_type="application/x-ndjson")


@router.get("/conversaciones/{conversation_id}")
def conversation(conversation_id: int, user: User) -> list[Message]:
    try:
        tools.require_access(user)
    except tools.AccessDenied as e:
        raise HTTPException(403, str(e)) from None
    found = session.with_conn(lambda conn: conversations.history(conn, user["id"], conversation_id))
    return [{"id": m["id"], "role": m["role"], "content": m["content"]} for m in found]


@router.post("/mensajes/{message_id}/pulgar", status_code=204)
def thumb(message_id: int, body: Thumb, user: User):
    if not session.with_conn(lambda conn: conversations.set_feedback(conn, user["id"], message_id, body.useful)):
        raise HTTPException(404)


@router.get("/proveedores")
def providers_status(_: Staff) -> list[OrgProvider]:
    return session.with_conn(orgs.agent_status)


@router.put("/proveedores/{org_id}", status_code=204)
def set_provider(org_id: int, body: ProviderIn, staff: Staff):
    if body.provider == providers.DEV and os.environ.get("AC_ENV") == "prod":
        raise HTTPException(422, f"{providers.DEV} no está disponible en prod")
    if body.provider in providers.KEYLESS:
        # Marcador: la clave real no se guarda (sale del entorno o del rol IAM), pero la organización necesita una fila.
        body.api_key = body.provider
    if body.api_key and body.provider not in providers.CHAT:
        raise HTTPException(422, f"proveedores: {', '.join(providers.CHAT)}")
    if not session.with_conn(lambda conn: orgs.set_agent_provider(conn, org_id, body.provider, body.api_key, actor_id=staff["id"],
                                                           secret=body.provider not in providers.KEYLESS)):
        raise HTTPException(404)
