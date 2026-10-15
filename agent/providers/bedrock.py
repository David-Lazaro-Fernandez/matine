"""Amazon Bedrock por la API Converse: los modelos corren dentro de AWS y se autentican con el rol IAM de la instancia,
así que no hay clave de proveedor que guardar.

El agente guarda el historial con el formato de OpenAI. Converse usa bloques (`text`, `toolUse`, `toolResult`) y exige
roles alternados: aquí se traduce en cada llamada, y la respuesta vuelve en el formato de OpenAI.
Hace falta `AC_AGENT_BEDROCK_MODEL` (id del modelo o del perfil de inferencia) y el permiso `bedrock:InvokeModel`.
"""
import json
from functools import lru_cache

from scraper import config


@lru_cache(maxsize=1)
def _client():
    import boto3

    return boto3.client("bedrock-runtime", region_name=config.AGENT_BEDROCK_REGION)


def _blocks(message):
    """Los bloques de Converse de un mensaje del historial."""
    role = message["role"]
    if role == "tool":
        return "user", [{"toolResult": {"toolUseId": message["tool_call_id"], "content": [{"text": message["content"] or " "}]}}]
    blocks = [{"text": message["content"]}] if message.get("content") else []
    for call in message.get("tool_calls") or []:
        blocks.append({"toolUse": {"toolUseId": call["id"], "name": call["function"]["name"],
                                   "input": json.loads(call["function"]["arguments"] or "{}")}})
    return role, blocks


def _conversation(messages):
    """(textos de sistema, mensajes de Converse). Los mensajes seguidos del mismo rol se juntan: los resultados de varias
    herramientas viajan en un solo mensaje de usuario."""
    system, conversation = [], []
    for message in messages:
        if message["role"] == "system":
            system.append({"text": message["content"]})
            continue
        role, blocks = _blocks(message)
        if conversation and conversation[-1]["role"] == role:
            conversation[-1]["content"].extend(blocks)
        else:
            conversation.append({"role": role, "content": blocks})
    return system, conversation


def _tool_config(tools):
    return {"tools": [{"toolSpec": {"name": t["function"]["name"], "description": t["function"].get("description", ""),
                                    "inputSchema": {"json": t["function"]["parameters"]}}} for t in tools]}


def chat(_stored_key, messages, tools, temperature=None):
    """Una vuelta del modelo; ver `agent.providers`. `temperature=0` para los revisores."""
    if not config.AGENT_BEDROCK_MODEL:
        raise ValueError("Falta AC_AGENT_BEDROCK_MODEL: el id del modelo de Bedrock.")
    system, conversation = _conversation(messages)
    request = {"modelId": config.AGENT_BEDROCK_MODEL, "messages": conversation}
    if system:
        request["system"] = system
    if tools:
        request["toolConfig"] = _tool_config(tools)
    if temperature is not None:
        request["inferenceConfig"] = {"temperature": temperature}
    reply = _client().converse(**request)
    blocks = reply["output"]["message"]["content"]
    text = "".join(b["text"] for b in blocks if "text" in b) or None
    calls = [b["toolUse"] for b in blocks if "toolUse" in b]
    message = {"role": "assistant", "content": text}
    if calls:
        message["tool_calls"] = [{"id": c["toolUseId"], "type": "function",
                                  "function": {"name": c["name"], "arguments": json.dumps(c["input"], ensure_ascii=False)}}
                                 for c in calls]
    return {"message": message, "content": text,
            "tool_calls": [{"id": c["toolUseId"], "name": c["name"],
                            "arguments": c["input"] if isinstance(c["input"], dict) else None} for c in calls],
            "tokens_in": reply["usage"]["inputTokens"], "tokens_out": reply["usage"]["outputTokens"]}
