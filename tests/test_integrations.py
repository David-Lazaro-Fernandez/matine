"""Avisos y resumen de `integrations/` sobre bases temporales. Sin red: el envío a Slack y el correo se reemplazan."""
import json
import sqlite3
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from analytics import alerts
from auth import connect as connect_auth
from auth import mail, orgs
from integrations import digest, run, slack
from scraper import store

MX = ZoneInfo("America/Mexico_City")
HOOK = "https://hooks.slack.com/services/T000/B000/xyz"
# Un martes: las pruebas de avisos no deben disparar el resumen del lunes.
TUESDAY = datetime(2026, 10, 13, 10, 0, tzinfo=MX)


@pytest.fixture(autouse=True)
def no_outside_sends(monkeypatch):
    """Ningún envío sale de la prueba: Slack, correo y hallazgos quedan sustituidos. Cada prueba puede cambiar
    lo suyo después. Sin esto, una prueba con la fecha de un lunes llamaría a un webhook de verdad."""
    monkeypatch.setattr(slack, "post", lambda url, payload: None)
    monkeypatch.setattr(mail, "send", lambda to, subject, text, html=None: None)
    monkeypatch.setattr(digest, "findings", lambda conn, **kw: [])


@pytest.fixture
def app_conn(tmp_path):
    conn = connect_auth(tmp_path / "app.db")
    yield conn
    conn.close()


@pytest.fixture
def org_id(app_conn):
    return orgs.create(app_conn, "Cinemex", ["cartelera"])["id"]


@pytest.fixture
def analysis_conn():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(store.SCHEMA)
    conn.execute("INSERT INTO cinema (chain, cinema_id, name, city_id, first_seen, last_seen) "
                 "VALUES ('cinepolis', 'c1', 'Cine Reforma', 'cdmx', 'x', 'x')")
    conn.execute("INSERT INTO cinema (chain, cinema_id, name, city_id, first_seen, last_seen) "
                 "VALUES ('cinepolis', 'c2', 'Cine Monterrey', 'nl', 'x', 'x')")
    yield conn
    conn.close()


def _event(conn, kind, cinema_id="c1", before=None, after=None):
    """Inserta un evento de Cinépolis y devuelve su id."""
    show_id = f"s{conn.execute('SELECT COUNT(*) FROM event').fetchone()[0]}"
    cur = conn.execute(
        """INSERT INTO event (chain, show_id, kind, detected_at, snapshot_id, cinema_id, movie_title, datetime_local,
                              before_json, after_json)
           VALUES ('cinepolis', ?, ?, '2026-10-12T20:30:00+00:00', 1, ?, 'Dune', ?, ?, ?)""",
        (show_id, kind, cinema_id, (before or after or {}).get("datetime_local"),
         json.dumps(before) if before else None, json.dumps(after) if after else None))
    return cur.lastrowid


def test_settings_accept_slack_and_clean_emails(app_conn, org_id):
    orgs.set_settings(app_conn, org_id, {"slack_webhook": HOOK, "digest_recipients": [" a@x.mx ", "b@x.mx"]})
    assert orgs.integrations(app_conn, org_id) == {"slack_webhook": HOOK, "digest_recipients": ["a@x.mx", "b@x.mx"]}


def test_settings_refuse_other_webhook_hosts_and_bad_emails(app_conn, org_id):
    with pytest.raises(ValueError, match="hooks.slack.com"):
        orgs.set_settings(app_conn, org_id, {"slack_webhook": "https://example.com/hook"})
    with pytest.raises(ValueError, match="inválidos"):
        orgs.set_settings(app_conn, org_id, {"digest_recipients": ["no-es-correo"]})


def test_state_is_kept_when_admin_changes_settings(app_conn, org_id):
    orgs.set_settings(app_conn, org_id, {"slack_webhook": HOOK})
    orgs.record_state(app_conn, org_id, "slack_last_event_id", 42)
    orgs.set_settings(app_conn, org_id, {"digest_recipients": ["a@x.mx"]})
    settings = orgs.integrations(app_conn, org_id)
    assert settings["slack_last_event_id"] == 42 and settings["slack_webhook"] == HOOK


def test_message_counts_kinds_and_truncates_lines():
    changes = [{"kind_label": "Función cancelada", "movie_title": f"Película {i}", "cinema": "Cine Reforma",
                "before_time": "17:30", "after_time": None} for i in range(slack.MAX_LINES + 3)]
    text = slack.message(changes, "Cinépolis", "CDMX")
    assert text.splitlines()[0] == f"*Cinépolis en CDMX*: {len(changes)} cambios desde el último aviso."
    assert "Función cancelada: 15" in text
    assert text.splitlines()[-1] == "… y 3 más."


def test_digest_is_due_once_a_week_from_nine_on_monday():
    assert digest.due(datetime(2026, 10, 12, 9, 0, tzinfo=MX), None)
    assert not digest.due(datetime(2026, 10, 12, 8, 59, tzinfo=MX), None)
    assert not digest.due(datetime(2026, 10, 12, 10, 0, tzinfo=MX), "2026-10-12")
    assert not digest.due(datetime(2026, 10, 13, 10, 0, tzinfo=MX), None)


def test_competitor_changes_keep_alert_kinds_in_plaza_only(analysis_conn):
    after_id = _event(analysis_conn, "removed")
    _event(analysis_conn, "added")
    _event(analysis_conn, "expired")
    _event(analysis_conn, "removed", cinema_id="c2")
    moved = _event(analysis_conn, "moved", before={"datetime_local": "2026-10-12T18:00:00"},
                   after={"datetime_local": "2026-10-12T19:30:00"})
    found = alerts.competitor_changes(analysis_conn, since_id=0, plaza="cdmx")
    assert [c["id"] for c in found] == [after_id, moved]
    assert found[0]["cinema"] == "Cine Reforma" and found[0]["kind_label"] == "Función cancelada"
    assert (found[1]["before_time"], found[1]["after_time"]) == ("18:00", "19:30")
    assert alerts.latest_event_id(analysis_conn) == moved


def test_first_run_sets_cursor_and_sends_nothing(app_conn, analysis_conn, org_id, monkeypatch):
    orgs.set_settings(app_conn, org_id, {"slack_webhook": HOOK})
    _event(analysis_conn, "removed")
    sent = []
    monkeypatch.setattr(slack, "post", lambda url, payload: sent.append(payload["text"]))
    run._run_org(app_conn, analysis_conn, org_id, orgs.integrations(app_conn, org_id), TUESDAY)
    assert sent == []
    assert orgs.integrations(app_conn, org_id)["slack_last_event_id"] == alerts.latest_event_id(analysis_conn)


def test_new_changes_post_once_and_advance_cursor(app_conn, analysis_conn, org_id, monkeypatch):
    orgs.set_settings(app_conn, org_id, {"slack_webhook": HOOK})
    run._run_org(app_conn, analysis_conn, org_id, orgs.integrations(app_conn, org_id), TUESDAY)
    _event(analysis_conn, "removed")
    sent = []
    monkeypatch.setattr(slack, "post", lambda url, payload: sent.append((url, payload["text"])))
    run._run_org(app_conn, analysis_conn, org_id, orgs.integrations(app_conn, org_id), TUESDAY)
    run._run_org(app_conn, analysis_conn, org_id, orgs.integrations(app_conn, org_id), TUESDAY)
    assert len(sent) == 1 and sent[0][0] == HOOK
    assert "Función cancelada: 1" in sent[0][1]


def test_failed_post_keeps_cursor_for_retry(app_conn, analysis_conn, org_id, monkeypatch, capsys):
    orgs.set_settings(app_conn, org_id, {"slack_webhook": HOOK})
    run._run_org(app_conn, analysis_conn, org_id, orgs.integrations(app_conn, org_id), TUESDAY)
    before = orgs.integrations(app_conn, org_id)["slack_last_event_id"]
    _event(analysis_conn, "removed")

    def down(url, payload):
        raise OSError("sin red")

    monkeypatch.setattr(slack, "post", down)
    failed = run._run_org(app_conn, analysis_conn, org_id, orgs.integrations(app_conn, org_id), TUESDAY)
    assert failed == 1
    assert orgs.integrations(app_conn, org_id)["slack_last_event_id"] == before
    assert "sin red" in capsys.readouterr().err


def test_digest_html_escapes_findings_and_keeps_text_part(monkeypatch):
    items = [{"label": "Cinépolis <b>cobra</b> 52 % más", "action": "Valora & revisa", "context": None, "chart": None},
             {"label": "Título sin sugerencia", "action": None, "context": "Muestra: 3 días", "chart": None}]
    monkeypatch.setattr(digest, "findings", lambda conn, **kw: items)
    subject, text, html = digest.compose(None, datetime(2026, 10, 12, 10, 0, tzinfo=MX), "cdmx")
    assert "<b>cobra</b>" not in html and "&lt;b&gt;cobra&lt;/b&gt;" in html and "Valora &amp; revisa" in html
    assert text.splitlines() == ["- Cinépolis <b>cobra</b> 52 % más", "  Valora & revisa",
                                 "- Título sin sugerencia", "  Muestra: 3 días"]
    assert html.startswith("<!doctype html>") and 'role="presentation"' in html


def test_digest_chart_renders_bars_proportional_to_value(monkeypatch):
    chart = {"kind": "bars", "unit": "pct", "rows": [
        {"label": "Funciones", "values": {"cinemex": 6.7, "cinepolis": 12.0}, "highlight": False}]}
    items = [{"label": "Hallazgo", "action": None, "context": None, "chart": chart}]
    monkeypatch.setattr(digest, "findings", lambda conn, **kw: items)
    _, text, html = digest.compose(None, datetime(2026, 10, 12, 10, 0, tzinfo=MX), "cdmx")
    assert 'width="6.7%"' in html and 'width="12.0%"' in html
    assert "Cinemex 6.7 % · Cinépolis 12 %" in text
    assert digest.CHAIN_COLOR["cinemex"] in html


def test_dumbbell_places_both_chains_on_one_track(monkeypatch):
    chart = {"kind": "dumbbell", "unit": "money", "rows": [
        {"label": "Combo", "values": {"cinemex": 245.0, "cinepolis": 336.0}, "highlight": True}]}
    items = [{"label": "Hallazgo", "action": None, "context": None, "chart": chart}]
    monkeypatch.setattr(digest, "findings", lambda conn, **kw: items)
    _, _, html = digest.compose(None, datetime(2026, 10, 12, 10, 0, tzinfo=MX), "cdmx")
    assert f'bgcolor="{digest.CHAIN_COLOR["cinemex"]}"' in html and f'bgcolor="{digest.CHAIN_COLOR["cinepolis"]}"' in html
    assert "$245 · $336" in html and "font:700 13px" in html


EMOJI_RANGES = ((0x1F000, 0x1FAFF), (0x2600, 0x27BF))


def _has_emoji(text):
    return any(lo <= ord(ch) <= hi for ch in text for lo, hi in EMOJI_RANGES)


def test_slack_findings_payload_is_mrkdwn_without_emojis(monkeypatch):
    chart = {"kind": "bars", "unit": "pct", "rows": [
        {"label": "Últimos 7 días", "values": {"cinemex": 6.7, "cinepolis": 12.0}, "highlight": True}]}
    items = [{"label": "Vendemos <6.7 %> & más", "action": "Valora revisar", "context": "Muestra: 3 días",
              "chart": chart}]
    payload = slack.findings_payload(items, "lun 12 – mié 14 oct 2026", "CDMX")
    text = json.dumps(payload, ensure_ascii=False)
    assert not _has_emoji(text)
    assert payload["blocks"][0]["type"] == "header"
    assert "Vendemos &lt;6.7 %&gt; &amp; más" in text
    assert "```" in text and "█" in text and "Cinemex" in text
    assert "<" not in text.replace("&lt;", "")  # nada sin escapar que Slack leería como enlace


def analysis_conn_for_digest():
    return sqlite3.connect(":memory:")


def test_slack_digest_posts_once_per_week(app_conn, org_id, monkeypatch):
    monkeypatch.setattr(digest, "findings", lambda conn, **kw: [])
    sent = []
    monkeypatch.setattr(slack, "post", lambda url, payload: sent.append(payload))
    orgs.set_settings(app_conn, org_id, {"slack_webhook": HOOK})
    monday = datetime(2026, 10, 12, 10, 0, tzinfo=MX)
    run._run_org(app_conn, analysis_conn_for_digest(), org_id, orgs.integrations(app_conn, org_id), monday)
    run._run_org(app_conn, analysis_conn_for_digest(), org_id, orgs.integrations(app_conn, org_id), monday)
    assert len(sent) == 1 and sent[0]["blocks"][0]["type"] == "header"
