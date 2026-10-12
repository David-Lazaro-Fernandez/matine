"""Mensajes para Slack por webhook de entrada: avisos de la competencia y el resumen de hallazgos.

Slack no lee HTML ni Markdown estándar. Usa mrkdwn (`*negrita*`, `_cursiva_`, bloques de código) y Block Kit. Un webhook
de entrada no sube imágenes, así que las gráficas son barras de texto dentro de un bloque de código. Los mensajes no
llevan emojis.
"""
import json
import urllib.request
from collections import Counter

from analytics.labels import CHAIN_LABEL, time_12

from . import digest

MAX_LINES = 12
TIMEOUT_S = 15
BAR_CELLS = 20
FILL = "█"
EMPTY = "Esta semana no hay hallazgos que crucen su umbral."
# Cinemex primero, como en el correo y en el dashboard.
CHAIN_ORDER = ("cinemex", "cinepolis")
ROW_LABEL_MAX = 60


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
    """Payload del resumen: un encabezado, y por hallazgo su conclusión, su gráfica, su contexto y su sugerencia."""
    title = f"Hallazgos · {period} · {plaza_label}"
    blocks = [{"type": "header", "text": {"type": "plain_text", "text": title[:150], "emoji": False}}]
    if not items:
        blocks.append(_section(EMPTY))
    for index, finding in enumerate(items):
        if index:
            blocks.append({"type": "divider"})
        blocks.append(_section(f"*{_esc(finding['label'])}*"))
        if finding["chart"]:
            blocks.append(_section(_chart_block(finding["chart"])))
        if finding["context"]:
            blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text": _esc(finding["context"])}]})
        if finding["action"]:
            blocks.append(_section(_esc(finding["action"])))
    return {"text": title, "blocks": blocks}


def post(url, payload):
    """Publica `payload` (`{"text": …}` o con `blocks`) en el webhook. Lanza OSError si Slack no lo acepta."""
    request = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                     headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
        response.read()


def _chart_block(chart):
    """Barras de texto en un bloque de código. La barra más larga de la gráfica ocupa todo el ancho; con escala fija de
    100 %, un 6.7 % no se distinguiría. El valor de cada barra va al final, sin redondear por la escala."""
    series = _series(chart)
    scale = max((abs(v) for row in chart["rows"] for v in row["values"].values()), default=1) or 1
    width = max((len(CHAIN_LABEL[c]) for c in series), default=0)
    lines = []
    for row in chart["rows"]:
        lines.append(_esc(row["label"][:ROW_LABEL_MAX]))
        for chain in series:
            if chain not in row["values"]:
                continue
            value = row["values"][chain]
            cells = round(abs(value) / scale * BAR_CELLS)
            bar = (FILL * cells).ljust(BAR_CELLS)
            lines.append(f"  {CHAIN_LABEL[chain].ljust(width)}  {bar}  {_esc(digest.chart_value(value, chart['unit']))}")
    return "```\n" + "\n".join(lines) + "\n```"


def _series(chart):
    seen = {c for row in chart["rows"] for c in row["values"]}
    return [c for c in CHAIN_ORDER if c in seen] + sorted(seen - set(CHAIN_ORDER))


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
