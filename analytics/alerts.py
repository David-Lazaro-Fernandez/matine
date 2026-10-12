"""Cambios de la competencia que merecen un aviso: funciones canceladas, con cambio de horario o sala, o con otro
idioma o formato. Las altas y las funciones concluidas no entran: son ruido para un aviso.

`competitor_changes()` devuelve los eventos con id mayor que `since_id`, en orden de id. `integrations/` guarda el último
id que envió como cursor, así que cada aviso sale una sola vez.
"""
import json

from .db import rows
from .labels import KIND_LABEL, THEM
from .plaza import plaza_cinema_where

ALERT_KINDS = ("removed", "moved", "changed")


def latest_event_id(conn):
    """Id del evento más reciente; 0 si no hay eventos."""
    return rows(conn, "SELECT COALESCE(MAX(id), 0) AS id FROM event")[0]["id"]


def competitor_changes(conn, since_id=0, plaza="cdmx", chain=THEM):
    """Eventos de avisos de `chain` en `plaza` con id mayor que `since_id`. Cada dict tiene {id, kind, kind_label,
    detected_at, cinema, movie_title, before_time, after_time}; las horas son 'HH:MM' locales o None.
    Con `plaza=None` acota a todo el país de esa cadena."""
    plaza_sql, plaza_params = plaza_cinema_where(plaza, alias="e.", chains=(chain,))
    kinds = ",".join("?" for _ in ALERT_KINDS)
    found = rows(conn, f"""
        SELECT e.id, e.kind, e.detected_at, e.movie_title, e.before_json, e.after_json, c.name AS cinema
        FROM event e LEFT JOIN cinema c ON c.chain = e.chain AND c.cinema_id = e.cinema_id
        WHERE e.id > ? AND e.kind IN ({kinds}) {plaza_sql}
        ORDER BY e.id""", (since_id, *ALERT_KINDS, *plaza_params))
    return [_change(r) for r in found]


def _change(row):
    before, after = _load(row["before_json"]), _load(row["after_json"])
    return {
        "id": row["id"],
        "kind": row["kind"],
        "kind_label": KIND_LABEL[row["kind"]],
        "detected_at": row["detected_at"],
        "cinema": row["cinema"],
        "movie_title": row["movie_title"],
        "before_time": _hhmm(before.get("datetime_local")),
        "after_time": _hhmm(after.get("datetime_local")),
    }


def _load(text):
    return json.loads(text) if text else {}


def _hhmm(local):
    return local[11:16] if local and len(local) >= 16 else None
