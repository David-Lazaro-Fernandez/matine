"""Mensajes para Slack por webhook de entrada: avisos de la competencia y el resumen de hallazgos.

Slack no lee HTML ni Markdown estándar. Usa mrkdwn (`*negrita*`) y Block Kit. Los mensajes son texto con las cifras
importantes, sin gráficas ni emojis.
"""
import json
import urllib.request
from collections import Counter

from analytics.labels import time_12

MAX_LINES = 12
TIMEOUT_S = 15
EMPTY = "Esta semana no hay hallazgos que crucen su umbral."
FINDINGS = 3


def message(changes, chain_label, plaza_label):
    """Aviso de cambios en mrkdwn. `changes` viene de `analytics.competitor_changes`, en orden de id."""
    counts = Counter(change["kind_label"] for change in changes)
    head = f"*{_esc(chain_label)} en {_esc(plaza_label)}*: {len(changes)} cambios desde el último aviso."
    summary = " · ".join(f"{label}: {n}" for label, n in counts.items())
    lines = [_line(change) for change in changes[:MAX_LINES]]
    rest = len(changes) - MAX_LINES
    tail = [f"… y {rest} más."] if rest > 0 else []
    return "\n".join([head, summary, *lines, *tail])


def findings_payload(items, period, plaza_label):
    """Resumen corto para Slack: los hallazgos más fuertes con su conclusión y su sugerencia, sin gráficas. Las gráficas
    van en el correo, donde se leen bien."""
    title = f"Hallazgos · {period} · {plaza_label}"
    blocks = [{"type": "header", "text": {"type": "plain_text", "text": title[:150], "emoji": False}}]
    if not items:
        blocks.append(_section(EMPTY))
    for index, finding in enumerate(items[:FINDINGS]):
        if index:
            blocks.append({"type": "divider"})
        blocks.append(_section(f"*{_esc(finding['label'])}*"))
        if finding["action"]:
            blocks.append(_section(_esc(finding["action"])))
    return {"text": title, "blocks": blocks}


def post(url, payload):
    """Publica `payload` (`{"text": …}` o con `blocks`) en el webhook. Lanza OSError si Slack no lo acepta."""
    request = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                     headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
        response.read()


def _section(text):
    return {"type": "section", "text": {"type": "mrkdwn", "text": text}}


def _line(change):
    cinema = change["cinema"] or "cine sin nombre"
    return f"• {_esc(change['kind_label'])}: {_esc(change['movie_title'] or '')}, {_esc(cinema)}, {_when(change)}"


def _when(change):
    before, after = change["before_time"], change["after_time"]
    if before and after:
        return f"{time_12(before)} → {time_12(after)}"
    shown = before or after
    return time_12(shown) if shown else "sin hora"


def _esc(text):
    """Escapa lo que mrkdwn lee como formato o como enlace."""
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
