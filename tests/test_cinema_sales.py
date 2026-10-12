"""Venta por cine (`analytics/cinema_sales.py`) sobre SQLite en memoria: ranking, ventana contra la anterior, lugares y
duelos de vecinos."""
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analytics import cinema_sales  # noqa: E402

NOW = datetime.now(timezone.utc)


def ago(days):
    return (NOW - timedelta(days=days)).isoformat(timespec="seconds")


def db(cinemas, samples):
    """`cinemas`: (chain, cinema_id, name, lat, lng). `samples`: (chain, cinema_id, días atrás, butacas, vendidas, n)."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE cinema (chain, cinema_id, name, lat, lng, city_id)")
    conn.executemany("INSERT INTO cinema VALUES (?, ?, ?, ?, ?, 'cdmx')", cinemas)
    conn.execute("""CREATE TABLE occupancy_sample (chain, show_id, cinema_id, sampled_at, minutes_to_start, seats, sold)""")
    rows = [(chain, f"{cinema_id}-{days}-{i}", cinema_id, ago(days), -30, seats, sold)
            for chain, cinema_id, days, seats, sold, n in samples for i in range(n)]
    conn.executemany("INSERT INTO occupancy_sample VALUES (?, ?, ?, ?, ?, ?, ?)", rows)
    return conn


CINEMAS = [
    ("cinemex", "1", "Perisur", 19.3040, -99.1900),
    # El Platino comparte edificio con Perisur: cuenta en el mismo lugar.
    ("cinemex", "2", "Perisur Platino", 19.30402, -99.19001),
    ("cinemex", "3", "Lejano", 19.6000, -99.0000),
    ("cinepolis", "a", "Perisur Cinépolis", 19.3050, -99.1910),
]


def test_cinema_occupancy_ranks_and_compares_with_the_previous_window():
    conn = db(CINEMAS, [
        ("cinemex", "1", 1, 100, 10, 50), ("cinemex", "1", 9, 100, 20, 50),
        ("cinemex", "2", 1, 50, 40, 50),
        # Con pocas funciones medidas, el cine no entra al ranking.
        ("cinemex", "3", 1, 100, 90, 10),
        ("cinepolis", "a", 1, 100, 30, 60),
    ])
    out = cinema_sales.cinema_occupancy(conn, days=7)
    assert [(r["cinema_name"], r["sold_pct"]) for r in out] == [
        ("Perisur Platino", 80.0), ("Perisur", 10.0), ("Perisur Cinépolis", 30.0)]
    perisur = next(r for r in out if r["cinema_id"] == "1")
    assert (perisur["sold_pct_prev"], perisur["delta_pp"]) == (20.0, -10.0)
    totals = {r["chain"]: r for r in cinema_sales.chain_occupancy(conn, days=7)}
    # El total de la cadena pondera por butacas e incluye los cines con pocas funciones.
    assert totals["cinemex"]["sold_pct"] == round(100 * (500 + 2000 + 900) / (5000 + 2500 + 1000), 1)


# Dos Cinépolis cerca de Perisur: el más cercano vende poco; el rival número uno es el que más vende, más lejos.
RIVALS = CINEMAS + [("cinepolis", "b", "Mítikah", 19.3200, -99.1900)]


def test_main_rivals_pick_the_strongest_nearby_not_the_nearest():
    conn = db(RIVALS, [
        ("cinemex", "1", 1, 100, 10, 50), ("cinemex", "2", 1, 100, 50, 50),
        ("cinemex", "3", 1, 100, 5, 60),
        ("cinepolis", "a", 1, 100, 10, 60),
        ("cinepolis", "b", 1, 100, 60, 80),
    ])
    rivals = cinema_sales.main_rivals(conn, days=7)
    # Lejano no tiene ningún Cinépolis a 3 km: no tiene rival.
    assert len(rivals) == 1
    rival = rivals[0]
    assert rival["cinemex"]["cinemas"] == ["Perisur", "Perisur Platino"]
    assert (rival["cinepolis"]["name"], rival["rivals"]) == ("Mítikah", 2)
    assert (rival["cinemex"]["sold_pct"], rival["cinepolis"]["sold_pct"], rival["gap_pp"]) == (30.0, 60.0, -30.0)
    assert rival["km"] <= cinema_sales.RIVAL_MAX_KM


def test_competitor_sites_rank_cinepolis_by_tickets_with_our_neighbors():
    conn = db(RIVALS, [
        ("cinemex", "1", 1, 100, 10, 50), ("cinemex", "3", 1, 100, 5, 60),
        ("cinepolis", "a", 1, 100, 10, 60), ("cinepolis", "b", 1, 100, 60, 80),
    ])
    out = cinema_sales.competitor_sites(conn, days=7)
    assert [(r["name"], r["sold"]) for r in out] == [("Mítikah", 4800), ("Perisur Cinépolis", 600)]
    assert [n["name"] for n in out[1]["neighbors"]] == ["Perisur"]
