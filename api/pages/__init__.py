"""Endpoints de las páginas del dashboard: un módulo por página, cada uno con un `router` de FastAPI.

`api/internal.py` registra solo el `router` de cada módulo de este paquete, bajo `/api` y detrás de la sesión. Una
página nueva es un archivo nuevo aquí; no se edita `api/internal.py`. Una página solo de admin agrega
`dependencies=[Depends(session.require_admin)]` a su router.

`read` lee `snapshots.db` con `analytics.connect()` en solo lectura, cierra la conexión y guarda el resultado `TTL`
segundos en memoria, como `load()` del dashboard de Streamlit.
"""
import importlib
import pkgutil
import threading
import time
from collections import OrderedDict

from fastapi import HTTPException

import analytics

# Los planos de asientos escriben cada 15 min y la cartelera tres veces al día.
TTL = 60
# ponytail: tope por número de llaves, no por memoria. Un conjunto de Datos pesa hasta MAX_ROWS renglones.
# La Cartelera usa doce llaves por combinación de filtros: encabezado, hallazgos, secciones y apéndices.
_CACHE_SIZE = 64

_cache = OrderedDict()
_cache_lock = threading.Lock()


def routers():
    """El `router` de cada módulo de este paquete, en orden alfabético."""
    return [importlib.import_module(f"{__name__}.{m.name}").router
            for m in sorted(pkgutil.iter_modules(__path__), key=lambda m: m.name)]


def read(key, compute):
    """`compute(conn)` sobre `snapshots.db`, con caché de `TTL` segundos por `key` (tupla hasheable). 503 sin base."""
    now = time.monotonic()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and hit[0] > now:
            _cache.move_to_end(key)
            return hit[1]
    try:
        conn = analytics.connect()
    except FileNotFoundError:
        raise HTTPException(503) from None
    try:
        value = compute(conn)
    finally:
        conn.close()
    with _cache_lock:
        _cache[key] = (now + TTL, value)
        _cache.move_to_end(key)
        while len(_cache) > _CACHE_SIZE:
            _cache.popitem(last=False)
    return value
