"""Distribuidoras sobre una base chica: variantes juntas, shares de toda la programación, formato grande, títulos
conciliados entre cadenas y la brecha."""
import sqlite3

import pytest

from analytics import db, distributor_conclusions, distributor_gaps, distributor_reach
from scraper import distributors

COLUMNS = ("chain, cinema_id, screen, date, datetime_local, datetime_utc, city_id, premium_tier, experience, format, "
           "distributor, title_norm")


@pytest.fixture
def conn():
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    c.execute(f"CREATE TABLE current_showtime ({COLUMNS})")
    shows = [
        ("cinemex", "c1", "1", "2026-10-20", "2026-10-20T13:00:00", "2026-10-20T19:00:00Z", "9", "traditional", None, "2D", "Paramount Pictures", "a"),
        ("cinemex", "c1", "2", "2026-10-20", "2026-10-20T15:00:00", "2026-10-20T21:00:00Z", "9", "traditional", "imax", "2D", "Pramount Pictures", "a"),
        ("cinepolis", "c2", "1", "2026-10-20", "2026-10-20T13:00:00", "2026-10-20T19:00:00Z", "9", "traditional", None, "2D", "Paramount", "a"),
        ("cinepolis", "c2", "2", "2026-10-20", "2026-10-20T15:00:00", "2026-10-20T21:00:00Z", "9", "traditional", None, "2D", "1h 40m", "b"),
        ("cinepolis", "c3", "1", "2026-10-20", "2026-10-20T16:00:00", "2026-10-20T22:00:00Z", "9", "traditional", None, "2D", "Riot Games", "c"),
        # El 21: las cadenas no coinciden en Verity, y Cinemex no trae distribuidora de Lalisa.
        ("cinemex", "c1", "1", "2026-10-21", "2026-10-21T13:00:00", "2026-10-21T19:00:00Z", "9", "traditional", None, "2D", "Amazon MGM Studios", "verity"),
        ("cinemex", "c1", "2", "2026-10-21", "2026-10-21T15:00:00", "2026-10-21T21:00:00Z", "9", "traditional", None, "2D", None, "lalisa"),
        ("cinepolis", "c2", "1", "2026-10-21", "2026-10-21T13:00:00", "2026-10-21T19:00:00Z", "9", "traditional", None, "2D", "Universal", "verity"),
        ("cinepolis", "c2", "2", "2026-10-21", "2026-10-21T15:00:00", "2026-10-21T21:00:00Z", "9", "traditional", None, "2D", "Universal", "verity"),
        ("cinepolis", "c2", "3", "2026-10-21", "2026-10-21T17:00:00", "2026-10-21T23:00:00Z", "9", "traditional", None, "2D", "+QueCine", "lalisa"),
    ]
    c.executemany(f"INSERT INTO current_showtime ({COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", shows)
    return db.register(c)


def _row(reach, distributor, chain):
    return next(r for r in reach if r["distributor"] == distributor and r["chain"] == chain)


def test_variants_add_up_and_shares_use_whole_chain_programming(conn):
    reach = distributor_reach(conn, "2026-10-20", "2026-10-20", from_now=False)
    paramount = _row(reach, "Paramount", "cinemex")
    assert (paramount["cinemas"], paramount["screens"], paramount["shows"]) == (1, 2, 2)
    assert paramount["share_shows"] == 100.0
    assert paramount["large_shows"] == 1
    # Cinépolis tiene 3 funciones en la base: el error de fuente cuenta en el denominador, no como distribuidor.
    assert _row(reach, "Paramount", "cinepolis")["share_shows"] == 33.3


def test_error_source_and_nulls_are_not_distributors(conn):
    reach = distributor_reach(conn, "2026-10-20", "2026-10-20", from_now=False)
    assert all(r["distributor"] for r in reach)
    assert not any(r["distributor"] == "1h 40m" for r in reach)


def test_event_is_listed_with_its_kind(conn):
    reach = distributor_reach(conn, "2026-10-20", "2026-10-20", from_now=False)
    assert _row(reach, "Riot Games", "cinepolis")["kind"] == "evento"


def test_one_chain_name_fills_the_other_chain(conn):
    reach = distributor_reach(conn, "2026-10-21", "2026-10-21", from_now=False)
    assert _row(reach, "+QueCine", "cinemex")["shows"] == 1


def test_disagreement_is_unreconciled_and_stays_out_of_the_gap(conn):
    reach = distributor_reach(conn, "2026-10-21", "2026-10-21", from_now=False)
    assert _row(reach, "Amazon MGM Studios", "cinemex")["kind"] == distributors.KIND_UNRECONCILED
    assert _row(reach, "Universal", "cinepolis")["kind"] == distributors.KIND_UNRECONCILED
    gaps = distributor_gaps(conn, "2026-10-21", "2026-10-21", from_now=False)
    assert [g["distributor"] for g in gaps] == ["+QueCine"]
    assert "3 funciones" in distributor_conclusions(conn, "2026-10-21", "2026-10-21", from_now=False)["sin_conciliar"]


def test_table_decides_the_title(conn, monkeypatch):
    monkeypatch.setitem(distributors._TITLES, "verity", "Universal")
    reach = distributor_reach(conn, "2026-10-21", "2026-10-21", from_now=False)
    universal = _row(reach, "Universal", "cinemex")
    assert (universal["kind"], universal["shows"]) == ("distribuidor", 1)
    gap = next(g for g in distributor_gaps(conn, "2026-10-21", "2026-10-21", from_now=False) if g["distributor"] == "Universal")
    assert (gap["share_cinemex"], gap["share_cinepolis"], gap["gap_pp"]) == (50.0, 66.7, -16.7)


def test_conclusion_names_the_largest_gap_but_not_own_programs(conn, monkeypatch):
    monkeypatch.setitem(distributors._TITLES, "verity", "Universal")
    text = distributor_conclusions(conn, "2026-10-21", "2026-10-21", from_now=False)
    assert text["brecha"].startswith("Cinépolis le da a Universal 16.7 pp")
    assert "sin_conciliar" not in text


def test_unreconciled_skips_agreed_and_decided_titles(monkeypatch):
    monkeypatch.setitem(distributors._TITLES, "decided", "Universal")
    names = {"agreed": {"Disney"}, "decided": {"Universal", "Amazon MGM Studios"}, "open": {"Disney", "Diamond Films"}}
    assert distributors.unreconciled(names) == [("open", ["Diamond Films", "Disney"])]
