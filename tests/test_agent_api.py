"""Endpoints del asistente (`api/pages/agente.py`) con `TestClient`: acceso por rol y módulo, límites y la clave de
proveedor, con un proveedor falso."""
import hashlib

import pytest

pytest.importorskip("fastapi")
if not hasattr(hashlib, "scrypt"):
    pytest.skip("sin hashlib.scrypt", allow_module_level=True)
from fastapi.testclient import TestClient  # noqa: E402

from agent import providers  # noqa: E402
from api import internal  # noqa: E402
from auth import db, flows, orgs  # noqa: E402
from scraper import config  # noqa: E402

PASSWORD = "contraseña-de-pruebas-123"


@pytest.fixture
def conn(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "APP_DB_PATH", tmp_path / "app.db")
    monkeypatch.setattr(config, "LOG_DIR", tmp_path)
    monkeypatch.setattr(config, "MAIL_LOG_PATH", tmp_path / "mail.log")
    monkeypatch.setattr(config, "MAIL_BACKEND", "console")
    c = db.connect()
    yield c
    c.close()


def _account(conn, email, role, org_id=None):
    user, link = flows.invite(conn, None, email, role.title(), role, send_mail=False, org_id=org_id)
    flows.redeem_token(conn, link.split("token=")[1], PASSWORD)
    return user


@pytest.fixture
def client(conn, monkeypatch):
    def chat(api_key, messages, tool_specs):
        reply = {"role": "assistant", "content": "Respuesta."}
        return {"message": reply, "content": "Respuesta.", "tool_calls": [], "tokens_in": 10, "tokens_out": 5}

    monkeypatch.setitem(providers.CHAT, "deepseek", chat)
    return TestClient(internal.app)


def _login(client, email):
    assert client.post("/api/login", json={"email": email, "password": PASSWORD}).status_code == 200


def _ask(client, **extra):
    return client.post("/api/agente/preguntar", json={"question": "¿Qué cine vende más?", **extra})


def test_an_analyst_asks_and_the_answer_is_stored(client, conn):
    analyst = _account(conn, "a@test.mx", "analyst")
    orgs.set_agent_provider(conn, analyst["org_id"], "deepseek", "sk-1")
    _login(client, "a@test.mx")
    out = _ask(client)
    assert out.status_code == 200 and out.json()["answer"] == "Respuesta."
    history = client.get(f"/api/agente/conversaciones/{out.json()['conversation_id']}").json()
    assert [m["role"] for m in history] == ["user", "assistant"]
    assert client.put(f"/api/agente/mensajes/{out.json()['message_id']}/pulgar", json={"useful": True}).status_code == 204
    assert client.put("/api/agente/mensajes/999/pulgar", json={"useful": True}).status_code == 404


def test_a_viewer_and_an_org_without_the_module_get_403(client, conn):
    _account(conn, "v@test.mx", "viewer")
    other = orgs.create(conn, "Otra", ["cartelera"])
    _account(conn, "o@test.mx", "analyst", other["id"])
    for email in ("v@test.mx", "o@test.mx"):
        _login(client, email)
        assert _ask(client).status_code == 403
        assert client.get("/api/agente/conversaciones/1").status_code == 403
    client.cookies.clear()
    assert _ask(client).status_code == 401


def test_without_a_provider_the_answer_is_502_not_an_invention(client, conn):
    _account(conn, "a@test.mx", "analyst")
    _login(client, "a@test.mx")
    assert _ask(client).status_code == 502


def test_too_many_questions_is_429(client, conn, monkeypatch):
    monkeypatch.setattr(config, "AGENT_QUESTIONS_PER_HOUR", 2)
    analyst = _account(conn, "a@test.mx", "analyst")
    orgs.set_agent_provider(conn, analyst["org_id"], "deepseek", "sk-1")
    _login(client, "a@test.mx")
    assert [_ask(client).status_code for _ in range(3)] == [200, 200, 429]


def test_the_org_token_budget_is_429(client, conn, monkeypatch):
    monkeypatch.setattr(config, "AGENT_ORG_TOKENS_PER_DAY", 20)
    analyst = _account(conn, "a@test.mx", "analyst")
    orgs.set_agent_provider(conn, analyst["org_id"], "deepseek", "sk-1")
    _login(client, "a@test.mx")
    assert [_ask(client).status_code for _ in range(3)] == [200, 200, 429]


def test_only_staff_sets_the_provider_and_the_key_never_comes_back(client, conn):
    _account(conn, "a@test.mx", "admin")
    staff = _account(conn, "s@test.mx", "staff")
    _login(client, "a@test.mx")
    assert client.put("/api/agente/proveedores/1", json={"provider": "deepseek", "api_key": "sk-1"}).status_code == 403
    assert client.get("/api/agente/proveedores").status_code == 403
    _login(client, "s@test.mx")
    assert client.put("/api/agente/proveedores/1", json={"provider": "otro", "api_key": "sk-1"}).status_code == 422
    assert client.put("/api/agente/proveedores/1", json={"provider": "deepseek", "api_key": "sk-secreto"}).status_code == 204
    listed = client.get("/api/agente/proveedores")
    assert listed.json()[0]["provider"] == "deepseek" and "sk-secreto" not in listed.text
    assert conn.execute("SELECT actor_id, action FROM audit WHERE action = 'set_agent_provider'").fetchone() == {
        "actor_id": staff["id"], "action": "set_agent_provider"}
    assert client.put("/api/agente/proveedores/1", json={}).status_code == 204
    assert client.get("/api/agente/proveedores").json()[0]["provider"] is None
