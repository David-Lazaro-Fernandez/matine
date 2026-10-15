"""Uso del asistente de IA: costo estimado por modelo y hora (`agent/pricing.py`), estadísticas por persona, día y modelo
(`agent/usage.py`) y la purga de conversaciones a los 12 meses (`auth/conversations.py`)."""
import hashlib
from datetime import datetime, timedelta, timezone

import pytest

pytest.importorskip("fastapi")
if not hasattr(hashlib, "scrypt"):
    pytest.skip("sin hashlib.scrypt", allow_module_level=True)
from fastapi.testclient import TestClient  # noqa: E402

from agent import pricing, usage  # noqa: E402
from api import internal  # noqa: E402
from auth import conversations, db, flows, orgs  # noqa: E402
from scraper import config  # noqa: E402

PASSWORD = "contraseña-de-pruebas-123"
MILLION = 1_000_000


def test_a_known_model_costs_input_plus_output():
    # Un miércoles a las 15:00 UTC no es hora pico.
    assert pricing.cost("deepseek-flash", "2026-10-14T15", MILLION, MILLION) == pytest.approx(0.15 + 0.6)


def test_peak_hours_cost_double_but_weekends_do_not():
    assert pricing.cost("deepseek-flash", "2026-10-14T07", MILLION, 0) == pytest.approx(0.30)
    # El sábado 17 de octubre a la misma hora no es pico.
    assert pricing.cost("deepseek-flash", "2026-10-17T07", MILLION, 0) == pytest.approx(0.15)
    assert pricing.cost("deepseek-flash", "2026-10-14T04", MILLION, 0) == pytest.approx(0.15)


def test_an_unknown_model_or_a_day_before_its_price_has_no_cost():
    assert pricing.cost("modelo-desconocido", "2026-10-14T15", 10, 10) is None
    assert pricing.cost(None, "2026-10-14T15", 10, 10) is None
    assert pricing.cost("deepseek-flash", "2026-10-13T15", 10, 10) is None


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


def _ask(conn, user, model, tokens_in, tokens_out, when):
    conn.execute("""INSERT INTO agent_audit (at, account_id, org_id, role, environment, provider, model, tokens_in, tokens_out)
                    VALUES (?, ?, ?, ?, 'dev', 'deepseek', ?, ?, ?)""",
                 (when, user["id"], user["org_id"], user["role"], model, tokens_in, tokens_out))


def test_the_summary_adds_by_person_and_day_and_flags_what_has_no_price(conn):
    now = datetime(2026, 10, 14, 20, tzinfo=timezone.utc)
    ana, luis = _account(conn, "a@test.mx", "analyst"), _account(conn, "l@test.mx", "analyst")
    _ask(conn, ana, "deepseek-flash", MILLION, 0, "2026-10-14T15:00:00+00:00")
    _ask(conn, ana, "deepseek-flash", MILLION, 0, "2026-10-13T15:00:00+00:00")
    _ask(conn, luis, "modelo-sin-precio", 500, 100, "2026-10-14T16:00:00+00:00")
    out = usage.summary(conn, days=30, now=now)

    assert out["totals"]["questions"] == 3 and out["totals"]["tokens"] == 2 * MILLION + 600
    # Solo el día 14 de la primera pregunta tiene precio vigente; la del 13 y el modelo sin precio quedan fuera.
    assert out["totals"]["cost_usd"] == pytest.approx(0.15) and out["totals"]["unpriced_tokens"] == MILLION + 600
    people = {p["email"]: p for p in out["people"]}
    assert people["a@test.mx"]["tokens"] == 2 * MILLION and people["l@test.mx"]["cost_usd"] is None
    assert [d["day"] for d in out["by_day"]] == ["2026-10-13", "2026-10-14"]
    assert {m["model"] for m in out["models"]} == {"deepseek-flash", "modelo-sin-precio"}
    assert [o["org_id"] for o in out["organizations"]] == [ana["org_id"]]


def test_the_summary_of_one_organization_leaves_out_the_others(conn):
    other = orgs.create(conn, "Otra", ["agente"])
    now = datetime(2026, 10, 14, 20, tzinfo=timezone.utc)
    mine, theirs = _account(conn, "m@test.mx", "analyst"), _account(conn, "t@test.mx", "analyst", org_id=other["id"])
    _ask(conn, mine, "deepseek-flash", 10, 10, "2026-10-14T15:00:00+00:00")
    _ask(conn, theirs, "deepseek-flash", 99, 99, "2026-10-14T15:00:00+00:00")
    out = usage.summary(conn, org_id=mine["org_id"], days=7, now=now)
    assert out["totals"]["tokens"] == 20 and "organizations" not in out


def test_an_empty_period_is_zeros_not_a_crash(conn):
    out = usage.summary(conn, days=7)
    assert out["totals"]["questions"] == 0 and out["totals"]["cost_usd"] is None and out["people"] == []


@pytest.fixture
def client(conn):
    return TestClient(internal.app)


def _login(client, email):
    assert client.post("/api/login", json={"email": email, "password": PASSWORD}).status_code == 200


def test_an_admin_sees_only_their_organization_and_staff_sees_all(client, conn):
    other = orgs.create(conn, "Otra", ["agente"])
    admin, staff = _account(conn, "ad@test.mx", "admin"), _account(conn, "st@test.mx", "staff")
    foreign = _account(conn, "f@test.mx", "analyst", org_id=other["id"])
    _ask(conn, admin, "deepseek-flash", 10, 10, datetime.now(timezone.utc).isoformat())
    _ask(conn, foreign, "deepseek-flash", 70, 70, datetime.now(timezone.utc).isoformat())

    _login(client, "ad@test.mx")
    mine = client.get("/api/agente/uso", params={"org_id": other["id"]}).json()
    assert mine["totals"]["tokens"] == 20 and "organizations" not in mine

    _login(client, "st@test.mx")
    everyone = client.get("/api/agente/uso").json()
    assert everyone["totals"]["tokens"] == 160 and len(everyone["organizations"]) == 2
    assert client.get("/api/agente/uso", params={"org_id": other["id"]}).json()["totals"]["tokens"] == 140
    assert staff["role"] == "staff"


def test_an_analyst_cannot_read_usage_statistics(client, conn):
    _account(conn, "an@test.mx", "analyst")
    _login(client, "an@test.mx")
    assert client.get("/api/agente/uso").status_code == 403


def test_prune_deletes_conversations_idle_for_twelve_months_with_their_messages(conn):
    user = _account(conn, "p@test.mx", "analyst")
    old, recent = conversations.start(conn, user["id"]), conversations.start(conn, user["id"])
    long_ago = datetime.now(timezone.utc) - timedelta(days=conversations.RETENTION_DAYS + 5)
    old_message = conversations.add_message(conn, old, "assistant", "vieja")
    conversations.add_message(conn, recent, "user", "reciente")
    conn.execute("UPDATE agent_message SET created_at = ? WHERE id = ?", (db.iso(long_ago), old_message))
    conn.execute("UPDATE agent_conversation SET created_at = ? WHERE id = ?", (db.iso(long_ago), old))
    conversations.set_feedback(conn, user["id"], old_message, True)
    conversations.audit(conn, user, "dev", conversation_id=old, tokens_in=5, tokens_out=5)

    assert conversations.prune(conn) == 1
    assert conversations.history(conn, user["id"], old) == [] and len(conversations.history(conn, user["id"], recent)) == 1
    assert conn.execute("SELECT count(*) AS n FROM agent_feedback").fetchone()["n"] == 0
    # La auditoría no guarda texto y sobrevive: de ella salen las estadísticas.
    assert conn.execute("SELECT count(*) AS n FROM agent_audit").fetchone()["n"] == 1
