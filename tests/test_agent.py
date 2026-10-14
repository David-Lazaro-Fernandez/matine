"""Herramientas del agente, su acceso, su auditoría y que solo lean."""
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent import tools  # noqa: E402
from analytics import datasets  # noqa: E402
from analytics import db as analytics_db  # noqa: E402
from auth import conversations, db, flows, orgs  # noqa: E402


@pytest.fixture
def app(tmp_path):
    conn = db.connect(tmp_path / "app.db")
    yield conn
    conn.close()


def _user(app, role, modules):
    org = orgs.create(app, "Otra", modules)
    user, _ = flows.invite(app, None, f"{role}@test.mx", role, role, send_mail=False, org_id=org["id"])
    return {**flows.profile(app, user["id"]), "org_id": org["id"]}


@pytest.mark.parametrize("role, modules, allowed", [
    ("analyst", ["agente"], True), ("admin", ["agente"], True), ("viewer", ["agente"], False),
    ("analyst", ["cartelera"], False), ("staff", [], True),
])
def test_access_needs_role_and_module(app, role, modules, allowed):
    user = _user(app, role, modules)
    if allowed:
        tools.require_access(user)
    else:
        with pytest.raises(tools.AccessDenied):
            tools.require_access(user)


def test_seat_data_questions_outside_cdmx_are_refused(capture_db):
    conn = capture_db("cinemex")
    for plaza in ("gdl", "mty", None):
        assert "refusal" in tools.get_cinema_ranking(conn, plaza=plaza)
    assert "refusal" in tools.get_cinema_ranking(conn, chain="cineteca")


def test_ranking_in_cdmx_states_window_and_environment(capture_db):
    out = tools.get_cinema_ranking(capture_db("cinemex"))
    assert out["plaza"] == "cdmx" and out["days"] == 7 and out["min_shows"] == 50
    assert out["environment"] == tools.environment() and out["row_count"] == 0


def test_unknown_title_and_table_are_refusals_not_empty_answers(capture_db):
    conn = capture_db("cinemex", "cinepolis")
    assert "refusal" in tools.get_title_screens(conn, title="zzzz inexistente")
    assert "refusal" in tools.compare_titles(conn, "zzzz uno", "zzzz dos")
    assert "refusal" in tools.describe_table(conn, "app")


def test_every_catalog_table_has_a_description_and_lists(capture_db):
    listed = {r["table"]: r for r in tools.list_tables()["rows"]}
    assert set(listed) == set(datasets.DATASETS)
    assert all(r["description"] for r in listed.values())
    assert tools.describe_table(capture_db("cinemex"), "cinemas")["total_rows"] > 0


def test_title_screens_return_shares_for_both_chains(capture_db, frozen_week):
    out = tools.get_title_screens(capture_db("cinemex", "cinepolis"), plaza=None)
    assert out["window"] == {"from": "2026-09-24", "to": "2026-09-30"} and out["row_count"] > 0
    assert all("share_cinemex_text" in r and "share_cinepolis" in r for r in out["rows"])
    assert out["rows"][0]["share_cinemex_text"].endswith(" %")


def test_describing_a_table_with_dates_uses_the_cinema_week(capture_db, frozen_week):
    out = tools.describe_table(capture_db("cinemex"), "ticket_prices")
    assert out["window"]["from"] == "2026-09-24" and out["row_count"] > 0


def test_the_agent_connection_cannot_write(tmp_path):
    path = tmp_path / "ro.db"
    sqlite3.connect(path).execute("CREATE TABLE t (x)").connection.close()
    conn = analytics_db.connect(path)
    for sql in ("INSERT INTO t VALUES (1)", "UPDATE t SET x = 2", "DROP TABLE t", "DELETE FROM t", "CREATE TABLE u (y)"):
        with pytest.raises(sqlite3.OperationalError):
            conn.execute(sql)
    conn.close()


def test_tools_never_name_app_or_precalc_databases():
    source = Path(tools.__file__).read_text()
    assert "app.db" not in source and "precalc" not in source and "APP_DB" not in source


def test_dev_refuses_data_outside_the_repo(monkeypatch, tmp_path):
    monkeypatch.setattr(tools.config, "DATA_DIR", tmp_path)
    monkeypatch.setenv("AC_ENV", "dev")
    with pytest.raises(RuntimeError):
        tools.check_startup()
    monkeypatch.setenv("AC_ENV", "prod")
    tools.check_startup()


def test_conversations_audit_and_feedback_belong_to_their_account(app):
    mine = _user(app, "analyst", ["agente"])
    other = _user(app, "admin", ["agente"])
    chat = conversations.start(app, mine["id"])
    conversations.add_message(app, chat, "user", "¿Qué cine vende más?")
    answer = conversations.add_message(app, chat, "assistant", "Cine X.")
    assert [m["role"] for m in conversations.history(app, mine["id"], chat)] == ["user", "assistant"]
    assert conversations.history(app, other["id"], chat) == []
    assert conversations.set_feedback(app, other["id"], answer, True) is False
    assert conversations.set_feedback(app, mine["id"], answer, False) is True
    conversations.audit(app, mine, "dev", conversation_id=chat, tools=[{"name": "get_cinema_ranking", "rows": 3}])
    assert app.execute("SELECT count(*) AS n FROM agent_audit").fetchone()["n"] == 1


CORE_TOOLS = {"list_tables", "describe_table", "get_cinema_ranking", "get_title_screens", "compare_titles"}
EXPECTED_TOOLS = CORE_TOOLS | {"get_popcorn_price", "get_distributor_screens"}


def _ask(user, name, arguments):
    import asyncio

    from fastmcp import Client

    from agent import server

    async def go():
        async with Client(server.build(user)) as client:
            tool_list = await client.list_tools()
            return tool_list, await client.call_tool(name, arguments)

    return asyncio.run(go())


def test_server_lists_exactly_the_expected_read_only_tools(app):
    listed, _ = _ask(_user(app, "analyst", ["agente", "dulceria", "distribuidores"]), "list_tables", {})
    assert {t.name for t in listed} == EXPECTED_TOOLS
    assert all(t.annotations.readOnlyHint and not t.annotations.destructiveHint for t in listed)


@pytest.mark.parametrize("modules, extra", [
    (["agente"], set()), (["agente", "dulceria"], {"get_popcorn_price"}),
    (["agente", "distribuidores"], {"get_distributor_screens"}),
])
def test_dulceria_and_distributor_tools_need_their_module(app, modules, extra):
    listed, _ = _ask(_user(app, "analyst", modules), "list_tables", {})
    assert {t.name for t in listed} == CORE_TOOLS | extra


def test_popcorn_price_filters_by_bucket_and_refuses_unknown_values(capture_db):
    conn = capture_db("cinemex", "cinepolis")
    assert "refusal" in tools.get_popcorn_price(conn, bucket="zzz")
    assert "refusal" in tools.get_popcorn_price(conn, platform="zzz")
    assert all(r["bucket"] == "refresco" for r in tools.get_popcorn_price(conn, bucket="refresco")["rows"])


def test_distributor_screens_pivot_both_chains_and_stay_aggregate(capture_db, frozen_week):
    out = tools.get_distributor_screens(capture_db("cinemex", "cinepolis"), plaza=None)
    assert out["window"] == {"from": "2026-09-24", "to": "2026-09-30"} and out["row_count"] > 0
    row = out["rows"][0]
    assert {"screens_cinemex", "screens_cinepolis", "share_shows_cinemex_text", "gap_pp_text"} <= set(row)
    assert not {"cinema_id", "title"} & set(row)
    assert out["rows"] == sorted(out["rows"], key=lambda r: (-r["shows_cinemex"], r["distributor"]))
    assert "refusal" in tools.get_distributor_screens(capture_db("cinemex"), chain="cineteca")


def test_server_answers_through_the_in_memory_client(app):
    _, result = _ask(_user(app, "analyst", ["agente"]), "list_tables", {})
    assert {r["table"] for r in result.data["rows"]} == set(datasets.DATASETS)


def test_the_server_is_not_built_for_a_viewer_or_an_org_without_the_module(app):
    from agent import server

    for role, modules in (("viewer", ["agente"]), ("analyst", ["cartelera"])):
        with pytest.raises(tools.AccessDenied):
            server.build(_user(app, role, modules))


class _FakeKms:
    """Cifra con un XOR y exige el mismo contexto, como KMS."""

    def encrypt(self, KeyId, Plaintext, EncryptionContext):
        self.calls = [("encrypt", KeyId, EncryptionContext)]
        return {"CiphertextBlob": bytes(b ^ 7 for b in Plaintext) + repr(sorted(EncryptionContext.items())).encode()}

    def decrypt(self, CiphertextBlob, EncryptionContext):
        suffix = repr(sorted(EncryptionContext.items())).encode()
        if not CiphertextBlob.endswith(suffix):
            raise PermissionError("InvalidCiphertextException")
        return {"Plaintext": bytes(b ^ 7 for b in CiphertextBlob[:-len(suffix)])}


def test_the_provider_key_is_stored_encrypted_with_kms_and_bound_to_its_org(app, monkeypatch):
    from auth import secrets
    monkeypatch.setattr(secrets.config, "KEY_BACKEND", "kms")
    monkeypatch.setattr(secrets.config, "KMS_KEY_ID", "alias/matine")
    monkeypatch.setattr(secrets, "_kms", _FakeKms)
    mine, other = orgs.create(app, "Uno", ["agente"]), orgs.create(app, "Dos", ["agente"])
    assert orgs.set_agent_provider(app, mine["id"], "anthropic", "sk-secreto")
    stored = app.execute("SELECT agent_key FROM organization WHERE id = ?", (mine["id"],)).fetchone()["agent_key"]
    assert "sk-secreto" not in stored
    assert orgs.agent_provider(app, mine["id"]) == ("anthropic", "sk-secreto")
    assert orgs.agent_provider(app, other["id"]) is None
    with pytest.raises(PermissionError):
        secrets.decrypt(stored, other["id"])
    assert "sk-secreto" not in str(orgs.list_orgs(app)) and "agent_key" not in orgs.workspace(app, mine["id"])
    orgs.set_agent_provider(app, mine["id"], None, None)
    assert orgs.agent_provider(app, mine["id"]) is None


def test_the_dev_key_backend_is_refused_in_prod(app, monkeypatch):
    monkeypatch.setenv("AC_ENV", "prod")
    org = orgs.create(app, "Uno", ["agente"])
    with pytest.raises(ValueError):
        orgs.set_agent_provider(app, org["id"], "anthropic", "sk-x")


IN_SCOPE = '{"tasks": [{"task": "consultar", "in_scope": true}]}'


def _scripted(*replies, scope=IN_SCOPE, fits='{"fits": true}'):
    """Proveedor falso: devuelve las respuestas en orden y guarda lo que recibió. La llamada sin herramientas es la del
    clasificador de alcance y contesta `scope`; `chat.scope_requests` guarda lo que se le pidió."""
    seen = []
    queue = list(replies)

    def chat(api_key, messages, tool_specs, temperature=None):
        if tool_specs == []:
            if messages[0]["content"].startswith("Revisas"):
                chat.answer_checks.append(messages)
                return {"message": {}, "content": fits, "tool_calls": [], "tokens_in": 3, "tokens_out": 2}
            chat.scope_requests.append(messages)
            return {"message": {}, "content": scope, "tool_calls": [], "tokens_in": 3, "tokens_out": 2}
        seen.append({"api_key": api_key, "messages": [dict(m) for m in messages], "tools": tool_specs})
        reply = queue.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return {"message": {"role": "assistant", "content": reply.get("content"), "tool_calls": reply.get("raw")},
                "content": reply.get("content"), "tool_calls": reply.get("calls", []),
                "tokens_in": 10, "tokens_out": 5}

    chat.seen = seen
    chat.scope_requests = []
    chat.answer_checks = []
    return chat


def _ready(app, monkeypatch, chat, user=None):
    from agent import host, providers

    monkeypatch.setitem(providers.CHAT, "deepseek", chat)
    user = user or _user(app, "analyst", ["agente", "dulceria", "distribuidores"])
    orgs.set_agent_provider(app, user["org_id"], "deepseek", "sk-prueba")
    return host, user


def _tool_call(name="list_tables", arguments={}):  # noqa: B006
    return {"calls": [{"id": "c1", "name": name, "arguments": arguments}], "raw": []}


def test_the_loop_calls_a_tool_then_answers_and_audits(app, monkeypatch):
    chat = _scripted(_tool_call(), {"content": "Hay siete tablas."})
    host, user = _ready(app, monkeypatch, chat)
    out = host.ask(app, user, "¿Qué tablas hay?")
    assert out["answer"] == "Hay siete tablas." and out["tools"][0]["name"] == "list_tables"
    assert chat.seen[0]["api_key"] == "sk-prueba" and len(chat.seen[0]["tools"]) == len(EXPECTED_TOOLS)
    tool_message = chat.seen[1]["messages"][-1]
    assert tool_message["role"] == "tool" and "ventas" not in tool_message["content"] and "cinemas" in tool_message["content"]
    audit = app.execute("SELECT * FROM agent_audit").fetchone()
    assert (audit["tokens_in"], audit["tokens_out"], audit["error"], audit["provider"]) == (26, 14, None, "deepseek")
    assert [m["role"] for m in conversations.history(app, user["id"], out["conversation_id"])] == ["user", "assistant"]


def test_a_provider_failure_gives_no_invented_answer_and_is_audited(app, monkeypatch):
    host, user = _ready(app, monkeypatch, _scripted(RuntimeError("boom")))
    with pytest.raises(host.AgentError):
        host.ask(app, user, "hola")
    assert "RuntimeError" in app.execute("SELECT error FROM agent_audit").fetchone()["error"]
    assert app.execute("SELECT count(*) AS n FROM agent_message WHERE role = 'assistant'").fetchone()["n"] == 0


def test_the_loop_stops_at_the_step_limit(app, monkeypatch):
    monkeypatch.setattr(tools.config, "AGENT_MAX_STEPS", 3)
    chat = _scripted(*[_tool_call() for _ in range(3)])
    host, user = _ready(app, monkeypatch, chat)
    with pytest.raises(host.AgentError):
        host.ask(app, user, "hola")
    assert len(chat.seen) == 3


def test_invalid_tool_arguments_and_refusals_go_back_to_the_model(app, monkeypatch):
    from agent import server

    monkeypatch.setattr(server.db, "connect", lambda: sqlite3.connect(":memory:"))
    chat = _scripted(_tool_call(arguments=None), _tool_call("describe_table", {"table": "app"}), {"content": "ok"})
    host, user = _ready(app, monkeypatch, chat)
    host.ask(app, user, "hola")
    assert "JSON" in chat.seen[1]["messages"][-1]["content"]
    assert "refusal" in chat.seen[2]["messages"][-1]["content"]


def test_a_missing_provider_and_a_foreign_conversation_are_refused(app, monkeypatch):
    from agent import host

    user = _user(app, "analyst", ["agente"])
    with pytest.raises(host.AgentError):
        host.ask(app, user, "hola")
    other = _user(app, "admin", ["agente"])
    foreign = conversations.start(app, other["id"])
    host, user = _ready(app, monkeypatch, _scripted({"content": "no debe llegar"}), user)
    with pytest.raises(host.AgentError):
        host.ask(app, user, "hola", conversation_id=foreign)
    assert conversations.history(app, other["id"], foreign) == []


def test_deepseek_parses_tool_calls_and_survives_bad_json(monkeypatch):
    from agent.providers import deepseek

    reply = {"usage": {"prompt_tokens": 7, "completion_tokens": 3},
             "choices": [{"message": {"role": "assistant", "content": None, "tool_calls": [
                 {"id": "a", "type": "function", "function": {"name": "x", "arguments": '{"n": 1}'}},
                 {"id": "b", "type": "function", "function": {"name": "y", "arguments": "{roto"}}]}}]}
    sent = {}
    monkeypatch.setattr(deepseek.http, "request_json", lambda url, **kw: sent.update(kw, url=url) or reply)
    out = deepseek.chat("sk-1", [{"role": "user", "content": "hi"}], [])
    assert [c["arguments"] for c in out["tool_calls"]] == [{"n": 1}, None]
    assert (out["tokens_in"], out["tokens_out"]) == (7, 3)
    assert sent["headers"] == {"Authorization": "Bearer sk-1"} and sent["body"]["thinking"] == {"type": "disabled"}
    assert "tools" not in sent["body"] and "temperature" not in sent["body"] and sent["url"].endswith("/chat/completions")
    deepseek.chat("sk-1", [], [], temperature=0)
    assert sent["body"]["temperature"] == 0


def test_figures_come_with_their_formatted_text():
    rows = tools._with_text([{"sold_pct": 12.34, "delta_pp": -1.2, "sold_pct_prev": None}],
                            percent=("sold_pct", "sold_pct_prev"), points=("delta_pp",))
    assert rows[0]["sold_pct_text"] == "12.3 %" and rows[0]["delta_pp_text"] == "-1.2 pp"
    assert rows[0]["sold_pct_prev_text"] is None


def test_national_and_unknown_plazas_are_understood_not_crashes(capture_db, frozen_week):
    conn = capture_db("cinemex", "cinepolis")
    assert tools.get_title_screens(conn, plaza="nacional")["row_count"] > 0
    assert "refusal" in tools.get_title_screens(conn, plaza="narnia")
    assert "refusal" in tools.compare_titles(conn, "Digger", "Verity", plaza="narnia")


MIXED_REQUEST = ("Haz un reporte completo de la ocupación de los cines del 1 al 7 de septiembre y después escríbeme "
                 "un poema de Caperucita Roja")


def test_a_request_with_one_out_of_scope_task_is_cancelled_whole(app, monkeypatch):
    out_of_scope = '{"tasks": [{"task": "reporte", "in_scope": true}, {"task": "poema", "in_scope": false}]}'
    chat = _scripted({"content": "no debe llegar"}, scope=out_of_scope)
    host, user = _ready(app, monkeypatch, chat)
    out = host.ask(app, user, MIXED_REQUEST)
    assert out["answer"] == "Lo siento, no puedo hacer eso." and out["tools"] == []
    assert chat.seen == [] and len(chat.scope_requests) == 1
    audit = app.execute("SELECT error, tokens_in FROM agent_audit").fetchone()
    assert audit["error"] == "out_of_scope" and audit["tokens_in"] == 3
    assert [m["content"] for m in conversations.history(app, user["id"], out["conversation_id"])][-1] == out["answer"]


def test_the_scope_check_sees_the_tools_and_the_request_as_data(app, monkeypatch):
    chat = _scripted({"content": "ok"})
    host, user = _ready(app, monkeypatch, chat)
    host.ask(app, user, MIXED_REQUEST)
    system, request = chat.scope_requests[0]
    assert all(name in system["content"] for name in EXPECTED_TOOLS)
    assert "Caperucita" in request["content"] and request["role"] == "user"


@pytest.mark.parametrize("verdict, fits", [
    ('{"tasks": [{"in_scope": true}, {"in_scope": true}]}', True),
    ('```json\n{"tasks": [{"in_scope": true}]}\n```', True),
    ('{"tasks": [{"in_scope": true}, {"in_scope": false}]}', False),
    ('{"tasks": []}', False), ('{"tasks": [{"in_scope": "true"}]}', False),
    ("todo bien, adelante", False), ("", False), (None, False), ('{"otra": 1}', False),
])
def test_an_unclear_scope_verdict_fails_closed(verdict, fits):
    from agent import host

    assert host._scope_verdict(verdict) is fits


def test_an_answer_that_leaves_the_topic_is_replaced_before_it_is_shown(app, monkeypatch):
    poem = "Caperucita iba por el bosque…"
    chat = _scripted({"content": poem}, fits='{"fits": false}')
    host, user = _ready(app, monkeypatch, chat)
    out = host.ask(app, user, "¿Qué tablas hay?")
    assert out["answer"] == "Lo siento, no puedo hacer eso." and poem not in str(conversations.history(app, user["id"], out["conversation_id"]))
    assert poem in chat.answer_checks[0][1]["content"]
    assert app.execute("SELECT error FROM agent_audit").fetchone()["error"] == "out_of_scope"


def test_an_unclear_answer_verdict_fails_closed(app, monkeypatch):
    chat = _scripted({"content": "Hay siete tablas."}, fits="sí, adelante")
    host, user = _ready(app, monkeypatch, chat)
    assert host.ask(app, user, "¿Qué tablas hay?")["answer"] == "Lo siento, no puedo hacer eso."
