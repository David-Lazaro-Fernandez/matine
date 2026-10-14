"""Uso del asistente de IA de una organización, o de todas: preguntas, tokens y costo estimado por persona, día y modelo.

Los tokens son exactos, los mide cada llamada. El costo es una estimación de `agent.pricing`: `cost_usd` suma solo lo que
tiene precio y `unpriced_tokens` dice cuántos tokens quedaron fuera, para que nadie lea un total incompleto como completo.
"""
from datetime import datetime, timedelta, timezone

from auth import usage

from . import pricing

_SUMS = ("questions", "errors", "tokens_in", "tokens_out")


def _group(rows, key, **labels):
    """Suma las filas por `key(fila)`. `labels`: campos que se copian de la primera fila de cada grupo."""
    groups = {}
    for r in rows:
        g = groups.setdefault(key(r), {**{name: r[field] for name, field in labels.items()}, **dict.fromkeys(_SUMS, 0),
                                       "cost": 0.0, "priced": False, "unpriced_tokens": 0})
        for name in _SUMS:
            g[name] += r[name]
        if r["cost_usd"] is None:
            g["unpriced_tokens"] += r["tokens_in"] + r["tokens_out"]
        else:
            g["cost"] += r["cost_usd"]
            g["priced"] = True
    return [{**{k: v for k, v in g.items() if k not in ("cost", "priced")},
             "tokens": g["tokens_in"] + g["tokens_out"], "cost_usd": round(g["cost"], 4) if g["priced"] else None}
            for g in groups.values()]


def summary(conn, org_id=None, days=30, now=None):
    """Uso de los últimos `days` días de `org_id` (o de todas las organizaciones). Devuelve `since`, `totals` y las listas
    `people`, `days`, `models` y, sin `org_id`, `organizations`; cada una con `questions`, `errors`, `tokens_in`,
    `tokens_out`, `tokens`, `cost_usd` (None sin ningún precio) y `unpriced_tokens`."""
    since = (now or datetime.now(timezone.utc)) - timedelta(days=days)
    rows = usage.hourly(conn, since, org_id)
    for r in rows:
        r["cost_usd"] = pricing.cost(r["model"], r["hour"], r["tokens_in"], r["tokens_out"])
        r["day"] = r["hour"][:10]
    out = {
        "days": days, "since": since.date().isoformat(),
        "totals": (_group(rows, lambda r: 0) or [_empty()])[0],
        "people": sorted(_group(rows, lambda r: r["account_id"], name="name", email="email"), key=lambda g: -g["tokens"]),
        "by_day": sorted(_group(rows, lambda r: r["day"], day="day"), key=lambda g: g["day"]),
        "models": sorted(_group(rows, lambda r: (r["provider"], r["model"]), provider="provider", model="model"),
                         key=lambda g: -g["tokens"]),
    }
    if org_id is None:
        out["organizations"] = sorted(_group(rows, lambda r: r["org_id"], org_id="org_id", name="org_name"),
                                      key=lambda g: -g["tokens"])
    return out


def _empty():
    return {**dict.fromkeys(_SUMS, 0), "tokens": 0, "cost_usd": None, "unpriced_tokens": 0}
