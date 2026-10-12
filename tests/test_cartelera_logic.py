"""Pruebas de la lógica de la cartelera que vive en analytics/: estado de la captura, publicación de la semana,
diferencia del heatmap, orden del dumbbell, preventa por cadena, resumen de precios y ocupación total."""
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest  # noqa: E402

from analytics import presale, queries, seats  # noqa: E402

NOW = datetime(2026, 10, 10, 18, 0, tzinfo=timezone.utc)


def snapshots(*rows):
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("""CREATE TABLE snapshot (id INTEGER PRIMARY KEY, chain TEXT, taken_at TEXT, finished_at TEXT, ok INTEGER,
                    n_shows, n_cinemas, n_events, calls, duration_s, error TEXT)""")
    conn.executemany("INSERT INTO snapshot (chain, taken_at, ok, error) VALUES (?, ?, ?, ?)", rows)
    return conn


def test_capture_status_flags_a_failed_attempt_an_old_capture_and_no_capture():
    conn = snapshots(("cinemex", "2026-10-10T14:00:00+00:00", 1, None),
                     ("cinepolis", "2026-10-09T14:00:00+00:00", 1, None),
                     ("cinepolis", "2026-10-10T14:00:00+00:00", 0, "Blocked"),
                     ("cineteca", "2026-10-09T02:00:00+00:00", 1, None),
                     ("cinery", "2026-10-10T14:00:00+00:00", 0, "Blocked"),
                     ("wtc", "2026-10-10T13:00:00+00:00", 0, "Blocked"),
                     ("wtc", "2026-10-10T14:00:00+00:00", 1, None),
                     ("tonala", "2026-10-10T14:00:00+00:00", 1, None),
                     ("tonala", "2026-10-10T17:30:00+00:00", None, None))
    out = {r["chain"]: r for r in queries.capture_status(conn, now=NOW)}
    assert list(out) == sorted(out)
    assert (out["cinemex"]["stale"], out["cinemex"]["age_min"], out["cinemex"]["error"]) == (False, 240.0, None)
    assert (out["cinepolis"]["stale"], out["cinepolis"]["age_min"], out["cinepolis"]["error"]) == (True, 1680.0, "Blocked")
    assert (out["cineteca"]["stale"], out["cineteca"]["error"]) == (True, None)
    assert (out["cinery"]["stale"], out["cinery"]["last_ok_at"], out["cinery"]["age_min"]) == (True, None, None)
    # Un fallo ya superado por una captura buena no avisa.
    assert out["wtc"]["stale"] is False
    # Una captura en curso no tapa la última buena.
    assert (out["tonala"]["stale"], out["tonala"]["age_min"]) == (False, 240.0)


def test_week_publication_compares_with_the_fullest_day_of_this_week(monkeypatch):
    cov = [{"date": "2026-10-10", "cinemex": 1000, "cinepolis": 900}, {"date": "2026-10-14", "cinemex": 800, "cinepolis": 700},
           {"date": "2026-10-15", "cinemex": 700, "cinepolis": 0}, {"date": "2026-10-16", "cinemex": 400, "cinepolis": 0}]
    monkeypatch.setattr(queries, "today", lambda: "2026-10-10")
    monkeypatch.setattr(queries, "coverage", lambda conn, plaza=None: cov)
    assert queries.week_publication(None, "2026-10-15", "2026-10-21") == "partial"
    cov[3]["cinemex"] = 600
    assert queries.week_publication(None, "2026-10-15", "2026-10-21") == "published"
    assert queries.week_publication(None, "2026-10-22", "2026-10-28") is None


def test_heatmap_gap_counts_a_missing_chain_as_zero():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE current_showtime (chain, date, datetime_local, datetime_utc)")
    shows = [("cinemex", "2026-10-12T15:00:00"), ("cinemex", "2026-10-12T20:00:00"), ("cinemex", "2026-10-12T20:30:00"),
             ("cinepolis", "2026-10-12T20:00:00")]
    conn.executemany("INSERT INTO current_showtime VALUES (?, '2026-10-12', ?, '')", shows)
    cells = queries.heatmap_day_slot(conn, "2026-10-12", "2026-10-12", from_now=False)
    assert [(c["share_cinemex"], c["share_cinepolis"], c["gap_pp"]) for c in cells] == [(33.3, None, 33.3), (66.7, 100.0, -33.3)]


def movie(title, shows_us, shows_them, share_us, share_them):
    gap = round(share_us - share_them, 1) if shows_us and shows_them else None
    return {"title": f" {title} ", "shows_cinemex": shows_us, "shows_cinepolis": shows_them,
            "share_cinemex": share_us if shows_us else None, "share_cinepolis": share_them if shows_them else None, "gap_pp": gap}


def test_movie_gaps_orders_by_gap_and_weighs_an_exclusive_by_its_share(monkeypatch):
    movies = [movie("Pareja", 100, 90, 10.0, 12.0), movie("Nuestra", 50, 0, 5.0, 0), movie("Suya", 0, 40, 0, 4.0),
              movie("Empate A", 30, 30, 3.0, 3.0), movie("Empate B", 20, 20, 2.0, 2.0)]
    monkeypatch.setattr(queries, "movies_by_chain", lambda *a, **k: [dict(m) for m in movies])
    out = queries.movie_gaps(None)
    assert [(m["title"], m["abs_gap"], m["exclusive"], m["leader"]) for m in out] == [
        ("Nuestra", 5.0, "cinemex", "cinemex"), ("Suya", 4.0, "cinepolis", "cinepolis"), ("Pareja", 2.0, None, "cinepolis"),
        ("Empate A", 0.0, None, "cinemex"), ("Empate B", 0.0, None, "cinemex")]


def test_presale_by_chain_has_one_row_per_chain_with_shows(monkeypatch):
    def pair(title, status, shows_us, shows_them):
        return {"title": title, "release_date": None, "status": status,
                "title_norm_cinemex": title.lower() if shows_us else None, "title_norm_cinepolis": title.lower() if shows_them else None,
                "shows_cinemex": shows_us, "shows_cinepolis": shows_them, "sold_cinemex": 1, "sold_cinepolis": 2,
                "seats_cinemex": 10, "seats_cinepolis": 20, "sold_pct_cinemex": 10.0 if shows_us else None,
                "sold_pct_cinepolis": 10.0 if shows_them else None, "pace_pct_day_cinemex": None, "pace_pct_day_cinepolis": 1.5}
    compare = [pair("Ambas", "ambas", 5, 6), pair("Suya", "exclusiva_cinepolis", 0, 7), pair("Nuestra", "solo_cinemex", 8, 0)]
    monkeypatch.setattr(presale, "presale_compare", lambda conn, plaza=None: compare)
    out = presale.presale_by_chain(None)
    assert [(r["title"], r["chain"], r["shows"], r["in_other_chain"]) for r in out] == [
        ("Ambas", "cinemex", 5, "presale"), ("Nuestra", "cinemex", 8, "shown"),
        ("Ambas", "cinepolis", 6, "presale"), ("Suya", "cinepolis", 7, "absent")]
    assert (out[2]["title_norm"], out[2]["seats"], out[2]["pace_pct_day"]) == ("ambas", 20, 1.5)


def price(chain, bucket, day, median, cinemas):
    return {"chain": chain, "format_bucket": bucket, "day_type": day, "median_price": median, "cinemas": cinemas}


def test_price_summary_reports_the_markup_only_when_cinepolis_is_always_higher(monkeypatch):
    rows = [price("cinemex", "traditional", "weekday", 80.0, 30), price("cinemex", "premium", "weekend", 200.0, 12),
            price("cinemex", "3d4d", "weekday", 100.0, 40), price("cinepolis", "traditional", "weekday", 100.0, 25),
            price("cinepolis", "premium", "weekend", 210.0, 20), price("cinepolis", "3d4d", "weekday", 90.0, 20)]
    monkeypatch.setattr(seats, "prices", lambda conn, days=14, plaza=None: rows)
    out = seats.price_summary(None)
    assert out["cinemas"] == {"cinemex": 40, "cinepolis": 25}
    assert (out["markup_min_pct"], out["markup_max_pct"]) == pytest.approx((5.0, 25.0))
    rows[4] = price("cinepolis", "premium", "weekend", 190.0, 20)
    assert seats.price_summary(None)["markup_min_pct"] is None


def test_occupancy_total_weighs_by_seats_and_skips_shows_without_color(monkeypatch):
    levels = [{"availability": "#FFBE06", "samples": 3, "sold": 90, "seats": 100},
              {"availability": "(sin color)", "samples": 1, "sold": 10, "seats": 300}]
    monkeypatch.setattr(seats, "occupancy_summary", lambda conn, chain="cinepolis", phase="post", plaza=None: levels)
    assert seats.occupancy_total(None) == [{"samples": 4, "sold_pct": 25.0, "levels": 1}]
    monkeypatch.setattr(seats, "occupancy_summary", lambda conn, chain="cinepolis", phase="post", plaza=None: [])
    assert seats.occupancy_total(None) == [{"samples": 0, "sold_pct": 0.0, "levels": 0}]
