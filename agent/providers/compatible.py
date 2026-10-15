"""Proveedores con API compatible con OpenAI (`POST /chat/completions`): ChatGPT, Claude, Mistral y Gemini.

`make_chat(name)` arma la función `chat` del proveedor con la dirección y el modelo de `config.AGENT_COMPATIBLE`.
"""
import json

from scraper import config, http


def make_chat(name):
    """`chat(api_key, messages, tools, temperature=None)` del proveedor `name`; ver `agent.providers`."""
    settings = config.AGENT_COMPATIBLE[name]

    def chat(api_key, messages, tools, temperature=None):
        body = {"model": settings["model"], "messages": messages}
        if temperature is not None:
            body["temperature"] = temperature
        if tools:
            body["tools"] = tools
        reply = http.request_json(f"{settings['base_url']}/chat/completions", method="POST", body=body,
                                  headers={"Authorization": f"Bearer {api_key}"})
        message = reply["choices"][0]["message"]
        return {"message": message, "content": message.get("content"),
                "tool_calls": [_call(c) for c in message.get("tool_calls") or []],
                "tokens_in": reply["usage"]["prompt_tokens"], "tokens_out": reply["usage"]["completion_tokens"]}

    return chat


def _call(raw):
    # El modelo puede mandar un JSON inválido o argumentos que no son un objeto.
    try:
        arguments = json.loads(raw["function"]["arguments"] or "{}")
    except json.JSONDecodeError:
        arguments = None
    return {"id": raw["id"], "name": raw["function"]["name"],
            "arguments": arguments if isinstance(arguments, dict) else None}
