"""Escucha social (`listening/`): captura incremental, muestra semanal y medición, con una base temporal y sin red."""
import csv
import random
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from listening import capture, compare, sample, store, youtube  # noqa: E402


@pytest.fixture
def conn(tmp_path):
    c = store.connect(tmp_path / "listening.db")
    yield c
    c.close()


def _comment(i, text="Se ve bien"):
    return {"comment_id": f"c{i}", "text": text, "likes": 0, "published_at": f"2026-10-{20 - i:02d}T00:00:00Z"}


def _fake_youtube(monkeypatch, pages_by_order):
    calls = []
    monkeypatch.setattr(youtube, "find_trailer", lambda title: {"video_id": "v1", "video_title": f"{title} tráiler"})
    monkeypatch.setattr(youtube, "stats", lambda video_id: {"views": 10, "comments_total": 3})

    def pages(video_id, order, count):
        calls.append(order)
        yield from pages_by_order[order][:count]

    monkeypatch.setattr(youtube, "comment_pages", pages)
    return calls


def test_capture_stops_at_the_first_known_comment_and_skips_links(conn, monkeypatch):
    pages = {"time": [[_comment(1), _comment(2, "mira https://spam.com")], [_comment(3)]], "relevance": [[_comment(1)]]}
    calls = _fake_youtube(monkeypatch, pages)
    assert capture.capture_title(conn, "madre", "Madre") == 2
    assert calls == ["time", "relevance"]
    # Segunda corrida: la primera página ya tiene c1, así que no guarda la segunda ni pide los relevantes.
    pages["time"] = [[_comment(4), _comment(1)], [_comment(5)]]
    calls.clear()
    assert capture.capture_title(conn, "madre", "Madre") == 1
    assert calls == ["time"]
    ids = {r[0] for r in conn.execute("SELECT comment_id FROM comment")}
    assert ids == {"c1", "c3", "c4"}
    assert conn.execute("SELECT COUNT(*) FROM video").fetchone()[0] == 1


def test_capture_marks_a_video_with_comments_disabled_once(conn, monkeypatch):
    _fake_youtube(monkeypatch, {})

    def disabled(video_id, order, count):
        raise youtube.CommentsDisabled
        yield

    monkeypatch.setattr(youtube, "comment_pages", disabled)
    assert capture.capture_title(conn, "madre", "Madre") == 0
    assert conn.execute("SELECT comments_disabled FROM video").fetchone()[0] == 1
    # Ya marcado, no vuelve a pedir comentarios.
    monkeypatch.setattr(youtube, "comment_pages", lambda *a: pytest.fail("pidió comentarios"))
    assert capture.capture_title(conn, "madre", "Madre") == 0


def test_spread_takes_one_per_movie_at_a_time():
    by_video = {"a": list(range(50)), "b": list(range(50)), "c": [0]}
    picked = sample.spread(by_video, 10, random.Random(1))
    assert len(picked) == 10
    assert 0 in picked and sum(1 for p in picked if p == 0) >= 1
    assert len(sample.spread({"a": [1, 2]}, 10, random.Random(1))) == 2


def _seed_predictions(conn, n=6):
    conn.execute("INSERT INTO video VALUES ('v1', 'madre', 'Madre', 'T', 0, 'x')")
    for i in range(n):
        conn.execute("INSERT INTO comment VALUES (?, 'v1', ?, 0, 'x', 'x')", (f"c{i}", f"texto {i}"))
        conn.execute("INSERT INTO prediction VALUES (?, 'm1', 'pos', 0.9, ?, 0.9, 'x')", (f"c{i}", int(i == 0)))
    conn.commit()


def test_pick_excludes_training_gold_and_previous_samples(conn, tmp_path, monkeypatch):
    _seed_predictions(conn)
    train = tmp_path / "train.csv"
    train.write_text("comment_id\nc1\n", encoding="utf-8")
    gold = tmp_path / "gold.csv"
    gold.write_text("comment_id\nc2\n", encoding="utf-8")
    monkeypatch.setattr(sample, "_TRAINING_PATH", train)
    monkeypatch.setattr(sample, "GOLD_PATH", gold)
    conn.execute("INSERT INTO sample VALUES ('2026-10-08', 'c3', 'm1')")
    ids = {r["comment_id"] for r in sample.pick(conn, "m1", 10, random.Random(1))}
    assert ids == {"c0", "c4", "c5"}


def test_compare_scores_the_model_and_distrusts_a_labeler_that_fails_the_control(conn, tmp_path, monkeypatch):
    _seed_predictions(conn, 4)
    conn.executemany("INSERT INTO sample VALUES ('2026-10-15', ?, 'm1')", [(f"c{i}",) for i in range(4)])
    conn.commit()
    gold = tmp_path / "gold.csv"
    gold.write_text("comment_id,opinion,quiere_verla\ng1,pos,si\ng2,neg,no\n", encoding="utf-8")
    monkeypatch.setattr(sample, "GOLD_PATH", gold)
    monkeypatch.setattr(store, "connect", lambda: conn)
    labeled = tmp_path / "labeled.csv"

    def write(rows):
        with open(labeled, "w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["comment_id", "pelicula", "comentario", "opinion", "quiere_verla"])
            writer.writerows([[i, "", "", o, w] for i, o, w in rows])

    rows = [("c0", "pos", "si"), ("c1", "pos", "nd"), ("c2", "neu", "nd"), ("c3", "pos", "nd")]
    write(rows + [("g1", "pos", "si"), ("g2", "neg", "no")])
    assert compare.main([str(labeled)]) == 0
    row = conn.execute("SELECT * FROM evaluation").fetchone()
    assert (row["n"], row["opinion_agreement"], row["wants_agreement"], row["trusted"]) == (4, 0.75, 1.0, 1)
    assert row["wants_precision"] == 1.0 and row["wants_recall"] == 1.0
    assert conn.execute("SELECT COUNT(*) FROM review").fetchone()[0] == 4
    write(rows + [("g1", "neg", "si"), ("g2", "pos", "no")])
    compare.main([str(labeled)])
    assert conn.execute("SELECT trusted FROM evaluation").fetchone()[0] == 0
