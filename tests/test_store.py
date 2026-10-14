"""`scraper.store.analyze`: las estadísticas del planificador sobre la captura grabada."""
from scraper import store


def _indexed_tables(conn):
    return {r[0] for r in conn.execute("SELECT tbl FROM sqlite_stat1")}


def test_analyze_records_the_statistics_of_the_event_indexes(capture_db):
    conn = capture_db("cinemex", "cinepolis")
    assert not conn.execute("SELECT 1 FROM sqlite_master WHERE name = 'sqlite_stat1'").fetchone()
    store.analyze(conn)
    assert {"event", "current_showtime"} <= _indexed_tables(conn)
