"""Servidor MCP del agente: publica las herramientas de `agent/tools.py` y nada más.

El servidor se arma por cuenta (`build(user)`): host y servidor viven en el mismo proceso y hablan por el cliente en
memoria de FastMCP, así que no hay red ni token. Cada llamada revisa el acceso de esa cuenta y abre su propia conexión
de solo lectura; el entorno nunca es un argumento de una herramienta.
"""
import json
from contextlib import closing

from fastmcp import FastMCP

from analytics import db

from . import tools

_READ_ONLY = {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False}
INSTRUCTIONS = (
    "Eres el asistente de datos de Cinemex. Respondes en español, en primera persona de Cinemex, solo con lo que "
    "devuelven tus herramientas: cartelera, venta medida y precios de dulcería frente a Cinépolis. Cita solo cifras "
    "que devuelva una herramienta, con su ventana y su plaza, y usa los campos terminados en `_text` tal cual. "
    "Si una herramienta devuelve `refusal`, di ese motivo y no inventes la cifra. "
    "Si piden algo ajeno a esos datos (clima, bolsa, poemas, traducciones, datos personales, otras empresas), di que "
    "no puedes y no lo hagas. Solo lees: no puedes crear, cambiar ni borrar nada. "
    "Si la pregunta es ambigua (falta película, plaza, cadena o periodo), pregunta qué falta antes de consultar. "
    "La plaza es `cdmx`, `gdl`, `mty`, o `nacional` para todo el país; usa `nacional` cuando digan país, nacional o todo México."
)


def build(user):
    """Un `FastMCP` con las herramientas de solo lectura, ligado a la cuenta `user`. Levanta `tools.AccessDenied`."""
    tools.require_access(user)
    server = FastMCP("matine", instructions=INSTRUCTIONS)

    def run(fn, *args, **kwargs):
        tools.require_access(user)
        with closing(db.connect()) as conn:
            return fn(conn, *args, **kwargs)

    @server.tool(annotations=_READ_ONLY)
    def list_tables() -> dict:
        """Tablas que se pueden consultar, con su descripción."""
        tools.require_access(user)
        return tools.list_tables()

    @server.tool(annotations=_READ_ONLY)
    def describe_table(table: str) -> dict:
        """Columnas y número de renglones de una tabla de `list_tables`."""
        return run(tools.describe_table, table)

    @server.tool(annotations=_READ_ONLY)
    def get_cinema_ranking(chain: str = "cinemex", plaza: str = "cdmx", order: str = "desc", limit: int = 10) -> dict:
        """Cines de una cadena (`cinemex` o `cinepolis`) por ocupación medida de los últimos 7 días, `order` `desc`
        (más venden) o `asc`. Solo `cdmx` tiene butacas medidas; otra plaza o nacional da un rechazo."""
        return run(tools.get_cinema_ranking, chain=chain, plaza=plaza, order=order, limit=limit)

    @server.tool(annotations=_READ_ONLY)
    def get_title_screens(title: str | None = None, plaza: str | None = "cdmx", limit: int = 10) -> dict:
        """Películas por participación en las funciones de Cinemex esta semana de cine, junto a Cinépolis. `title` filtra
        por nombre. `plaza`: `cdmx`, `gdl`, `mty` o `nacional` (o null) para todo el país."""
        return run(tools.get_title_screens, title=title, plaza=plaza, limit=limit)

    @server.tool(annotations=_READ_ONLY)
    def compare_titles(title_a: str, title_b: str, plaza: str | None = "cdmx") -> dict:
        """Dos películas lado a lado: funciones, participación y, donde hay butacas medidas, demanda en Cinemex.
        `plaza`: `cdmx`, `gdl`, `mty` o `nacional` (o null) para todo el país."""
        return run(tools.compare_titles, title_a, title_b, plaza=plaza)

    @server.tool(annotations=_READ_ONLY)
    def get_popcorn_price(platform: str | None = None) -> dict:
        """Precio de dulcería a domicilio de Cinemex contra Cinépolis por tipo de producto."""
        return run(tools.get_popcorn_price, platform=platform)

    @server.resource("schema://tables")
    def tables() -> str:
        """Catálogo de tablas."""
        tools.require_access(user)
        return json.dumps(tools.list_tables(), ensure_ascii=False)

    @server.resource("schema://table/{name}")
    def table(name: str) -> str:
        """Columnas de una tabla del catálogo."""
        return json.dumps(run(tools.describe_table, name), ensure_ascii=False)

    return server
