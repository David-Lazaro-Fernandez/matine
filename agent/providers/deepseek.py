"""DeepSeek por su API compatible con OpenAI (`POST /chat/completions`, verificado 2026-10-14).

Sin modo de razonamiento por defecto (`config.AGENT_THINKING`): así el historial no lleva `reasoning_content`.
"""
import json

from scraper import config, http


def chat(api_key, messages, tools, temperature=None):
    """Una vuelta del modelo. `tools`: lista en el formato `{"type": "function", "function": {...}}`. `temperature=0`
    para los revisores, que deben dar siempre el mismo veredicto."""
    body = {"model": config.AGENT_MODEL, "messages": messages, "thinking": {"type": config.AGENT_THINKING}}
    if temperature is not None:
        body["temperature"] = temperature
    if tools:
        body["tools"] = tools
    reply = http.request_json(f"{config.AGENT_BASE_URL}/chat/completions", method="POST", body=body,
                              headers={"Authorization": f"Bearer {api_key}"})
    message = reply["choices"][0]["message"]
    return {"message": message, "content": message.get("content"),
            "tool_calls": [_call(c) for c in message.get("tool_calls") or []],
            "tokens_in": reply["usage"]["prompt_tokens"], "tokens_out": reply["usage"]["completion_tokens"]}


def _call(raw):
    # El modelo puede mandar un JSON inválido o argumentos que no son un objeto.
    try:
        arguments = json.loads(raw["function"]["arguments"] or "{}")
    except json.JSONDecodeError:
        arguments = None
    return {"id": raw["id"], "name": raw["function"]["name"],
            "arguments": arguments if isinstance(arguments, dict) else None}
