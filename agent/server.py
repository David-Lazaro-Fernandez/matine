"""Servidor MCP del agente: publica las herramientas de `agent/tools.py` y nada más.

El servidor se arma por cuenta (`build(user)`): host y servidor viven en el mismo proceso y hablan por el cliente en
memoria de FastMCP, así que no hay red ni token. Cada llamada revisa el acceso de esa cuenta y abre su propia conexión
de solo lectura; el entorno nunca es un argumento de una herramienta.
"""
import json
from contextlib import closing

from fastmcp import FastMCP

from analytics import db
from analytics.labels import AGENT_UI

from . import tools

_READ_ONLY = {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False}
INSTRUCTIONS = (
    "Eres el asistente de datos de Cinemex. Respondes en español, en primera persona de Cinemex, solo con lo que "
    "devuelven tus herramientas: cartelera, venta medida, precios de dulcería y distribuidoras frente a Cinépolis. Cita solo cifras "
    "que devuelva una herramienta, con su ciudad, y usa los campos terminados en `_text` tal cual. "
    "Si una herramienta devuelve `refusal`, di ese motivo y no inventes la cifra. Si además trae `suggestions`, "
    "pregunta si el usuario se refería a alguna de esas películas, escribiendo sus nombres en la pregunta, y no consultes hasta que responda. "
    "Cuando una película tenga `original_titles`, nómbrala con su nombre original, por ejemplo Tu Nombre (Your Name). "
    "Si piden algo ajeno a esos datos (clima, bolsa, poemas, traducciones, datos personales, otras empresas), di que "
    "no puedes y no lo hagas. Solo lees: no puedes crear, cambiar ni borrar nada. "
    "Al usuario le hablas de ciudades: nunca uses la palabra \"plaza\", que es un término interno de las herramientas. "
    "Nunca supongas el alcance. Si el usuario no dijo la ciudad, ni antes en la conversación, no consultes: pregunta en "
    "una frase corta de qué ciudad (CDMX, Guadalajara, Monterrey o todo el país). Haz lo mismo con cualquier otro dato "
    "que falte: película, cadena o periodo. Pregunta solo lo que falta y consulta cuando ya lo tengas. "
    "No uses la raya larga (—) en tus respuestas: usa coma, punto o dos puntos. "
    f"Si la herramienta devuelve `window_text`, cierra la respuesta con una línea aparte: `{AGENT_UI['window_label']} <window_text>.` "
    "No repitas la ventana en otra parte del texto. "
    "En las herramientas la plaza es `cdmx`, `gdl`, `mty`, o `nacional` para todo el país; usa `nacional` cuando digan país, nacional o todo México."
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
    def get_cinema_ranking(plaza: str, chain: str = "cinemex", order: str = "desc", limit: int = 10) -> dict:
        """Cines de una cadena (`cinemex` o `cinepolis`) por ocupación medida de los últimos 7 días, `order` `desc`
        (más venden) o `asc`. Solo `cdmx` tiene butacas medidas; otra plaza o nacional da un rechazo."""
        return run(tools.get_cinema_ranking, chain=chain, plaza=plaza, order=order, limit=limit)

    @server.tool(annotations=_READ_ONLY)
    def get_title_screens(plaza: str | None, title: str | None = None, limit: int = 10) -> dict:
        """Películas por participación en las funciones de Cinemex esta semana de cine, junto a Cinépolis. `title` filtra
        por nombre. `plaza`: `cdmx`, `gdl`, `mty` o `nacional` (o null) para todo el país."""
        return run(tools.get_title_screens, title=title, plaza=plaza, limit=limit)

    @server.tool(annotations=_READ_ONLY)
    def compare_titles(title_a: str, title_b: str, plaza: str | None) -> dict:
        """Dos películas lado a lado: funciones, participación y, donde hay butacas medidas, demanda en Cinemex.
        `plaza`: `cdmx`, `gdl`, `mty` o `nacional` (o null) para todo el país."""
        return run(tools.compare_titles, title_a, title_b, plaza=plaza)

    def run_in_module(module, fn, *args, **kwargs):
        tools.require_module(user, module)
        return run(fn, *args, **kwargs)

    if "dulceria" in user["modules"]:
        @server.tool(annotations=_READ_ONLY)
        def get_popcorn_price(platform: str | None = None, bucket: str | None = None) -> dict:
            """Precio de dulcería a domicilio de Cinemex contra Cinépolis por tipo de producto. `bucket` acota a un tipo:
            `combo_hotdog`, `combo_nachos`, `combo_basico`, `palomitas`, `hotdog`, `nachos`, `refresco`, `dulces`,
            `helado`. `platform`: `rappi` o `didi`."""
            return run_in_module("dulceria", tools.get_popcorn_price, platform=platform, bucket=bucket)

    if "distribuidores" in user["modules"]:
        @server.tool(annotations=_READ_ONLY)
        def get_distributor_screens(plaza: str | None = "cdmx", chain: str = "cinemex", limit: int = 10) -> dict:
            """Distribuidoras (proveedores de películas) por salas, cines, funciones y % de programación en Cinemex y
            Cinépolis esta semana de cine. `chain` ordena por las funciones de esa cadena. `plaza`: `cdmx`, `gdl`, `mty`
            o `nacional` (o null) para todo el país. No baja a cine ni a película."""
            return run_in_module("distribuidores", tools.get_distributor_screens, plaza=plaza, chain=chain, limit=limit)

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
