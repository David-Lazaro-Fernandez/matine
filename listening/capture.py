"""Baja de YouTube el tráiler de cada película vigente, sus vistas y sus comentarios nuevos a `listening.db`.

Las películas son las de la cartelera (`analytics.movies_by_chain`) y las de preventa de ambas cadenas. El tráiler se
busca una sola vez por película (100 unidades de cuota). Después cada corrida lee las vistas y los comentarios más nuevos
hasta topar con uno que ya tiene. Un video nuevo trae además la primera página de los más relevantes, que es lo que
alimentó el entrenamiento. Si la cuota del día se agota, la corrida sale con 1 y la siguiente retoma lo que faltó.

Uso: python3 -m listening.capture [--titles N]
"""
import argparse
import sys
import urllib.error

import analytics
from scraper import config

from . import store, youtube

# Un video con más comentarios nuevos que esto entre dos corridas pierde los más viejos.
_NEW_PAGES = 3


def wanted_titles(limit):
    """{title_key: título} de las `limit` películas con más funciones y de las que están en preventa."""
    conn = analytics.connect()
    try:
        found = {r["title_norm"]: r["title"] for r in analytics.movies_by_chain(conn, limit=limit)}
        for chain in ("cinemex", "cinepolis"):
            for r in analytics.presale_ranking(conn, chain=chain):
                found.setdefault(r["title_norm"], r["title"])
    finally:
        conn.close()
    return found


def _video(conn, title_key, title):
    """El video guardado de la película, o el que se acaba de buscar; None si YouTube no tiene tráiler."""
    row = conn.execute("SELECT * FROM video WHERE title_key = ?", (title_key,)).fetchone()
    if row:
        return row, False
    trailer = youtube.find_trailer(title)
    if trailer is None:
        return None, False
    conn.execute("INSERT INTO video (video_id, title_key, title, video_title, found_at) VALUES (?, ?, ?, ?, ?)",
                 (trailer["video_id"], title_key, title, trailer["video_title"], store.now()))
    return conn.execute("SELECT * FROM video WHERE title_key = ?", (title_key,)).fetchone(), True


def _save_comments(conn, video_id, order, pages):
    added = 0
    for page in youtube.comment_pages(video_id, order, pages):
        known = {r[0] for r in conn.execute(
            f"SELECT comment_id FROM comment WHERE comment_id IN ({','.join('?' * len(page))})",
            [c["comment_id"] for c in page])}
        fresh = [c for c in page if c["comment_id"] not in known and youtube.is_usable(c["text"])]
        conn.executemany(
            "INSERT OR IGNORE INTO comment (comment_id, video_id, text, likes, published_at, fetched_at) "
            "VALUES (:comment_id, :video_id, :text, :likes, :published_at, :fetched_at)",
            [{**c, "video_id": video_id, "fetched_at": store.now()} for c in fresh])
        added += len(fresh)
        if known:
            break
    return added


def capture_title(conn, title_key, title):
    """Guarda las vistas y los comentarios nuevos de una película; devuelve cuántos comentarios entraron."""
    video, is_new = _video(conn, title_key, title)
    if video is None:
        return None
    added = 0
    if not video["comments_disabled"]:
        try:
            added = _save_comments(conn, video["video_id"], "time", _NEW_PAGES)
            if is_new:
                added += _save_comments(conn, video["video_id"], "relevance", 1)
        except youtube.CommentsDisabled:
            conn.execute("UPDATE video SET comments_disabled = 1 WHERE video_id = ?", (video["video_id"],))
    stats = youtube.stats(video["video_id"])
    conn.execute("INSERT OR REPLACE INTO video_stat (video_id, taken_at, views, comments_total) VALUES (?, ?, ?, ?)",
                 (video["video_id"], store.now(), stats["views"], stats["comments_total"]))
    conn.commit()
    return added


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--titles", type=int, default=config.LISTENING_TITLES)
    args = ap.parse_args(argv)
    if not config.youtube_api_key():
        print("Falta YOUTUBE_DATA_API_KEY en el entorno o en .env.", file=sys.stderr)
        return 1
    conn = store.connect()
    code = 0
    for title_key, title in wanted_titles(args.titles).items():
        try:
            added = capture_title(conn, title_key, title)
        except youtube.QuotaExceeded:
            print("Cuota diaria de YouTube agotada; la siguiente corrida retoma lo que falta.", file=sys.stderr)
            code = 1
            break
        except urllib.error.HTTPError as error:
            print(f"{title}: error {error.code}", file=sys.stderr)
            continue
        print(f"{title}: " + ("sin tráiler" if added is None else f"{added} comentarios nuevos"))
    conn.close()
    return code


if __name__ == "__main__":
    sys.exit(main())
