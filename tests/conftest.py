"""Bases en memoria cargadas con la captura grabada de cada cadena (`scripts/capture_fixtures.py`), para probar
`analytics/` con dato real sin red ni `data/snapshots.db`."""
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analytics import db  # noqa: E402
from scraper import config, run, store  # noqa: E402
from scripts import capture_fixtures as fixtures  # noqa: E402


@pytest.fixture
def capture_db(tmp_path, monkeypatch):
    """Fábrica: `capture_db("cinemex", "cineteca")` devuelve una conexión con la captura grabada de esas cadenas escrita
    por `run.commit`, con `title_key` registrada como la registra `analytics.connect()`."""
    # `run.commit` registra en run.log: fuera del log real.
    monkeypatch.setattr(config, "LOG_DIR", tmp_path)
    opened = []

    def make(*chains):
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        conn.executescript(store.SCHEMA)
        for chain in chains:
            taken_at = fixtures.load(chain, "responses")["recorded_at"]
            raw = fixtures.replay(chain)
            assert run.commit(conn, chain, store.begin_snapshot(conn, chain, taken_at), taken_at, raw, 0, save_raw=False)
        opened.append(conn)
        return db.register(conn)

    yield make
    for conn in opened:
        conn.close()


class _FrozenToday:
    """`analytics.queries` con `today()` fija. La captura grabada es de septiembre; con la fecha real, la semana de cine en
    curso queda vacía."""

    def __init__(self, queries, today):
        self._queries, self.today = queries, lambda *args: today

    def __getattr__(self, name):
        return getattr(self._queries, name)


@pytest.fixture
def frozen_week(monkeypatch):
    """Las herramientas del agente miran la semana del 24 al 30 de septiembre de 2026, la de la captura grabada. Solo ellas:
    `analytics` sigue con la fecha real, así que su corte de "ya empezó" no vacía la semana."""
    from agent import tools
    from analytics import queries

    monkeypatch.setattr(tools, "queries", _FrozenToday(queries, "2026-09-26"))
