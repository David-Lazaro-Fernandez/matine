"""Herramientas del agente. Cada una llama a una función de `analytics/` y devuelve un dict con la ventana, la plaza y
el número de renglones, para que la respuesta cite de dónde sale cada cifra. No hay SQL aquí.

Una pregunta que no se puede responder con dato real devuelve `{"refusal": motivo}`; el agente lo dice tal cual.
Ejemplo: `get_cinema_ranking(conn, plaza="gdl")` → `{"refusal": "Solo hay butacas medidas en CDMX…"}`.
"""
import os
from pathlib import Path

from analytics import cinema_sales, datasets, delivery, labels, queries, seats
from scraper import config, normalize

ROW_LIMIT = 50
_ROLES_THAT_ASK = {"staff", "admin", "analyst"}
_LOCAL_ENVIRONMENT = "dev"


class AccessDenied(Exception):
    """La cuenta no puede usar el agente."""


def environment():
    """`dev` o `prod`, de `AC_ENV`. Va en cada respuesta para que nadie confunda una base local con la real."""
    return os.environ.get("AC_ENV", _LOCAL_ENVIRONMENT)


def check_startup():
    """Dev solo corre con datos locales: una `AC_DATA_DIR` fuera del repo en dev levanta `RuntimeError`."""
    if environment() == _LOCAL_ENVIRONMENT and not config.DATA_DIR.resolve().is_relative_to(Path(config.ROOT).resolve()):
        raise RuntimeError("El agente en dev no abre datos fuera del repo; revisa AC_DATA_DIR.")


def require_access(user):
    """Deja pasar a analyst o más, de una organización con el módulo `agente`. Si no, levanta `AccessDenied`."""
    if user["role"] not in _ROLES_THAT_ASK:
        raise AccessDenied(labels.AGENT_TEXT["role_denied"])
    if user["role"] != "staff" and "agente" not in user["modules"]:
        raise AccessDenied(labels.AGENT_TEXT["module_denied"])


def _result(rows, **context):
    return {"environment": environment(), "row_count": len(rows), "rows": rows[:ROW_LIMIT], **context}


def _refusal(reason):
    return {"environment": environment(), "refusal": reason}


def list_tables():
    """Las tablas que el agente puede consultar: `table`, `label` y `description`."""
    return _result([{"table": key, "label": labels.DATASET_LABEL[key], "description": labels.DATASET_DESCRIPTION[key]}
                    for key in datasets.DATASETS])


def describe_table(conn, table):
    """Columnas de una tabla del catálogo (`column`, `label`) y su número de renglones."""
    if table not in datasets.DATASETS:
        return _refusal(labels.AGENT_TEXT["unknown_table"].format(table=table))
    first = datasets.page(conn, table, limit=1)
    columns = [{"column": c, "label": labels.COLUMN_LABEL.get(c, c)} for c in (first[0] if first else {})]
    return _result(columns, table=table, total_rows=datasets.count(conn, table),
                   filters=list(datasets.DATASETS[table]["filters"]))


def get_cinema_ranking(conn, chain="cinemex", plaza="cdmx", order="desc", limit=10, days=cinema_sales.DAYS):
    """Cines de una cadena por % vendido medido después del inicio, de `order` `desc` (más venden) o `asc`.
    Solo hay butacas medidas en las plazas de `config.SEATS_PLAZAS`; fuera de ellas devuelve un rechazo."""
    if plaza not in config.SEATS_PLAZAS:
        return _refusal(labels.AGENT_TEXT["seats_only"].format(plazas=", ".join(config.SEATS_PLAZAS)))
    if chain not in labels.COMPARED:
        return _refusal(labels.AGENT_TEXT["chain_not_compared"])
    everyone = cinema_sales.cinema_occupancy(conn, days=days, plaza=plaza, min_shows=0, chains=(chain,))
    kept = [r for r in everyone if r["shows"] >= cinema_sales.MIN_SHOWS]
    kept.sort(key=lambda r: (r["sold_pct"], r["cinema_id"]), reverse=order == "desc")
    cutoff = queries.today()
    return _result(kept[:limit], chain=chain, plaza=plaza, measure="ocupación medida", days=days, cutoff_date=cutoff,
                   min_shows=cinema_sales.MIN_SHOWS, cinemas_dropped=len(everyone) - len(kept))


def _week_titles(conn, plaza):
    d0, d1 = queries.cinema_week(queries.today())
    return d0, d1, queries.movies_by_chain(conn, d0, d1, limit=10**6, plaza=plaza)


def get_title_screens(conn, title=None, plaza="cdmx", limit=10):
    """Películas por su participación en la programación de Cinemex esta semana de cine (jueves a miércoles), con la de
    Cinépolis al lado. Con `title`, solo las que lo contienen. `plaza=None` es nacional."""
    d0, d1, titles = _week_titles(conn, plaza)
    if title:
        needle = normalize.norm_title(title)
        titles = [t for t in titles if needle in normalize.norm_title(t["title"] or "")]
        if not titles:
            return _refusal(labels.AGENT_TEXT["title_not_found"].format(title=title))
    titles.sort(key=lambda t: (-(t["shows_cinemex"] or 0), t["title_norm"]))
    return _result(titles[:limit], plaza=plaza, window={"from": d0, "to": d1}, measure="participación en funciones")


def compare_titles(conn, title_a, title_b, plaza="cdmx"):
    """Dos películas lado a lado: funciones y participación en ambas cadenas esta semana de cine y, en plazas con
    butacas medidas, su % vendido y su índice de demanda en Cinemex."""
    d0, d1, titles = _week_titles(conn, plaza)
    found = []
    for wanted in (title_a, title_b):
        needle = normalize.norm_title(wanted)
        match = [t for t in titles if needle in normalize.norm_title(t["title"] or "")]
        if not match:
            return _refusal(labels.AGENT_TEXT["title_not_found"].format(title=wanted))
        found.append(max(match, key=lambda t: t["shows_cinemex"] or 0))
    demand = {}
    if plaza in config.SEATS_PLAZAS:
        demand = {r["title_norm"]: r for r in seats.occupancy_by_title(conn, chain="cinemex", plaza=plaza)}
    for t in found:
        t["occupancy"] = demand.get(t["title_norm"])
    return _result(found, plaza=plaza, window={"from": d0, "to": d1})


def get_popcorn_price(conn, platform=None):
    """Precio de dulcería de Cinemex contra Cinépolis por tipo de producto, a domicilio (Rappi y DiDi). Es la única
    fuente con las dos cadenas: Cinemex no publica su menú en sala."""
    compared = delivery.delivery_compare(conn, platform=platform)
    return _result(compared, source="precio a domicilio, mediana por tienda", platform=platform)
