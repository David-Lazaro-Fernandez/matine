"""Endpoints de las páginas del dashboard: un módulo por página, cada uno con un `router` de FastAPI.

`api/internal.py` registra solo el `router` de cada módulo de este paquete, bajo `/api` y detrás de la sesión. Una
página nueva es un archivo nuevo aquí; no se edita `api/internal.py`. Cada router declara el módulo que lo contiene
(`dependencies=[Depends(session.require_module("cartelera"))]`): sin él, la organización recibe 403. Una página del
equipo de la plataforma usa `session.require_staff`.

`read` busca la respuesta en memoria (`TTL` segundos), luego en las precalculadas de `data/precalc.db` (`api/precalc.py`,
de hasta `PRECALC_MAX_AGE`) y si no está la calcula con `analytics.connect()` en solo lectura.
"""
import contextlib
import importlib
import json
import pkgutil
import sqlite3
import threading
import time
from collections import OrderedDict
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

import analytics
from scraper import config

# Los planos de asientos escriben cada 15 min y la cartelera tres veces al día.
TTL = 60
# ponytail: tope por número de llaves, no por memoria. Un conjunto de Datos pesa hasta MAX_ROWS renglones.
# La Cartelera usa doce llaves por combinación de filtros: encabezado, hallazgos, secciones y apéndices.
_CACHE_SIZE = 64

# `api.precalc` corre cada hora. Si deja de correr, la API vuelve a calcular en vivo en vez de servir datos viejos.
PRECALC_MAX_AGE = timedelta(hours=2)

_cache = OrderedDict()
_cache_lock = threading.Lock()
# Una llave que ya se está calculando: las demás peticiones de esa llave esperan su resultado en vez de repetirlo.
_computing = {}
# El servidor tiene 2 vCPU. Más cálculos en vivo a la vez se estorban (GIL y disco) y tardan más que en fila: con 5
# usuarios a la vez, la Cartelera nacional tardó 106 s, contra 6 s de uno solo (medido 2026-10-11).
_COMPUTE_SLOTS = threading.BoundedSemaphore(2)
_MISS = object()
# Mientras `recording()` está abierto, `read` calcula todo en vivo y guarda aquí cada respuesta por su llave.
_recorded = None


def routers():
    """El `router` de cada módulo de este paquete, en orden alfabético."""
    return [importlib.import_module(f"{__name__}.{m.name}").router
            for m in sorted(pkgutil.iter_modules(__path__), key=lambda m: m.name)]


def precalc_key(key):
    """La llave de `read` como texto, la de la tabla `result` de `precalc.db`: ('a', (0, 24), None) → '["a", [0, 24], null]'."""
    return json.dumps(key)


def _precalculated(key):
    path = config.PRECALC_DB_PATH
    if not path.exists():
        return None
    oldest = (datetime.now(timezone.utc) - PRECALC_MAX_AGE).isoformat(timespec="seconds")
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=5)
        try:
            row = conn.execute("SELECT payload FROM result WHERE key = ? AND computed_at >= ?",
                               (precalc_key(key), oldest)).fetchone()
        finally:
            conn.close()
    except sqlite3.Error:
        return None
    return json.loads(row[0]) if row else None


@contextlib.contextmanager
def recording():
    """Mientras está abierto, `read` ignora las cachés y anota cada respuesta: `with recording() as got: …` deja
    `{key: respuesta}` en `got`. Lo usa `api.precalc`."""
    global _recorded
    _recorded = {}
    try:
        yield _recorded
    finally:
        _recorded = None


def read(key, compute):
    """`compute(conn)` sobre `snapshots.db`, con caché de `TTL` segundos por `key` (tupla hasheable) y las respuestas
    precalculadas de `precalc.db`. Peticiones simultáneas de la misma llave hacen un solo cálculo. 503 sin base."""
    if _recorded is not None:
        value = _recorded[key] = _compute(compute)
        return _remember(key, value)
    value = _cached(key)
    if value is not _MISS:
        return value
    value = _precalculated(key)
    if value is not None:
        return _remember(key, value)
    with _cache_lock:
        lock = _computing.setdefault(key, threading.Lock())
    with lock:
        value = _cached(key)
        if value is not _MISS:
            return value
        try:
            with _COMPUTE_SLOTS:
                return _remember(key, _compute(compute))
        finally:
            with _cache_lock:
                _computing.pop(key, None)


def _compute(compute):
    try:
        conn = analytics.connect()
    except FileNotFoundError:
        raise HTTPException(503) from None
    try:
        return compute(conn)
    finally:
        conn.close()


def _cached(key):
    with _cache_lock:
        hit = _cache.get(key)
        if hit and hit[0] > time.monotonic():
            _cache.move_to_end(key)
            return hit[1]
    return _MISS


def _remember(key, value):
    with _cache_lock:
        _cache[key] = (time.monotonic() + TTL, value)
        _cache.move_to_end(key)
        while len(_cache) > _CACHE_SIZE:
            _cache.popitem(last=False)
    return value
