"""Alcance por distribuidor sobre una base chica: variantes juntas, shares de toda la programación y formato grande."""
import sqlite3

import pytest

from analytics import db, provider_reach

COLUMNS = ("chain, cinema_id, screen, date, datetime_local, datetime_utc, city_id, premium_tier, experience, format, "
           "distributor")


@pytest.fixture
def conn():
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    c.execute(f"CREATE TABLE current_showtime ({COLUMNS})")
    shows = [
        ("cinemex", "c1", "1", "2026-10-20", "2026-10-20T13:00:00", "2026-10-20T19:00:00Z", "9", "traditional", None, "2D", "Paramount Pictures"),
        ("cinemex", "c1", "2", "2026-10-20", "2026-10-20T15:00:00", "2026-10-20T21:00:00Z", "9", "traditional", "imax", "2D", "Pramount Pictures"),
        ("cinepolis", "c2", "1", "2026-10-20", "2026-10-20T13:00:00", "2026-10-20T19:00:00Z", "9", "traditional", None, "2D", "Paramount"),
        ("cinepolis", "c2", "2", "2026-10-20", "2026-10-20T15:00:00", "2026-10-20T21:00:00Z", "9", "traditional", None, "2D", "1h 40m"),
        ("cinepolis", "c3", "1", "2026-10-20", "2026-10-20T16:00:00", "2026-10-20T22:00:00Z", "9", "traditional", None, "2D", "Riot Games"),
    ]
    c.executemany(f"INSERT INTO current_showtime ({COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?,?,?)", shows)
    return db.register(c)


def _row(reach, provider, chain):
    return next(r for r in reach if r["provider"] == provider and r["chain"] == chain)


def test_variants_add_up_and_shares_use_whole_chain_programming(conn):
    reach = provider_reach(conn, "2026-10-20", "2026-10-20", from_now=False)
    paramount = _row(reach, "Paramount", "cinemex")
    assert (paramount["cinemas"], paramount["screens"], paramount["shows"]) == (1, 2, 2)
    assert paramount["share_shows"] == 100.0
    assert paramount["large_shows"] == 1
    # Cinépolis tiene 3 funciones en la base: el error de fuente cuenta en el denominador, no como distribuidor.
    assert _row(reach, "Paramount", "cinepolis")["share_shows"] == 33.3


def test_error_source_and_nulls_are_not_providers(conn):
    reach = provider_reach(conn, "2026-10-20", "2026-10-20", from_now=False)
    assert all(r["provider"] for r in reach)
    assert not any(r["provider"] == "1h 40m" for r in reach)


def test_event_is_listed_with_its_kind(conn):
    reach = provider_reach(conn, "2026-10-20", "2026-10-20", from_now=False)
    assert _row(reach, "Riot Games", "cinepolis")["kind"] == "evento"
