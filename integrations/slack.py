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
# Límites del bloque `data_visualization` (docs.slack.dev, verificado 2026-10-12).
NATIVE_CHARTS_PER_MESSAGE = 2
NATIVE_MAX_CATEGORIES = 20
NATIVE_MAX_SERIES = 12
NATIVE_LABEL_MAX = 20
NATIVE_TITLE_MAX = 50
# Formas de `chart` que el bloque nativo dibuja. Las de dos cadenas unidas (dumbbell) y las divergentes siguen en texto.
NATIVE_KINDS = ("bars", "meter", "stack")
UNIT_TITLE = {"pct": "Porcentaje por cadena", "money": "Precio por cadena", "count": "Cantidad por cadena",
              "pp": "Diferencia en puntos", "pct_diff": "Diferencia en porcentaje", "pace": "Ritmo por cadena"}
UNIT_AXIS = {"pct": "%", "money": "MXN", "pp": "pp", "pct_diff": "%"}


def message(changes, chain_label, plaza_label):
    """Aviso de cambios en mrkdwn. `changes` viene de `analytics.competitor_changes`, en orden de id."""
    counts = Counter(change["kind_label"] for change in changes)
    head = f"*{_esc(chain_label)} en {_esc(plaza_label)}*: {len(changes)} cambios desde el último aviso."
    summary = " · ".join(f"{label}: {n}" for label, n in counts.items())
    lines = [_line(change) for change in changes[:MAX_LINES]]
    rest = len(changes) - MAX_LINES
    tail = [f"… y {rest} más."] if rest > 0 else []
    return "\n".join([head, summary, *lines, *tail])


def findings_payload(items, period, plaza_label, native=True):
    """Payload del resumen: un encabezado, y por hallazgo su conclusión, su gráfica, su contexto y su sugerencia.

    Con `native`, las gráficas que cumplen el bloque `data_visualization` salen nativas, hasta dos por mensaje. Las demás,
    y todas si `native` es falso, salen como barras de texto.
    """
    title = f"Hallazgos · {period} · {plaza_label}"
    blocks = [{"type": "header", "text": {"type": "plain_text", "text": title[:150], "emoji": False}}]
    if not items:
        blocks.append(_section(EMPTY))
    native_left = NATIVE_CHARTS_PER_MESSAGE if native else 0
    for index, finding in enumerate(items):
        if index:
            blocks.append({"type": "divider"})
        blocks.append(_section(f"*{_esc(finding['label'])}*"))
        if finding["chart"]:
            if native_left and _native_ok(finding["chart"]):
                blocks.append(_native_block(finding["chart"]))
                native_left -= 1
            else:
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


def _native_ok(chart):
    """Cumple los límites del bloque nativo: forma soportada, todas las cadenas en cada categoría, nombres sin
    repetir y todo dentro de 20 caracteres. Si no cumple, la gráfica sale como texto."""
    series = _series(chart)
    categories = [_short(row["label"], NATIVE_LABEL_MAX) for row in chart["rows"]]
    complete = all(all(c in row["values"] for c in series) for row in chart["rows"])
    return (chart["kind"] in NATIVE_KINDS and 0 < len(chart["rows"]) <= NATIVE_MAX_CATEGORIES
            and 0 < len(series) <= NATIVE_MAX_SERIES and complete and len(set(categories)) == len(categories))


def _native_block(chart):
    """Bloque `data_visualization` de barras: una categoría por fila y una serie por cadena."""
    series = _series(chart)
    categories = [_short(row["label"], NATIVE_LABEL_MAX) for row in chart["rows"]]
    axis = {"categories": categories}
    if chart["unit"] in UNIT_AXIS:
        axis["y_label"] = UNIT_AXIS[chart["unit"]]
    return {
        "type": "data_visualization",
        "title": UNIT_TITLE.get(chart["unit"], "Comparación por cadena")[:NATIVE_TITLE_MAX],
        "chart": {
            "type": "bar",
            "series": [{"name": CHAIN_LABEL[chain], "data": [
                {"label": category, "value": row["values"][chain]}
                for category, row in zip(categories, chart["rows"])]} for chain in series],
            "axis_config": axis,
        },
    }


def _short(text, limit):
    """Recorta a `limit` caracteres con puntos suspensivos al final."""
    return text if len(text) <= limit else text[:limit - 1] + "…"


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
