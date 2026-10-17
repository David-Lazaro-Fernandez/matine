"""Aparta la muestra de la semana de cine para etiquetarla fuera del repo.

Escribe `data/listening/muestra_AAAA-MM-DD.csv` (la fecha es el jueves de la semana) con comentarios al azar,
repartidos entre películas, y mezcladas las etiquetas manuales de control de `training/etiquetas_manuales.csv`, para
que quien etiquete no sepa cuáles son. Nunca entran a la muestra comentarios del entrenamiento ni de una muestra
anterior. Las columnas `opinion` y `quiere_verla` salen vacías, con el formato del conjunto de entrenamiento. La
etiquetada se mide con `listening.compare`.

Uso: python3 -m listening.sample [--size N]
"""
import argparse
import csv
import random
import sys
from datetime import date

import analytics
from scraper import config

from . import store

COLUMNS = ["comment_id", "pelicula", "comentario", "opinion", "quiere_verla"]
GOLD_PATH = config.TRAINING_DIR / "etiquetas_manuales.csv"
_TRAINING_PATH = config.TRAINING_DIR / "etiquetas_v3.csv"


def current_week():
    """El jueves de la semana de cine en curso, como `AAAA-MM-DD`."""
    return analytics.cinema_week(date.today().isoformat())[0]


def read_ids(path):
    """Los `comment_id` de un CSV de etiquetas; vacío si el archivo no existe."""
    if not path.exists():
        return set()
    with open(path, newline="", encoding="utf-8") as handle:
        return {row["comment_id"] for row in csv.DictReader(handle)}


def spread(by_video, size, rng):
    """Hasta `size` comentarios al azar, uno por película a la vez, para que un tráiler muy comentado no domine."""
    queues = {video: rng.sample(items, len(items)) for video, items in sorted(by_video.items())}
    videos = sorted(queues)
    rng.shuffle(videos)
    picked = []
    while len(picked) < size and any(queues.values()):
        for video in videos:
            if queues[video] and len(picked) < size:
                picked.append(queues[video].pop())
    return picked


def pick(conn, model, size, rng):
    """Comentarios predichos por `model` que nunca estuvieron en el entrenamiento ni en una muestra."""
    excluded = read_ids(_TRAINING_PATH) | read_ids(GOLD_PATH)
    by_video = {}
    for row in conn.execute("""
            SELECT c.comment_id, c.text, v.title, v.video_id FROM comment c
            JOIN video v ON v.video_id = c.video_id
            JOIN prediction p ON p.comment_id = c.comment_id AND p.model = ?
            WHERE c.comment_id NOT IN (SELECT comment_id FROM sample)
            ORDER BY c.comment_id""", (model,)):
        if row["comment_id"] not in excluded:
            by_video.setdefault(row["video_id"], []).append(row)
    return spread(by_video, size, rng)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--size", type=int, default=config.LISTENING_SAMPLE_SIZE)
    args = ap.parse_args(argv)
    week = current_week()
    path = config.LISTENING_DIR / f"muestra_{week}.csv"
    conn = store.connect()
    if conn.execute("SELECT 1 FROM sample WHERE week = ?", (week,)).fetchone():
        print(f"La muestra de la semana {week} ya existe: {path}")
        return 0
    latest = conn.execute("SELECT model FROM prediction ORDER BY classified_at DESC LIMIT 1").fetchone()
    if latest is None:
        print("No hay comentarios clasificados todavía.", file=sys.stderr)
        return 1
    rng = random.Random(week)
    chosen = pick(conn, latest["model"], args.size, rng)
    rows = [{"comment_id": r["comment_id"], "pelicula": r["title"], "comentario": r["text"], "opinion": "",
             "quiere_verla": ""} for r in chosen]
    if GOLD_PATH.exists():
        with open(GOLD_PATH, newline="", encoding="utf-8") as handle:
            rows += [{**{c: row[c] for c in COLUMNS[:3]}, "opinion": "", "quiere_verla": ""}
                     for row in csv.DictReader(handle)]
    else:
        print(f"Sin {GOLD_PATH}: la muestra no lleva etiquetas de control.", file=sys.stderr)
    rng.shuffle(rows)
    config.LISTENING_DIR.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    conn.executemany("INSERT INTO sample (week, comment_id, model) VALUES (?, ?, ?)",
                     [(week, r["comment_id"], latest["model"]) for r in chosen])
    conn.commit()
    movies = len({r["video_id"] for r in chosen})
    print(f"{len(chosen)} comentarios de {movies} películas y {len(rows) - len(chosen)} de control: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
