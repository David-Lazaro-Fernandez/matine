"""Resumen semanal por correo: los hallazgos de la plaza, el lunes después de las 9 h (hora de la plaza).

Sale una vez por semana. La fecha del último envío se guarda en la organización: si un envío falla, la siguiente
corrida lo reintenta. El correo lleva texto y HTML. El HTML usa tablas y CSS en línea, sin SVG ni JavaScript, porque
Gmail y Outlook no los ejecutan. Por eso cada gráfica es una tabla con barras de ancho proporcional.
"""
from html import escape
from string import Template
from urllib.parse import urlencode

from analytics import cinema_week, findings
from analytics.labels import CHAIN_COLOR, CHAIN_LABEL, GRAY, GRAY_LIGHT, INK, LINE, PAPER, range_short
from scraper import config

TOP = 5
SEND_FROM_HOUR = 9
# Ruta del dashboard que muestra cada tema de hallazgo (`theme`, ver `FINDING_THEME_LABEL`). Sin tema, la pantalla de Hallazgos.
THEME_PATH = {"programacion": "programacion", "preventa": "preventa", "precios": "precios", "cines": "cines",
              "dulceria": "dulceria", "independientes": "independientes"}
EMPTY = "Esta semana no hay hallazgos que crucen su umbral."
# Cinemex primero, como en todas las escalas del dashboard.
CHAIN_ORDER = ("cinemex", "cinepolis")
FONT = "Arial,Helvetica,sans-serif"

_PAGE = Template("""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>$subject</title></head>
<body style="margin:0;padding:0;background:$gray_light;">
<div style="display:none;max-height:0;overflow:hidden;">$preheader</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:$gray_light;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0"
  style="max-width:600px;width:100%;background:$paper;border-radius:8px;">
<tr><td style="padding:28px 28px 4px;font:600 20px/1.3 $font;color:$ink;">Hallazgos</td></tr>
<tr><td style="padding:0 28px 16px;font:14px/1.5 $font;color:$gray;">$period</td></tr>
<tr><td style="padding:0 28px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">$body</table>
</td></tr>
</table>
</td></tr>
</table>
</body></html>""")

_ITEM = Template("""<tr><td style="padding:18px 0;border-top:1px solid $line;">
<p style="margin:0 0 6px;font:600 15px/1.45 $font;color:$ink;">$label</p>
$chart$context$action</td></tr>""")

_LINK = Template('<p style="margin:10px 0 0;font:600 14px/1.5 $font;"><a href="$url" style="color:$ink;">Ver más</a></p>')
_ACTION = Template('<p style="margin:10px 0 0;font:14px/1.5 $font;color:$gray;">$action</p>')
_CONTEXT = Template('<p style="margin:8px 0 0;font:13px/1.5 $font;color:$gray;">$context</p>')


def due(now, last_sent):
    """Lunes, ya pasadas las 9 h, y sin envío de hoy. `last_sent` es la fecha ISO del último envío o None."""
    return now.weekday() == 0 and now.hour >= SEND_FROM_HOUR and last_sent != now.date().isoformat()


def week(conn, now, plaza):
    """(periodo, hallazgos): de hoy al miércoles de la semana de cine, todo el día, en el orden de fuerza del dashboard.

    Es el mismo alcance que la pantalla Hallazgos por defecto. Si cambia uno de los dos, el correo, Slack y la pantalla
    dejan de coincidir. Cada hallazgo trae `url`, el enlace "Ver más" con ese mismo alcance.
    """
    today = now.date().isoformat()
    _, week_end = cinema_week(today)
    items = findings(conn, d0=today, d1=week_end, plaza=plaza, top=None)[:TOP]
    for item in items:
        item["url"] = view_url(item.get("theme"), plaza, today, week_end)
    return range_short(today, week_end), items


def view_url(theme, plaza, d0, d1):
    """Enlace al dashboard con el alcance del resumen. `config.BASE_URL` sale de AC_BASE_URL."""
    path = THEME_PATH.get(theme, "")
    return f"{config.BASE_URL}/{path}?{urlencode({'plaza': plaza, 'd0': d0, 'd1': d1})}"


def compose(conn, now, plaza):
    """(asunto, texto, html) del correo. Cada hallazgo trae su conclusión, su gráfica, su contexto y su sugerencia."""
    period, items = week(conn, now, plaza)
    subject = f"Hallazgos · {period}"
    return subject, _text(items), _html(subject, period, items)


def chart_value(value, unit):
    """Cifra de una gráfica como texto, con la unidad de su hallazgo."""
    if unit == "pp":
        return f"{value:+.1f} pp".replace("-", "−")
    if unit == "pct_diff":
        return f"{value:+.0f} %"
    if unit == "pct":
        return f"{value:.1f} %" if abs(value) < 10 else f"{value:.0f} %"
    if unit == "money":
        return f"${value:,.0f}"
    if unit == "pace":
        return f"{value:.1f}"
    return f"{value:,.0f}"


def _text(items):
    lines = []
    for finding in items:
        lines.append(f"- {finding['label']}")
        if finding["chart"]:
            lines.extend(_chart_text(finding["chart"]))
        if finding["context"]:
            lines.append(f"  {finding['context']}")
        if finding["action"]:
            lines.append(f"  {finding['action']}")
        lines.append(f"  Ver más: {finding['url']}")
    return "\n".join(lines) or EMPTY


def _chart_text(chart):
    series = _series(chart)
    return [f"  {row['label']}: " + " · ".join(f"{CHAIN_LABEL[c]} {chart_value(row['values'][c], chart['unit'])}"
                                              for c in series if c in row["values"])
            for row in chart["rows"]]


def _html(subject, period, items):
    rows = "".join(_item(finding) for finding in items) if items else _ITEM.substitute(
        line=LINE, font=FONT, ink=INK, label=escape(EMPTY), chart="", context="", action="")
    return _PAGE.substitute(subject=escape(subject), period=escape(period), preheader=escape(_preheader(items)),
                            body=rows, gray_light=GRAY_LIGHT, paper=PAPER, ink=INK, gray=GRAY, font=FONT)


def _item(finding):
    context = _CONTEXT.substitute(font=FONT, gray=GRAY, context=escape(finding["context"])) if finding["context"] else ""
    action = _ACTION.substitute(font=FONT, gray=GRAY, action=escape(finding["action"])) if finding["action"] else ""
    link = _LINK.substitute(font=FONT, ink=INK, url=escape(finding["url"]))
    chart = _chart_html(finding["chart"]) if finding["chart"] else ""
    return _ITEM.substitute(line=LINE, font=FONT, ink=INK, label=escape(finding["label"]), chart=chart,
                            context=context, action=action + link)


def _series(chart):
    """Cadenas de la gráfica en orden fijo: Cinemex, Cinépolis y luego las demás."""
    seen = {c for row in chart["rows"] for c in row["values"]}
    return [c for c in CHAIN_ORDER if c in seen] + sorted(seen - set(CHAIN_ORDER))


def _chart_html(chart):
    series = _series(chart)
    scale = 100 if chart["unit"] == "pct" else max(
        (abs(v) for row in chart["rows"] for v in row["values"].values()), default=1) or 1
    if chart["kind"] == "dumbbell":
        body = "".join(_dumbbell_html(row, chart["unit"], series, scale) for row in chart["rows"])
    else:
        body = "".join(_row_html(row, chart["unit"], series, scale) for row in chart["rows"])
    return f"{_legend_html(series)}<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">{body}</table>"


def _row_html(row, unit, series, scale):
    chains = [c for c in series if c in row["values"]]
    weight = "700" if row["highlight"] else "400"
    out = []
    for i, chain in enumerate(chains):
        value = row["values"][chain]
        label = (f'<td rowspan="{len(chains)}" width="34%" valign="top" style="padding:6px 10px 6px 0;'
                 f'font:{weight} 13px/1.4 {FONT};color:{INK};">{escape(row["label"])}</td>') if i == 0 else ""
        out.append(f"<tr>{label}"
                   f'<td width="46%" style="padding:3px 0;">{_bar(value, scale, CHAIN_COLOR[chain])}</td>'
                   f'<td width="20%" style="padding:3px 0 3px 8px;font:13px/1.4 {FONT};color:{INK};'
                   f'white-space:nowrap;">{escape(chart_value(value, unit))}</td></tr>')
    return "".join(out)


def _dumbbell_html(row, unit, series, scale):
    """Dos puntos unidos por una línea: el valor de cada cadena en la misma escala. Las celdas van en porcentaje del
    ancho, sin posicionamiento absoluto, que Outlook no respeta."""
    low, high = sorted((c for c in series if c in row["values"]), key=lambda c: row["values"][c])
    a, b = row["values"][low] / scale * 100, row["values"][high] / scale * 100
    weight = "700" if row["highlight"] else "400"
    values = " · ".join(chart_value(row["values"][c], unit) for c in series if c in row["values"])
    track = (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
             f'<td width="{max(a, 0):.1f}%" style="font-size:0;line-height:0;">&nbsp;</td>'
             f'<td width="10" height="10" valign="middle" bgcolor="{CHAIN_COLOR[low]}" '
             f'style="width:10px;height:10px;border-radius:5px;font-size:0;line-height:0;">&nbsp;</td>'
             f'<td width="{max(b - a, 0):.1f}%" height="2" valign="middle" bgcolor="{LINE}" '
             f'style="height:2px;font-size:0;line-height:0;">&nbsp;</td>'
             f'<td width="10" height="10" valign="middle" bgcolor="{CHAIN_COLOR[high]}" '
             f'style="width:10px;height:10px;border-radius:5px;font-size:0;line-height:0;">&nbsp;</td>'
             f'<td style="font-size:0;line-height:0;">&nbsp;</td></tr></table>')
    return (f'<tr><td width="34%" valign="middle" style="padding:6px 10px 6px 0;'
            f'font:{weight} 13px/1.4 {FONT};color:{INK};">{escape(row["label"])}</td>'
            f'<td width="46%" valign="middle" style="padding:6px 0;">{track}</td>'
            f'<td width="20%" valign="middle" style="padding:6px 0 6px 8px;font:13px/1.4 {FONT};color:{INK};'
            f'white-space:nowrap;">{escape(values)}</td></tr>')


def _bar(value, scale, color):
    """Barra de ancho proporcional. Un valor cercano a cero se ve como una línea fina, no desaparece."""
    width = max(abs(value) / scale * 100, 0.5)
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
            f'<td width="{width:.1f}%" height="10" bgcolor="{color}" style="height:10px;font-size:0;line-height:0;">'
            f'&nbsp;</td><td style="font-size:0;line-height:0;">&nbsp;</td></tr></table>')


def _legend_html(series):
    if len(series) < 2:
        return ""
    items = "".join(
        f'<span style="display:inline-block;margin-right:14px;font:13px/1.4 {FONT};color:{GRAY};">'
        f'<span style="display:inline-block;width:10px;height:10px;background:{CHAIN_COLOR[c]};'
        f'margin-right:6px;"></span>{CHAIN_LABEL[c]}</span>' for c in series)
    return f'<p style="margin:0 0 8px;">{items}</p>'


def _preheader(items):
    """Texto que el cliente de correo muestra junto al asunto: el hallazgo más fuerte."""
    return items[0]["label"] if items else EMPTY
