"""Charlas con el agente de IA: conversaciones, mensajes, auditoría por pregunta y pulgares.

Cada pregunta deja un renglón de `agent_audit` aunque falle. Una charla solo la ve la cuenta que la abrió.
"""
import json
from datetime import datetime, timezone

from .db import one, rows, transaction


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


def audit(conn, user, environment, conversation_id=None, provider=None, tools=(), latency_ms=None,
          tokens_in=None, tokens_out=None, error=None):
    """Registra una pregunta. `tools`: lista de {name, arguments, rows, ms}."""
    conn.execute("""INSERT INTO agent_audit (at, account_id, org_id, role, environment, conversation_id, provider, tools,
                                             latency_ms, tokens_in, tokens_out, error)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                 (_now(), user["id"], user.get("org_id"), user["role"], environment, conversation_id, provider,
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
