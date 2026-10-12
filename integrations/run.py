"""Envía lo que cada organización configuró. Corre como trabajo `integrations` (cada hora, en :20).

Un envío fallido se registra, no mueve su estado y lo reintenta la siguiente corrida. Una organización no detiene a las
demás. Sale con 1 si algún envío falló, para que el timer lo note.

Primer aviso: si una organización activa Slack por primera vez, el cursor se fija en el último evento y no sale nada.
Así no llega de golpe todo el historial de cambios.
"""
import sys
from contextlib import closing
from datetime import datetime
from urllib.error import HTTPError
from zoneinfo import ZoneInfo

import analytics
from analytics.labels import CHAIN_LABEL, PLAZA_LABEL, THEM
from auth import connect as connect_auth
from auth import mail, orgs
from scraper import config

from . import digest, slack

PLAZA = "cdmx"


def main():
    now = datetime.now(ZoneInfo(config.PILOT_TIMEZONE))
    failed = 0
    with closing(connect_auth()) as conn, closing(analytics.connect()) as aconn:
        for org in orgs.list_orgs(conn):
            failed += _run_org(conn, aconn, org["id"], orgs.integrations(conn, org["id"]), now)
    return 1 if failed else 0


def _run_org(conn, aconn, org_id, settings, now):
    """Envíos fallidos de la organización."""
    failed = 0
    if settings.get("slack_webhook"):
        failed += _attempt(f"org {org_id} slack", _slack, conn, aconn, org_id, settings)
    if settings.get("digest_recipients") and digest.due(now, settings.get("digest_last_week")):
        failed += _attempt(f"org {org_id} resumen", _digest, conn, aconn, org_id, settings["digest_recipients"], now)
    if settings.get("slack_webhook") and digest.due(now, settings.get("slack_digest_week")):
        failed += _attempt(f"org {org_id} resumen slack", _slack_digest, conn, aconn, org_id,
                           settings["slack_webhook"], now)
    return failed


def _attempt(label, send, *args):
    """Ejecuta un envío. Un fallo se registra y cuenta. Captura Exception porque un envío puede fallar por red,
    por Slack o por SES, y cada uno lanza su propia clase de error."""
    try:
        send(*args)
        return 0
    except Exception as error:
        print(f"{label}: fallo ({type(error).__name__}: {error})", file=sys.stderr)
        return 1


def _slack(conn, aconn, org_id, settings):
    last = settings.get("slack_last_event_id")
    newest = analytics.latest_event_id(aconn)
    if last is None:
        orgs.record_state(conn, org_id, "slack_last_event_id", newest)
        return
    changes = analytics.competitor_changes(aconn, since_id=last, plaza=PLAZA)
    if changes:
        slack.post(settings["slack_webhook"], {"text": slack.message(changes, CHAIN_LABEL[THEM], PLAZA_LABEL[PLAZA])})
        print(f"org {org_id} slack: {len(changes)} cambios enviados")
    cursor = changes[-1]["id"] if changes else newest
    if cursor != last:
        orgs.record_state(conn, org_id, "slack_last_event_id", cursor)


def _slack_digest(conn, aconn, org_id, webhook, now):
    period, items = digest.week(aconn, now, PLAZA)
    try:
        slack.post(webhook, slack.findings_payload(items, period, PLAZA_LABEL[PLAZA]))
    except HTTPError as error:
        # Slack responde 400 cuando rechaza un bloque. Se reenvía todo en texto para no perder el resumen.
        if error.code != 400:
            raise
        print(f"org {org_id} resumen slack: bloques nativos rechazados ({error}); se envía en texto", file=sys.stderr)
        slack.post(webhook, slack.findings_payload(items, period, PLAZA_LABEL[PLAZA], native=False))
    orgs.record_state(conn, org_id, "slack_digest_week", now.date().isoformat())
    print(f"org {org_id} resumen enviado a Slack")


def _digest(conn, aconn, org_id, recipients, now):
    subject, text, html = digest.compose(aconn, now, PLAZA)
    for to in recipients:
        mail.send(to, subject, text, html)
    orgs.record_state(conn, org_id, "digest_last_week", now.date().isoformat())
    print(f"org {org_id} resumen enviado a {len(recipients)} destinatarios")


if __name__ == "__main__":
    sys.exit(main())
