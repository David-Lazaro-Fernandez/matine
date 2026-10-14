"""Precalcula las respuestas que casi toda visita pide y las guarda en `data/precalc.db`.

Calcula, para cada plaza y para nacional, los filtros por defecto del dashboard: de la Cartelera, el encabezado, los
hallazgos, las cinco secciones, los cinco apéndices, Cines e Historial, y además Dulcería, Mapa e Independientes. Llama
a los mismos endpoints, así que cada respuesta es idéntica a la que daría la API en ese momento. `api.pages.read` la
sirve hasta `PRECALC_MAX_AGE`; otro filtro se calcula en vivo.

Es el último paso de los trabajos `snapshot` y `seats` (`jobs/registry.py`), así queda al día después de cada captura
y a lo más una hora atrás en el corte de "hoy" (`from_now`). Es el único escritor de `precalc.db`, una caché que se
puede borrar: sin ella la API calcula todo en vivo.

Uso: `.venv/bin/python -m api.precalc`.
"""
import json
import sqlite3
import time
from datetime import datetime, timezone
from typing import get_args

from scraper import config, plazas

from . import pages
from .pages import cartelera, dulceria, independientes, mapa


def compute_extras(plaza):
    """Las pantallas fuera de la Cartelera y de sus secciones que se abren con solo la zona."""
    cartelera.cines(plaza=plaza)
    cartelera.historia(plaza=plaza)
    dulceria.dulceria(plaza=plaza)
    mapa.mapa(plaza=plaza)
    independientes.independientes(plaza=plaza)


def compute():
    """{llave de `read`: respuesta} de todas las respuestas precalculadas."""
    with pages.recording() as got:
        for plaza in (*plazas.PLAZAS, None):
            cartelera.cartelera(plaza=plaza)
            cartelera.hallazgos(plaza=plaza)
            for slug in get_args(cartelera.Section):
                cartelera.seccion(slug, plaza=plaza)
            for slug in get_args(cartelera.Appendix):
                cartelera.apendice(slug, plaza=plaza)
            compute_extras(plaza)
    return got


def store(results, computed_at):
    """Reemplaza todas las respuestas de `precalc.db` por `results`, en una sola transacción."""
    config.PRECALC_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.PRECALC_DB_PATH, timeout=30)
    try:
        # WAL: la API lee mientras este paso escribe.
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("CREATE TABLE IF NOT EXISTS result (key TEXT PRIMARY KEY, computed_at TEXT NOT NULL, "
                     "payload TEXT NOT NULL)")
        with conn:
            conn.execute("DELETE FROM result")
            conn.executemany("INSERT INTO result (key, computed_at, payload) VALUES (?, ?, ?)",
                             [(pages.precalc_key(k), computed_at, json.dumps(v)) for k, v in results.items()])
    finally:
        conn.close()


def main():
    started = time.monotonic()
    # La hora de inicio, no la de fin: es la del corte de "hoy" más viejo que contiene el resultado.
    computed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    results = compute()
    store(results, computed_at)
    print(f"{computed_at} precalc: {len(results)} respuestas en {time.monotonic() - started:.0f} s")


if __name__ == "__main__":
    main()
