"""Charlas con el agente de IA: conversaciones, mensajes, auditoría por pregunta y pulgares.

Cada pregunta deja un renglón de `agent_audit` aunque falle. Una charla solo la ve la cuenta que la abrió.
"""
import json
from datetime import datetime, timedelta, timezone

from .db import cursor, one, rows, transaction


def _now():
    return datetime.now(timezone.utc)


def start(conn, account_id):
    """Abre una charla y devuelve su id."""
    now = _now()
    return one(conn, "INSERT INTO agent_conversation (account_id, created_at, updated_at) VALUES (?, ?, ?) RETURNING id",
               (account_id, now, now))["id"]


def owns(conn, account_id, conversation_id):
    """Si la charla existe y es de la cuenta."""
    return one(conn, "SELECT 1 AS ok FROM agent_conversation WHERE id = ? AND account_id = ?",
               (conversation_id, account_id)) is not None


# Largo del título de una conversación: la primera pregunta, recortada.
TITLE_CHARS = 60


def _title(question):
    text = " ".join(question.split())
    return text if len(text) <= TITLE_CHARS else text[:TITLE_CHARS - 1].rstrip() + "…"


def add_message(conn, conversation_id, role, content, tools=None):
    """Guarda un mensaje (`role`: `user` o `assistant`) y devuelve su id. `tools`: lo que consultó una respuesta
    (`{name, arguments, rows, ms, sources}`). El primer mensaje del usuario da título a la conversación."""
    now = _now()
    with transaction(conn):
        message_id = one(conn, """INSERT INTO agent_message (conversation_id, role, content, created_at, tools)
                                  VALUES (?, ?, ?, ?, ?) RETURNING id""",
                         (conversation_id, role, content, now, json.dumps(tools, default=str) if tools else None))["id"]
        conn.execute("UPDATE agent_conversation SET updated_at = ?, title = coalesce(title, ?) WHERE id = ?",
                     (now, _title(content) if role == "user" else None, conversation_id))
    return message_id


def history(conn, account_id, conversation_id):
    """Los mensajes de una charla de la cuenta, en orden: `id`, `role`, `content`, `created_at`, `tools` (lista o None) y
    `useful` (el pulgar, o None). Una charla ajena o inexistente da lista vacía."""
    found = rows(conn, """SELECT m.id, m.role, m.content, m.created_at, m.tools, f.useful
                          FROM agent_message m JOIN agent_conversation c ON c.id = m.conversation_id
                          LEFT JOIN agent_feedback f ON f.message_id = m.id
                          WHERE c.id = ? AND c.account_id = ? ORDER BY m.id""", (conversation_id, account_id))
    return [{**m, "tools": json.loads(m["tools"]) if m["tools"] else None,
             "useful": None if m["useful"] is None else bool(m["useful"])} for m in found]


# ponytail: la lista llega entera hasta este tope; paginar cuando alguien tenga más conversaciones.
LIST_LIMIT = 200


def recent(conn, account_id):
    """Las conversaciones de la cuenta, de la más reciente a la más antigua: `id`, `title` y `updated_at`."""
    return rows(conn, """SELECT id, title, updated_at FROM agent_conversation WHERE account_id = ? AND title IS NOT NULL
                         ORDER BY updated_at DESC, id DESC LIMIT ?""", (account_id, LIST_LIMIT))


def delete(conn, account_id, conversation_id):
    """Borra una conversación de la cuenta con sus mensajes y pulgares. La auditoría se queda sin la referencia, porque no
    guarda texto. False si la conversación no es de la cuenta."""
    if not owns(conn, account_id, conversation_id):
        return False
    with transaction(conn):
        conn.execute("""DELETE FROM agent_feedback WHERE message_id IN
                        (SELECT id FROM agent_message WHERE conversation_id = ?)""", (conversation_id,))
        conn.execute("DELETE FROM agent_message WHERE conversation_id = ?", (conversation_id,))
        conn.execute("UPDATE agent_audit SET conversation_id = NULL WHERE conversation_id = ?", (conversation_id,))
        conn.execute("DELETE FROM agent_conversation WHERE id = ?", (conversation_id,))
    return True


def audit(conn, user, environment, conversation_id=None, provider=None, model=None, tools=(), latency_ms=None,
          tokens_in=None, tokens_out=None, error=None):
    """Registra una pregunta. `tools`: lista de {name, arguments, rows, ms}."""
    conn.execute("""INSERT INTO agent_audit (at, account_id, org_id, role, environment, conversation_id, provider, model,
                                             tools, latency_ms, tokens_in, tokens_out, error)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                 (_now(), user["id"], user.get("org_id"), user["role"], environment, conversation_id, provider, model,
                  json.dumps(list(tools), default=str), latency_ms, tokens_in, tokens_out, error))


def set_feedback(conn, account_id, message_id, useful):
    """Guarda el pulgar de una respuesta del asistente de la cuenta. False si el mensaje no es suyo."""
    with transaction(conn):
        mine = one(conn, """SELECT 1 AS ok FROM agent_message m JOIN agent_conversation c ON c.id = m.conversation_id
                            WHERE m.id = ? AND m.role = 'assistant' AND c.account_id = ?""", (message_id, account_id))
        if not mine:
            return False
        conn.execute("""INSERT INTO agent_feedback (message_id, account_id, useful, created_at) VALUES (?, ?, ?, ?)
                        ON CONFLICT (message_id) DO UPDATE SET useful = excluded.useful""",
                     (message_id, account_id, int(bool(useful)), _now()))
    return True


def questions_since(conn, account_id, since):
    """Preguntas que hizo la cuenta desde `since` (datetime), con o sin respuesta."""
    return one(conn, "SELECT count(*) AS n FROM agent_audit WHERE account_id = ? AND at >= ?",
               (account_id, since))["n"]


def tokens_since(conn, org_id, since):
    """Tokens de entrada y salida que gastó la organización desde `since` (datetime)."""
    return one(conn, """SELECT coalesce(sum(tokens_in), 0) + coalesce(sum(tokens_out), 0) AS n
                        FROM agent_audit WHERE org_id = ? AND at >= ?""", (org_id, since))["n"]


# Las conversaciones se conservan 12 meses sin actividad. La auditoría no guarda texto y se queda: de ella salen las
# estadísticas de uso.
RETENTION_DAYS = 365


def prune(conn, now=None):
    """Borra las conversaciones sin actividad en `RETENTION_DAYS` días, con sus mensajes y pulgares. Devuelve cuántas."""
    cutoff = (now or _now()) - timedelta(days=RETENTION_DAYS)
    old = """SELECT c.id FROM agent_conversation c
             WHERE coalesce((SELECT max(m.created_at) FROM agent_message m WHERE m.conversation_id = c.id), c.created_at) < ?"""
    with transaction(conn):
        conn.execute(f"""DELETE FROM agent_feedback WHERE message_id IN
                         (SELECT m.id FROM agent_message m WHERE m.conversation_id IN ({old}))""", (cutoff,))
        conn.execute(f"DELETE FROM agent_message WHERE conversation_id IN ({old})", (cutoff,))
        # La auditoría se queda sin la referencia: lo que apuntaba a la conversación ya no existe.
        conn.execute(f"UPDATE agent_audit SET conversation_id = NULL WHERE conversation_id IN ({old})", (cutoff,))
        with cursor(conn) as cur:
            cur.execute(f"DELETE FROM agent_conversation WHERE id IN ({old})", (cutoff,))
            return cur.rowcount
