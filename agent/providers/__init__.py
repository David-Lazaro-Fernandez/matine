"""Proveedores de modelo. Cada uno es una función `chat(api_key, messages, tools)` con la misma respuesta; `CHAT` las
indexa por el nombre que guarda `organization.agent_provider`.

Respuesta: `{"message": dict para devolver al modelo, "content": texto o None, "tool_calls": [{id, name, arguments}],
"tokens_in", "tokens_out"}`. `arguments` es un dict, o None si el modelo mandó un JSON inválido.
"""
from . import deepseek

CHAT = {"deepseek": deepseek.chat}
