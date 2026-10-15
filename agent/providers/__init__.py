"""Proveedores de modelo. Cada uno es una función `chat(api_key, messages, tools, temperature=None)` con la misma respuesta; `CHAT` las
indexa por el nombre que guarda `organization.agent_provider`.

Respuesta: `{"message": dict para devolver al modelo, "content": texto o None, "tool_calls": [{id, name, arguments}],
"tokens_in", "tokens_out"}`. `arguments` es un dict, o None si el modelo mandó un JSON inválido.
"""
import os

from scraper import config

from . import bedrock, compatible, deepseek

DEV = "deepseek-dev"
# Proveedores sin clave guardada: `deepseek-dev` lee la del entorno del servidor y `bedrock` usa el rol IAM.
KEYLESS = (DEV, "bedrock")


def _deepseek_dev(_stored_key, messages, tools, temperature=None):
    # La clave del desarrollador vive en el entorno del servidor, nunca en `app.db`.
    key = os.environ.get(config.DEV_KEY_ENV)
    if os.environ.get("AC_ENV") == "prod" or not key:
        raise ValueError(f"{DEV} solo funciona fuera de prod y con {config.DEV_KEY_ENV} en el entorno.")
    return deepseek.chat(key, messages, tools, temperature)


CHAT = {"bedrock": bedrock.chat, "deepseek": deepseek.chat, DEV: _deepseek_dev,
        **{name: compatible.make_chat(name) for name in config.AGENT_COMPATIBLE}}


def model_of(provider):
    """El id del modelo con el que responde `provider`, el que se cobra. Ejemplo: `model_of("deepseek")` → `"deepseek-flash"`."""
    if provider in config.AGENT_COMPATIBLE:
        return config.AGENT_COMPATIBLE[provider]["model"]
    if provider == "bedrock":
        return config.AGENT_BEDROCK_MODEL
    return config.AGENT_MODEL
