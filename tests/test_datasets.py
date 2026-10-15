"""Conjuntos del explorador (`analytics/datasets.py`) sobre SQLite: filtros opcionales, búsqueda sin acentos y
funciones de la semana (publicadas y cerradas)."""
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analytics import datasets, db  # noqa: E402


def test_where_skips_empty_and_expands_lists():
    assert datasets.where([("a = ?", None), ("b = ?", ""), ("c IN ({marks})", ())]) == ("", [])
    sql, params = datasets.where([("a = ?", 1), ("c IN ({marks})", ("x", "y"))], prefix="AND")
    assert sql == " AND a = ? AND c IN (?,?)" and params == [1, "x", "y"]


def test_contains_ignores_accents_and_case():
    assert datasets.contains("  Película ") == "%pelicula%"
    assert datasets.contains("") is None


def test_week_showtimes_joins_open_and_closed():
    conn = db.register(sqlite3.connect(":memory:"))
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE cinema (chain, cinema_id, name)")
    conn.execute("INSERT INTO cinema VALUES ('cinemex', 'c1', 'Pedregal')")
    conn.execute("""CREATE TABLE current_showtime (chain, show_id, cinema_id, movie_title, original_title, date, datetime_local,
                    screen, language, format, experience, premium_tier, availability, first_seen)""")
    conn.execute("""INSERT INTO current_showtime VALUES ('cinemex', 's1', 'c1', 'La Película', 'The Movie', '2026-10-01',
                    '2026-10-01T18:00:00', '1', 'spanish', '2D', NULL, 'traditional', 'high', '2026-09-25T00:00:00+00:00')""")
    conn.execute("""CREATE TABLE event (chain, show_id, kind, detected_at, cinema_id, movie_title, date, before_json)""")
    conn.execute("INSERT INTO event VALUES ('cinemex', 's0', 'removed', '2026-09-30T10:00:00+00:00', 'c1', 'Otra', '2026-10-01', ?)",
                 (json.dumps({"datetime_local": "2026-10-01T12:00:00", "screen": "2"}),))
    def ids(**kw):
        return [r["show_id"] for r in datasets.page(conn, "week_showtimes", d0="2026-10-01", d1="2026-10-01", **kw)]

    both = datasets.page(conn, "week_showtimes", d0="2026-10-01", d1="2026-10-01")
    assert [(r["show_id"], r["closed_kind"]) for r in both] == [("s0", "removed"), ("s1", None)]
    assert datasets.count(conn, "week_showtimes", d0="2026-10-01", d1="2026-10-01") == 2
    assert ids(only_open=True) == ["s1"]
    assert ids(search="pelicula") == ["s1"]
    # También busca por el cine, sin mayúsculas ni acentos.
    assert ids(search="PEDRÉGAL") == ["s0", "s1"]
    assert ids(search="zzz") == []
    # Y por el nombre original que publica la cadena.
    assert ids(search="THE movie") == ["s1"]
    # Ordena y pagina en la base; una columna que no existe se ignora.
    assert ids(sort="starts_at", desc=True) == ["s1", "s0"]
    assert ids(limit=1, offset=1) == ["s1"]
    # El cine va con su cadena: el mismo id de otra cadena no entra.
    assert ids(cinema_ids=("cinemex:c1",)) == ["s0", "s1"]
    assert ids(cinema_ids=("cinepolis:c1",)) == []
    assert ids(sort="nada; DROP TABLE cinema") == ["s0", "s1"]


def test_from_now_drops_started_showtimes_only_when_the_range_includes_today(monkeypatch):
    monkeypatch.setattr(datasets, "today", lambda: "2026-10-01")
    conn = db.register(sqlite3.connect(":memory:"))
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE cinema (chain, cinema_id, name)")
    conn.execute("INSERT INTO cinema VALUES ('cinemex', 'c1', 'Pedregal')")
    conn.execute("""CREATE TABLE current_showtime (chain, show_id, cinema_id, movie_title, date, datetime_local, datetime_utc,
                    screen, language, format, experience, premium_tier, availability, first_seen)""")
    for show_id, starts in (("past", "2000-01-01T00:00:00+00:00"), ("future", "2999-01-01T00:00:00+00:00")):
        conn.execute("INSERT INTO current_showtime VALUES ('cinemex', ?, 'c1', 'X', '2026-10-01', '', ?, '1', '', '', NULL, '', '', '')",
                     (show_id, starts))
    conn.execute("CREATE TABLE event (chain, show_id, kind, detected_at, cinema_id, movie_title, date, before_json)")

    def ids(d0, d1):
        return [r["show_id"] for r in datasets.page(conn, "week_showtimes", d0=d0, d1=d1, from_now=True)]

    assert ids("2026-10-01", "2026-10-01") == ["future"]
    monkeypatch.setattr(datasets, "today", lambda: "2026-10-05")
    assert sorted(ids("2026-10-01", "2026-10-01")) == ["future", "past"]
