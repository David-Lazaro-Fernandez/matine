"""`data/listening.db`: comentarios de YouTube, sus predicciones y la medición semanal del modelo (SQLite, WAL).

El único escritor es el trabajo `listening`; `analytics/` la abre en solo lectura. Los cambios de esquema son aditivos.
"""
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from scraper import config

SCHEMA = """
-- El tráiler elegido para una película (`title_key`, la llave común a ambas cadenas).
CREATE TABLE IF NOT EXISTS video (
  video_id TEXT PRIMARY KEY,
  title_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  video_title TEXT,
  comments_disabled INTEGER NOT NULL DEFAULT 0,
  found_at TEXT NOT NULL
);
-- Atención: vistas y comentarios totales del video en cada corrida.
CREATE TABLE IF NOT EXISTS video_stat (
  video_id TEXT NOT NULL,
  taken_at TEXT NOT NULL,
  views INTEGER,
  comments_total INTEGER,
  PRIMARY KEY (video_id, taken_at)
);
CREATE TABLE IF NOT EXISTS comment (
  comment_id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  text TEXT NOT NULL,
  likes INTEGER,
  published_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comment_video ON comment (video_id, published_at);
-- Lo que dijo un modelo (`model`: versión de ambos) de un comentario. `opinion`: pos, neu, neg u otro.
CREATE TABLE IF NOT EXISTS prediction (
  comment_id TEXT NOT NULL,
  model TEXT NOT NULL,
  opinion TEXT NOT NULL,
  opinion_confidence REAL NOT NULL,
  wants_to_see INTEGER NOT NULL,
  wants_confidence REAL NOT NULL,
  classified_at TEXT NOT NULL,
  PRIMARY KEY (comment_id, model)
);
-- Los comentarios que se mandaron a etiquetar cada semana de cine (`week`: su jueves) y con qué modelo se predijeron.
CREATE TABLE IF NOT EXISTS sample (
  week TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  model TEXT NOT NULL,
  PRIMARY KEY (week, comment_id)
);
-- Etiquetas que regresaron de fuera; sirven de entrenamiento si el modelo se reentrena.
CREATE TABLE IF NOT EXISTS review (
  comment_id TEXT PRIMARY KEY,
  week TEXT NOT NULL,
  opinion TEXT NOT NULL,
  wants_to_see INTEGER NOT NULL,
  reviewed_at TEXT NOT NULL
);
-- Coincidencia del modelo con las etiquetas de la semana, y de quien etiquetó con las manuales de control (`gold_*`).
-- `trusted` es 0 si quien etiquetó falló el control y la semana no sirve para juzgar al modelo.
CREATE TABLE IF NOT EXISTS evaluation (
  week TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  n INTEGER NOT NULL,
  opinion_agreement REAL,
  wants_agreement REAL,
  wants_precision REAL,
  wants_recall REAL,
  gold_n INTEGER,
  gold_opinion REAL,
  gold_wants REAL,
  trusted INTEGER NOT NULL,
  evaluated_at TEXT NOT NULL
);
"""


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect(path=None):
    db = Path(path) if path else config.LISTENING_DB_PATH
    db.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA)
    return conn
