"""Distribuidor canónico de cada texto que mandan las cadenas. Cinemex y Cinépolis escriben el mismo estudio de
formas distintas ("Paramount Pictures", "Pramount Pictures", "Paramount") y a veces ponen en ese campo algo que no es
distribuidor: un programa propio, un evento o una duración.

`distributor_key` y `distributor_kind` leen `distributor_map.csv`, una fila por texto crudo, y los registra
`analytics/db.py` en SQL. El crudo no se reescribe: la base conserva lo que mandó la cadena.

Un texto que no está en el mapa devuelve su versión sin espacios y tipo `sin_clasificar`, para que el reporte lo
muestre y no lo pierda. Un valor con forma de duración ("1h 40m") es error de fuente aunque el mapa no lo tenga.
Solo stdlib.
"""
import csv
import re
from functools import lru_cache
from pathlib import Path

MAP_PATH = Path(__file__).resolve().parent / "distributor_map.csv"
KIND_UNCLASSIFIED = "sin_clasificar"
KIND_SOURCE_ERROR = "error_fuente"

# Duración en el campo del distribuidor: "1h 40m", "2h", "3h 5m".
_DURATION = re.compile(r"^\d+\s*h(\s*\d+\s*m)?$", re.IGNORECASE)


def _key(raw):
    """Llave de búsqueda: sin espacios sobrantes y sin mayúsculas."""
    return " ".join(raw.split()).casefold()


def _load_map():
    with open(MAP_PATH, encoding="utf-8") as fh:
        return {_key(r["raw"]): (r["canonical"], r["kind"]) for r in csv.DictReader(fh)}


_MAP = _load_map()


@lru_cache(maxsize=1024)
def _resolve(raw):
    key = _key(raw)
    if key in _MAP:
        canonical, kind = _MAP[key]
        return canonical or None, kind
    if _DURATION.match(key):
        return None, KIND_SOURCE_ERROR
    return " ".join(raw.split()), KIND_UNCLASSIFIED


def distributor_key(raw):
    """Nombre canónico del distribuidor. Vacío si el texto es nulo o es un error de fuente.

    Ejemplo: 'Pramount Pictures' -> 'Paramount'; '1h 40m' -> None.
    """
    if not raw or not raw.strip():
        return None
    return _resolve(raw)[0]


def distributor_kind(raw):
    """Tipo del texto: `distribuidor`, `programa_propio`, `evento`, `error_fuente` o `sin_clasificar`.

    Ejemplo: 'Riot Games' -> 'evento'; 'Estudio nuevo' -> 'sin_clasificar'.
    """
    if not raw or not raw.strip():
        return None
    return _resolve(raw)[1]
