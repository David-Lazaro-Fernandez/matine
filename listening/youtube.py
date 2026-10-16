"""YouTube Data API v3: el tráiler de una película y sus comentarios. Solo librería estándar.

La cuota gratuita es de 10,000 unidades al día: `search` cuesta 100 y `videos` y `commentThreads`, 1 por llamada.
"""
import json
import re
import urllib.error
import urllib.parse
import urllib.request

from scraper import config

_PAGE_SIZE = 100
_URL = re.compile(r"https?://|www\.", re.IGNORECASE)


class QuotaExceeded(Exception):
    pass


class CommentsDisabled(Exception):
    pass


def _get(path, **params):
    params["key"] = config.youtube_api_key()
    url = f"{config.YOUTUBE_API_URL}/{path}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        reasons = [e.get("reason") for e in json.load(error).get("error", {}).get("errors", [])]
        if "quotaExceeded" in reasons:
            raise QuotaExceeded from error
        if "commentsDisabled" in reasons:
            raise CommentsDisabled from error
        raise


def find_trailer(title):
    """`{"video_id", "video_title"}` del tráiler en español más relevante de `title`, o None si no hay."""
    found = _get("search", part="snippet", q=f"{title} tráiler oficial español", type="video", regionCode="MX",
                 relevanceLanguage="es", maxResults=1)["items"]
    if not found:
        return None
    return {"video_id": found[0]["id"]["videoId"], "video_title": found[0]["snippet"]["title"]}


def stats(video_id):
    """`{"views", "comments_total"}` del video; None en lo que YouTube no publica."""
    video = _get("videos", part="statistics", id=video_id)["items"][0]["statistics"]
    return {"views": _int(video.get("viewCount")), "comments_total": _int(video.get("commentCount"))}


def _int(value):
    return int(value) if value is not None else None


def is_usable(text):
    """Un comentario con texto y sin enlaces; los enlaces son casi siempre spam."""
    return bool(text) and not _URL.search(text)


def comment_pages(video_id, order, pages):
    """Páginas de comentarios de primer nivel, de la más nueva (`order="time"`) o la más relevante
    (`"relevance"`), como listas de `{"comment_id", "text", "likes", "published_at"}`. Es un generador: quien lo
    consume deja de pedir páginas cuando ya no hacen falta."""
    token = None
    for _ in range(pages):
        params = {"part": "snippet", "videoId": video_id, "maxResults": _PAGE_SIZE, "order": order,
                  "textFormat": "plainText"}
        if token:
            params["pageToken"] = token
        page = _get("commentThreads", **params)
        yield [{"comment_id": item["snippet"]["topLevelComment"]["id"],
                "text": " ".join(item["snippet"]["topLevelComment"]["snippet"]["textDisplay"].split()),
                "likes": item["snippet"]["topLevelComment"]["snippet"]["likeCount"],
                "published_at": item["snippet"]["topLevelComment"]["snippet"]["publishedAt"]}
               for item in page["items"]]
        token = page.get("nextPageToken")
        if not token:
            return
