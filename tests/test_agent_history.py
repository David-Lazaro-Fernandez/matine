"""Historial del asistente: lista de conversaciones con título, reabrir una con lo que consultó y su pulgar, y borrarla."""
import hashlib

import pytest

pytest.importorskip("fastapi")
if not hasattr(hashlib, "scrypt"):
    pytest.skip("sin hashlib.scrypt", allow_module_level=True)
from fastapi.testclient import TestClient  # noqa: E402

from api import internal  # noqa: E402
from auth import conversations, db, flows  # noqa: E402
from scraper import config  # noqa: E402

PASSWORD = "contraseña-de-pruebas-123"
TOOLS = [{"name": "get_title_screens", "arguments": {"plaza": "cdmx"}, "rows": 3, "ms": 40,
          "sources": [{"dataset": "week_showtimes", "plaza": "cdmx"}]}]


@pytest.fixture
def conn(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "APP_DB_PATH", tmp_path / "app.db")
    monkeypatch.setattr(config, "LOG_DIR", tmp_path)
    monkeypatch.setattr(config, "MAIL_LOG_PATH", tmp_path / "mail.log")
    monkeypatch.setattr(config, "MAIL_BACKEND", "console")
    c = db.connect()
    yield c
    c.close()


def _account(conn, email, role="analyst"):
    user, link = flows.invite(conn, None, email, role.title(), role, send_mail=False)
    flows.redeem_token(conn, link.split("token=")[1], PASSWORD)
    return user


def _chat(conn, user, question, answer="Respuesta."):
    chat = conversations.start(conn, user["id"])
    conversations.add_message(conn, chat, "user", question)
    reply = conversations.add_message(conn, chat, "assistant", answer, tools=TOOLS)
    return chat, reply


def test_titles_are_the_first_question_cut_to_sixty_characters(conn):
    user = _account(conn, "a@test.mx")
    short, _ = _chat(conn, user, "¿Qué cines venden más?")
    long, _ = _chat(conn, user, "  ¿Cuántas   funciones\ntiene " + "muy " * 40 + "larga?")
    titles = {c["id"]: c["title"] for c in conversations.recent(conn, user["id"])}
    assert titles[short] == "¿Qué cines venden más?"
    assert len(titles[long]) == conversations.TITLE_CHARS and titles[long].endswith("…") and "\n" not in titles[long]


def test_the_list_is_newest_first_and_only_the_owners(conn):
    ana, luis = _account(conn, "a@test.mx"), _account(conn, "l@test.mx")
    first, _ = _chat(conn, ana, "Primera")
    second, _ = _chat(conn, ana, "Segunda")
    _chat(conn, luis, "De Luis")
    assert [c["id"] for c in conversations.recent(conn, ana["id"])] == [second, first]
    # Escribir de nuevo en la primera la sube.
    conversations.add_message(conn, first, "user", "Otra más")
    assert [c["id"] for c in conversations.recent(conn, ana["id"])] == [first, second]
    # Una conversación vacía (se abrió y no se escribió) no estorba en la lista.
    conversations.start(conn, ana["id"])
    assert len(conversations.recent(conn, ana["id"])) == 2


def test_reopening_a_conversation_brings_back_what_it_consulted_and_the_thumb(conn):
    user = _account(conn, "a@test.mx")
    chat, reply = _chat(conn, user, "Pregunta")
    conversations.set_feedback(conn, user["id"], reply, False)
    question, answer = conversations.history(conn, user["id"], chat)
    assert question["tools"] is None and question["useful"] is None
    assert answer["tools"] == TOOLS and answer["useful"] is False


def test_deleting_removes_everything_the_user_sees_and_keeps_the_audit(conn):
    user = _account(conn, "a@test.mx")
    other = _account(conn, "o@test.mx")
    chat, reply = _chat(conn, user, "Pregunta")
    conversations.set_feedback(conn, user["id"], reply, True)
    conversations.audit(conn, user, "dev", conversation_id=chat, tokens_in=5, tokens_out=5)

    assert conversations.delete(conn, other["id"], chat) is False
    assert conversations.delete(conn, user["id"], chat) is True
    assert conversations.recent(conn, user["id"]) == [] and conversations.history(conn, user["id"], chat) == []
    assert conn.execute("SELECT count(*) AS n FROM agent_feedback").fetchone()["n"] == 0
    assert conn.execute("SELECT conversation_id FROM agent_audit").fetchone()["conversation_id"] is None
    assert conversations.delete(conn, user["id"], chat) is False


def test_conversations_from_before_the_history_get_a_title_and_a_date(conn):
    user = _account(conn, "a@test.mx")
    conn.execute("INSERT INTO agent_conversation (id, account_id, created_at) VALUES (900, ?, '2026-01-01T00:00:00+00:00')",
                 (user["id"],))
    conn.execute("""INSERT INTO agent_message (conversation_id, role, content, created_at)
                    VALUES (900, 'user', 'Una pregunta de antes', '2026-01-02T00:00:00+00:00')""")
    db.connect().close()
    found = conversations.recent(conn, user["id"])
    assert [(c["id"], c["title"], db.iso(c["updated_at"])) for c in found] == [
        (900, "Una pregunta de antes", "2026-01-02T00:00:00.000000+00:00")]


@pytest.fixture
def client(conn):
    return TestClient(internal.app)


def _login(client, email):
    assert client.post("/api/login", json={"email": email, "password": PASSWORD}).status_code == 200


def test_the_history_endpoints_list_reopen_and_delete(client, conn):
    ana = _account(conn, "a@test.mx")
    other = _account(conn, "o@test.mx")
    chat, _ = _chat(conn, ana, "¿Qué cines venden más?")
    foreign, _ = _chat(conn, other, "De otra cuenta")
    _login(client, "a@test.mx")

    listed = client.get("/api/agente/conversaciones").json()
    assert [c["title"] for c in listed] == ["¿Qué cines venden más?"]
    opened = client.get(f"/api/agente/conversaciones/{chat}").json()
    assert opened[1]["tools"][0]["sources"][0]["dataset"] == "week_showtimes"
    # Una conversación ajena no se abre ni se borra.
    assert client.get(f"/api/agente/conversaciones/{foreign}").json() == []
    assert client.delete(f"/api/agente/conversaciones/{foreign}").status_code == 404
    assert client.delete(f"/api/agente/conversaciones/{chat}").status_code == 204
    assert client.get("/api/agente/conversaciones").json() == []


def test_a_viewer_gets_no_history(client, conn):
    _account(conn, "v@test.mx", "viewer")
    _login(client, "v@test.mx")
    assert client.get("/api/agente/conversaciones").status_code == 403
