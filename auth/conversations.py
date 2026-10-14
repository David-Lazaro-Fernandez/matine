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
    return one(conn, "INSERT INTO agent_conversation (account_id, created_at) VALUES (?, ?) RETURNING id",
               (account_id, _now()))["id"]


def owns(conn, account_id, conversation_id):
    """Si la charla existe y es de la cuenta."""
    return one(conn, "SELECT 1 AS ok FROM agent_conversation WHERE id = ? AND account_id = ?",
               (conversation_id, account_id)) is not None


def add_message(conn, conversation_id, role, content):
    """Guarda un mensaje (`role`: `user` o `assistant`) y devuelve su id."""
    return one(conn, """INSERT INTO agent_message (conversation_id, role, content, created_at)
                        VALUES (?, ?, ?, ?) RETURNING id""", (conversation_id, role, content, _now()))["id"]


def history(conn, account_id, conversation_id):
    """Los mensajes de una charla de la cuenta, en orden. Una charla ajena o inexistente da lista vacía."""
    return rows(conn, """SELECT m.id, m.role, m.content, m.created_at
                         FROM agent_message m JOIN agent_conversation c ON c.id = m.conversation_id
                         WHERE c.id = ? AND c.account_id = ? ORDER BY m.id""", (conversation_id, account_id))


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
