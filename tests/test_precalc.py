"""`api.pages.read` sirve lo que guarda `api.precalc` mientras está vigente y calcula en vivo cuando no."""
from datetime import datetime, timedelta, timezone

import analytics
import api.pages as pages
from api import precalc
from scraper import config

KEY = ("cartelera/hallazgos", "2026-10-11", "2026-10-11", "2026-10-14", (0, 24), None)


class _Conn:
    def close(self):
        pass


def _setup(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PRECALC_DB_PATH", tmp_path / "precalc.db")
    monkeypatch.setattr(analytics, "connect", _Conn)
    pages._cache.clear()


def test_read_serves_a_fresh_precalculated_answer(monkeypatch, tmp_path):
    _setup(monkeypatch, tmp_path)
    precalc.store({KEY: {"findings": [{"title": "guardado"}]}}, datetime.now(timezone.utc).isoformat())
    assert pages.read(KEY, lambda conn: {"findings": []}) == {"findings": [{"title": "guardado"}]}


def test_read_computes_when_the_precalculated_answer_is_old(monkeypatch, tmp_path):
    _setup(monkeypatch, tmp_path)
    old = datetime.now(timezone.utc) - pages.PRECALC_MAX_AGE - timedelta(minutes=1)
    precalc.store({KEY: {"findings": [{"title": "viejo"}]}}, old.isoformat())
    assert pages.read(KEY, lambda conn: {"findings": []}) == {"findings": []}


def test_recording_ignores_the_caches_and_keeps_each_answer(monkeypatch, tmp_path):
    _setup(monkeypatch, tmp_path)
    precalc.store({KEY: {"findings": [{"title": "guardado"}]}}, datetime.now(timezone.utc).isoformat())
    with pages.recording() as got:
        assert pages.read(KEY, lambda conn: {"findings": []}) == {"findings": []}
    assert got == {KEY: {"findings": []}}
