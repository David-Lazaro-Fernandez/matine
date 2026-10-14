"""Base de cuentas del dashboard: SQLite en `config.APP_DB_PATH` (`data/app.db`), separada de `snapshots.db`.

`snapshots.db` la escribe solo la captura y el dashboard la abre en solo lectura; `app.db` la escribe solo `auth/`
(desde el dashboard y desde `auth.cli`). El esquema se crea al conectar (`CREATE TABLE IF NOT EXISTS`, aditivo, como
`scraper/store.py`). Varias sesiones de Streamlit escriben a la vez: WAL y `busy_timeout` las serializan.

Las fechas se guardan como texto ISO en UTC con microsegundos fijos, así las comparaciones de SQL entre textos son
cronológicas; al leer, las columnas `*_at` y `locked_until` vuelven como `datetime` y las banderas como `bool`.
"""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from scraper import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS account (              -- `account` y no `user`: el nombre que ya usa el resto de auth/
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('staff', 'admin', 'analyst', 'viewer')),
  password_hash   TEXT,                           -- NULL hasta que acepte la invitación (auth.security.hash_password)
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  created_by      INTEGER REFERENCES account,     -- NULL: creada desde la línea de comandos
  last_login_at   TEXT,
  failed_logins   INTEGER NOT NULL DEFAULT 0,     -- intentos fallidos seguidos; se reinicia al entrar
  last_failed_at  TEXT,
  locked_until    TEXT                            -- bloqueo temporal tras demasiados fallos
);
CREATE UNIQUE INDEX IF NOT EXISTS account_email_key ON account (lower(email));

CREATE TABLE IF NOT EXISTS session (              -- una fila por cookie emitida; solo se guarda el hash del token
  token_hash    TEXT PRIMARY KEY,                 -- sha256 hex del valor de la cookie
  account_id    INTEGER NOT NULL REFERENCES account,
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  expires_at    TEXT NOT NULL,                    -- deslizante: se extiende con el uso
  revoked_at    TEXT,                             -- cierre de sesión, cambio de contraseña o desactivación
  ip            TEXT,
  user_agent    TEXT
);
CREATE INDEX IF NOT EXISTS session_account ON session (account_id);
CREATE INDEX IF NOT EXISTS session_expires ON session (expires_at);

CREATE TABLE IF NOT EXISTS token (                -- enlaces de invitación y de restablecimiento: un solo uso
  token_hash  TEXT PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES account,
  purpose     TEXT NOT NULL CHECK (purpose IN ('invite', 'reset')),
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_by  INTEGER REFERENCES account          -- NULL: lo pidió el propio usuario desde "olvidé mi contraseña"
);
CREATE INDEX IF NOT EXISTS token_account ON token (account_id, purpose, created_at);

CREATE TABLE IF NOT EXISTS audit (                -- quién hizo qué: altas, cambios de rol, accesos y cierres
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL,
  actor_id   INTEGER REFERENCES account,          -- NULL: la línea de comandos o el propio flujo público
  action     TEXT NOT NULL,                       -- create, invite, resend, activate, deactivate, set_role, …
  target_id  INTEGER REFERENCES account,
  detail     TEXT                                 -- JSON
);
CREATE INDEX IF NOT EXISTS audit_at ON audit (at);

CREATE TABLE IF NOT EXISTS organization (         -- un cliente: lo que contrató y su logo
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  modules     TEXT NOT NULL DEFAULT '[]',         -- JSON con claves de MODULES
  logo        TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_conversation (   -- una charla de una cuenta con el agente
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  INTEGER NOT NULL REFERENCES account,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_conversation_account ON agent_conversation (account_id, created_at);

CREATE TABLE IF NOT EXISTS agent_message (        -- cada pregunta y cada respuesta de una charla
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id  INTEGER NOT NULL REFERENCES agent_conversation,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_message_conversation ON agent_message (conversation_id, id);

CREATE TABLE IF NOT EXISTS agent_audit (          -- un renglón por pregunta: quién, con qué herramientas y a qué costo
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  at               TEXT NOT NULL,
  account_id       INTEGER NOT NULL REFERENCES account,
  org_id           INTEGER REFERENCES organization,
  role             TEXT NOT NULL,
  environment      TEXT NOT NULL,
  conversation_id  INTEGER REFERENCES agent_conversation,
  provider         TEXT,
  tools            TEXT NOT NULL DEFAULT '[]',    -- JSON: [{name, arguments, rows, ms}]
  latency_ms       INTEGER,
  tokens_in        INTEGER,
  tokens_out       INTEGER,
  error            TEXT
);
CREATE INDEX IF NOT EXISTS agent_audit_at ON agent_audit (at);

CREATE TABLE IF NOT EXISTS agent_feedback (       -- el pulgar de una respuesta
  message_id  INTEGER PRIMARY KEY REFERENCES agent_message,
  account_id  INTEGER NOT NULL REFERENCES account,
  useful      INTEGER NOT NULL CHECK (useful IN (0, 1)),
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS setting (              -- ajustes de toda la instancia; el logo vive en `organization`
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TEXT NOT NULL,
  updated_by  INTEGER REFERENCES account
);
"""

# Columnas de `account` posteriores a la primera versión. `CREATE TABLE IF NOT EXISTS` no las agrega a una base que
# ya existe, así que `connect` las agrega con `ALTER TABLE`.
_ACCOUNT_COLUMNS = {"avatar": "TEXT", "theme": "TEXT NOT NULL DEFAULT 'system'",
                    "org_id": "INTEGER REFERENCES organization"}
# Columnas de `organization` posteriores a la primera versión (mismo mecanismo que `account`). `integrations` guarda
# el JSON de `auth/orgs.py` (webhook de Slack, destinatarios del resumen y su estado de envío). `seats` y
# `next_billing_at` (ISO, UTC) los fija staff; NULL es una organización sin suscripción.
# `agent_provider` y `agent_key` (cifrada por `auth/secrets.py`) son el proveedor de IA de la organización.
_ORG_COLUMNS = {"integrations": "TEXT NOT NULL DEFAULT '{}'", "seats": "INTEGER", "next_billing_at": "TEXT",
                "agent_provider": "TEXT", "agent_key": "TEXT"}
_OLD_ROLE_CHECK = "CHECK (role IN ('admin', 'viewer'))"
_ROLE_CHECK = "CHECK (role IN ('staff', 'admin', 'analyst', 'viewer'))"
# Lo que se contrata por separado. "Completo" son todos.
MODULES = ("cartelera", "dulceria", "distribuidores", "datos", "agente")
# La organización de las cuentas anteriores a `organization`: el cliente del piloto, con todos los módulos.
DEFAULT_ORG_ID = 1

_BOOLEANS = {"active", "has_password", "pending_invite"}


def iso(when):
    """Instante como texto ISO en UTC con microsegundos: el formato con el que se guardan y comparan las fechas."""
    return when.astimezone(timezone.utc).isoformat(timespec="microseconds")


sqlite3.register_adapter(datetime, iso)


def _row(cursor, values):
    out = {}
    for (name, *_), value in zip(cursor.description, values):
        if isinstance(value, str) and (name.endswith("_at") or name == "locked_until"):
            value = datetime.fromisoformat(value)
        elif name in _BOOLEANS and value is not None:
            value = bool(value)
        out[name] = value
    return out


def connect(path=None):
    """Conexión en autocommit (cada sentencia suelta se confirma sola); `transaction(conn)` agrupa las escrituras de
    un flujo. Crea el archivo y el esquema si no existen."""
    db = path or config.APP_DB_PATH
    db.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db, timeout=30, isolation_level=None, check_same_thread=False)
    conn.row_factory = _row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA)
    _widen_roles(conn)
    _add_columns(conn)
    _default_org(conn)
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _widen_roles(conn):
    # SQLite no cambia un CHECK con ALTER TABLE: se copia la tabla con el CHECK nuevo. Va antes de activar
    # foreign_keys para que el DROP no toque `session`, `token` ni `audit`.
    sql = one(conn, "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'account'")["sql"]
    if _OLD_ROLE_CHECK not in sql:
        return
    with transaction(conn):
        conn.execute(sql.replace(_OLD_ROLE_CHECK, _ROLE_CHECK).replace("account", "account_new", 1))
        conn.execute("INSERT INTO account_new SELECT * FROM account")
        conn.execute("DROP TABLE account")
        conn.execute("ALTER TABLE account_new RENAME TO account")
    conn.executescript(SCHEMA)


def _default_org(conn):
    # Pasa a la organización del piloto las cuentas sin organización y el logo que era global.
    pending = one(conn, """SELECT NOT EXISTS (SELECT 1 FROM organization WHERE id = ?)
                                  OR EXISTS (SELECT 1 FROM account WHERE org_id IS NULL)
                                  OR EXISTS (SELECT 1 FROM setting WHERE key = 'logo') AS n""", (DEFAULT_ORG_ID,))["n"]
    if not pending:
        return
    with transaction(conn):
        conn.execute("INSERT OR IGNORE INTO organization (id, name, modules, created_at) VALUES (?, ?, ?, ?)",
                     (DEFAULT_ORG_ID, "Cinemex", json.dumps(MODULES), datetime.now(timezone.utc)))
        conn.execute("UPDATE account SET org_id = ? WHERE org_id IS NULL", (DEFAULT_ORG_ID,))
        logo = one(conn, "SELECT value FROM setting WHERE key = 'logo'")
        if logo:
            conn.execute("UPDATE organization SET logo = ? WHERE id = ?", (logo["value"], DEFAULT_ORG_ID))
            conn.execute("DELETE FROM setting WHERE key = 'logo'")


def _add_columns(conn):
    for table, columns in (("account", _ACCOUNT_COLUMNS), ("organization", _ORG_COLUMNS)):
        present = {column["name"] for column in conn.execute(f"PRAGMA table_info({table})")}
        for name, declaration in columns.items():
            if name in present:
                continue
            try:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {declaration}")
            # Otro proceso pudo agregar la columna entre la lectura y el ALTER.
            except sqlite3.OperationalError as e:
                if "duplicate column" not in str(e):
                    raise


@contextmanager
def transaction(conn):
    """Agrupa escrituras en una transacción que toma el candado de escritura al empezar (`BEGIN IMMEDIATE`), para
    que dos sesiones que entran a la vez no choquen a la mitad. Confirma al salir o deshace si hubo excepción."""
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    conn.execute("COMMIT")


@contextmanager
def cursor(conn):
    """Cursor para varias sentencias seguidas (`cur.fetchone()`, `cur.rowcount`), con la forma `with … as cur`."""
    cur = conn.cursor()
    try:
        yield cur
    finally:
        cur.close()


def rows(conn, sql, params=()):
    return conn.execute(sql, params).fetchall()


def one(conn, sql, params=()):
    return conn.execute(sql, params).fetchone()
