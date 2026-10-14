"""Herramientas del agente. Cada una llama a una función de `analytics/` y devuelve un dict con la ventana, la plaza y
el número de renglones, para que la respuesta cite de dónde sale cada cifra. No hay SQL aquí.

Una pregunta que no se puede responder con dato real devuelve `{"refusal": motivo}`; el agente lo dice tal cual.
Ejemplo: `get_cinema_ranking(conn, plaza="gdl")` → `{"refusal": "Solo hay butacas medidas en CDMX…"}`.
"""
import os
from datetime import date, timedelta
from pathlib import Path

from analytics import cinema_sales, datasets, delivery, distributors, labels, queries, seats
from scraper import config, normalize, plazas
from scraper import distributors as distributor_map

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


def require_module(user, module):
    """Deja pasar a la cuenta cuya organización tiene `module` (staff las tiene todas). Si no, levanta `AccessDenied`."""
    if module not in user["modules"]:
        raise AccessDenied(labels.AGENT_TEXT["tool_module_denied"].format(module=labels.MODULE_LABEL[module]))


def _percent(value):
    return None if value is None else f"{value:.1f} %"


def _points(value):
    return None if value is None else f"{value:+.1f} pp"


def _with_text(rows, percent=(), points=()):
    """Cada cifra gana su texto listo (`sold_pct` → `sold_pct_text`): el modelo cita el texto y no formatea."""
    return [{**r, **{f"{k}_text": _percent(r.get(k)) for k in percent},
             **{f"{k}_text": _points(r.get(k)) for k in points}} for r in rows]


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
    filters = list(datasets.DATASETS[table]["filters"])
    # Las tablas con fechas piden un periodo: la semana de cine en curso, como el explorador.
    period = dict(zip(("d0", "d1"), queries.cinema_week(queries.today()))) if "dates" in filters else {}
    columns = [{"column": c, "label": labels.COLUMN_LABEL.get(c, c)} for c in datasets.columns(conn, table, **period)]
    return _result(columns, table=table, total_rows=datasets.count(conn, table, **period), filters=filters,
                   **({"window": {"from": period["d0"], "to": period["d1"]}} if period else {}))


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
    shown = _with_text(kept[:limit], percent=("sold_pct", "sold_pct_prev"), points=("delta_pp",))
    return _result(shown, chain=chain, plaza=plaza, measure="ocupación medida", days=days, cutoff_date=cutoff,
                   min_shows=cinema_sales.MIN_SHOWS, cinemas_dropped=len(everyone) - len(kept),
                   window_text=labels.range_es(*_days_back(days)))


def _days_back(days):
    end = date.fromisoformat(queries.today())
    return (end - timedelta(days=days - 1)).isoformat(), end.isoformat()


def _known_plaza(plaza):
    """La plaza como la entiende `analytics/` (`"nacional"` y None son todo el país) o None si no existe."""
    return None if plaza in (None, "nacional") else plaza


def _unknown_plaza(plaza):
    return _known_plaza(plaza) is not None and plaza not in plazas.PLAZAS


def _week_titles(conn, plaza):
    d0, d1 = queries.cinema_week(queries.today())
    return d0, d1, queries.movies_by_chain(conn, d0, d1, limit=10**6, plaza=plaza)


def get_title_screens(conn, title=None, plaza="cdmx", limit=10):
    """Películas por su participación en la programación de Cinemex esta semana de cine (jueves a miércoles), con la de
    Cinépolis al lado. Con `title`, solo las que lo contienen. `plaza=None` es nacional."""
    if _unknown_plaza(plaza):
        return _refusal(labels.AGENT_TEXT["unknown_plaza"].format(plaza=plaza, plazas=", ".join(plazas.PLAZAS)))
    plaza = _known_plaza(plaza)
    d0, d1, titles = _week_titles(conn, plaza)
    if title:
        needle = normalize.norm_title(title)
        titles = [t for t in titles if needle in normalize.norm_title(t["title"] or "")]
        if not titles:
            return _refusal(labels.AGENT_TEXT["title_not_found"].format(title=title))
    titles.sort(key=lambda t: (-(t["shows_cinemex"] or 0), t["title_norm"]))
    shown = _with_text(titles[:limit], percent=("share_cinemex", "share_cinepolis"), points=("gap_pp",))
    return _result(shown, plaza=plaza, window={"from": d0, "to": d1}, window_text=labels.range_es(d0, d1),
                   measure="participación en funciones")


def compare_titles(conn, title_a, title_b, plaza="cdmx"):
    """Dos películas lado a lado: funciones y participación en ambas cadenas esta semana de cine y, en plazas con
    butacas medidas, su % vendido y su índice de demanda en Cinemex."""
    if _unknown_plaza(plaza):
        return _refusal(labels.AGENT_TEXT["unknown_plaza"].format(plaza=plaza, plazas=", ".join(plazas.PLAZAS)))
    plaza = _known_plaza(plaza)
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
    shown = _with_text(found, percent=("share_cinemex", "share_cinepolis"), points=("gap_pp",))
    return _result(shown, plaza=plaza, window={"from": d0, "to": d1}, window_text=labels.range_es(d0, d1))


def get_popcorn_price(conn, platform=None, bucket=None):
    """Precio de dulcería de Cinemex contra Cinépolis por tipo de producto (combos, palomitas, refrescos, dulces…), a
    domicilio (Rappi y DiDi). Es la única fuente con las dos cadenas: Cinemex no publica su menú en sala.
    `bucket` acota a un tipo de `delivery.DELIVERY_BUCKETS`, como `refresco`."""
    if platform is not None and platform not in labels.PLATFORM_LABEL:
        return _refusal(labels.AGENT_TEXT["unknown_platform"].format(platform=platform, platforms=", ".join(labels.PLATFORM_LABEL)))
    buckets = {key: label for key, label, _ in delivery.DELIVERY_BUCKETS}
    if bucket is not None and bucket not in buckets:
        return _refusal(labels.AGENT_TEXT["unknown_bucket"].format(bucket=bucket, buckets=", ".join(buckets)))
    compared = [r for r in delivery.delivery_compare(conn, platform=platform) if bucket in (None, r["bucket"])]
    shown = [{**r, **{f"{k}_text": _money(r.get(k)) for k in _PRICE_FIELDS},
              "delta_pct_text": None if r["delta_pct"] is None else f"{r['delta_pct']:+.0f} %"} for r in compared]
    return _result(shown, source="precio a domicilio, mediana por tienda", platform=platform, bucket=bucket)


_PRICE_FIELDS = tuple(f"{chain}_{stat}" for chain in labels.COMPARED for stat in ("median", "min", "max"))


def _money(value):
    return None if value is None else f"${value:,.0f}"


def get_distributor_screens(conn, plaza="cdmx", chain="cinemex", limit=10):
    """Distribuidoras (proveedores de películas) de Cinemex y Cinépolis esta semana de cine: salas, cines, funciones y
    % de la programación de cada cadena, con la brecha en puntos. Ordenadas por funciones de `chain`. Es agregado:
    no baja a cine ni a película. Deja fuera las funciones sin distribuidora conciliada y dice cuántas."""
    if _unknown_plaza(plaza):
        return _refusal(labels.AGENT_TEXT["unknown_plaza"].format(plaza=plaza, plazas=", ".join(plazas.PLAZAS)))
    if chain not in labels.COMPARED:
        return _refusal(labels.AGENT_TEXT["chain_not_compared"])
    plaza = _known_plaza(plaza)
    d0, d1 = queries.cinema_week(queries.today())
    reach = distributors.distributor_reach(conn, d0, d1, plaza=plaza)
    kept = [r for r in reach if r["kind"] != distributor_map.KIND_UNRECONCILED]
    by_name = {}
    for r in kept:
        row = by_name.setdefault(r["distributor"], {"distributor": r["distributor"], "kind": r["kind"]})
        row.update({f"{k}_{r['chain']}": r[k] for k in ("screens", "cinemas", "shows", "share_shows")})
    rows = [{**{f"{k}_{c}": 0 for c in labels.COMPARED for k in ("screens", "cinemas", "shows")},
             **{f"share_shows_{c}": 0.0 for c in labels.COMPARED}, **r} for r in by_name.values()]
    for r in rows:
        r["gap_pp"] = round(r[f"share_shows_{labels.US}"] - r[f"share_shows_{labels.THEM}"], 1)
    rows.sort(key=lambda r: (-r[f"shows_{chain}"], r["distributor"]))
    shown = _with_text(rows[:limit], percent=tuple(f"share_shows_{c}" for c in labels.COMPARED), points=("gap_pp",))
    return _result(shown, plaza=plaza, window={"from": d0, "to": d1}, window_text=labels.range_es(d0, d1),
                   measure="participación en funciones", chain=chain,
                   unreconciled_shows=sum(r["shows"] for r in reach if r["kind"] == distributor_map.KIND_UNRECONCILED))
