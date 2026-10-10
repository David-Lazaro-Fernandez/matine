"""Datos reales para el spike de la fase 0: escribe `dashboard/.spike-data/cartelera.json` con el heatmap día×franja y
el dumbbell de películas de la cartelera, plaza CDMX, del día de hoy al miércoles de la semana de cine en curso (el
periodo por defecto de la cartelera de Streamlit).

Uso, desde la raíz del repo:
  AC_DATA_DIR=/ruta/a/data /usr/bin/python3 dashboard/scripts/spike_data.py

Hace lo mismo que `views/cartelera.py` con esas dos secciones, incluido lo que la vista calcula con pandas. Ese cálculo
y los textos de las gráficas pasan a `analytics/` en las fases 1 y 6; este script se borra entonces.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import analytics  # noqa: E402
from analytics.labels import CHAIN_LABEL, COMPARED, SLOT_SHORT, SLOTS, WEEKDAY_LABEL  # noqa: E402

OUT = ROOT / "dashboard" / ".spike-data" / "cartelera.json"
PLAZA = "cdmx"
SHOWN_MOVIES, TOTAL_MOVIES = 8, 15
# Textos de las dos gráficas tal como los escribe hoy views/cartelera.py.
TEXT = {
    "heatmap_title": "¿Estamos en el horario donde vive la taquilla?",
    "dumbbell_title": "¿A qué películas les damos más pantalla que Cinépolis?",
    "dumbbell_axis": "% de las funciones del periodo",
    "only_cinepolis": "solo Cinépolis",
    "only_cinemex": "solo Cinemex",
}
# Las gráficas reciben el contenido del tooltip ya escrito, como lo arma el tooltip de Altair.
_HEATMAP_TOOLTIP = "% parrilla Cinemex {share_cinemex:.1f} · % parrilla Cinépolis {share_cinepolis:.1f} · Funciones Cinemex {shows_cinemex} · Funciones Cinépolis {shows_cinepolis}"
_DUMBBELL_TOOLTIP = "{chain}: {share:.1f} % de su programación · {shows} funciones · {cinemas} cines"


def _pp(v):
    return f"{v:+.1f} pp".replace("-", "−")


def heatmap(conn, d0, d1):
    cells = analytics.heatmap_day_slot(conn, d0=d0, d1=d1, plaza=PLAZA)
    for c in cells:
        c["gap_pp"] = round((c["share_cinemex"] or 0) - (c["share_cinepolis"] or 0), 1)
        c["day"] = WEEKDAY_LABEL[int(c["weekday"])]
        c["slot_label"] = SLOT_SHORT[c["slot"]]
        c["label"] = _pp(c["gap_pp"]).replace(" pp", "")
        c["tooltip"] = _HEATMAP_TOOLTIP.format(**{k: v or 0 for k, v in c.items()})
    present = {c["day"] for c in cells}
    return {"cells": cells,
            "days": [d for d in WEEKDAY_LABEL if d in present],
            "slots": [SLOT_SHORT[k] for k, _, _, _ in SLOTS],
            "limit": max(1.0, max((abs(c["gap_pp"]) for c in cells), default=0))}


def _abs_gap(m):
    # Una exclusiva pesa lo que su propio share.
    if not m["shows_cinepolis"]:
        return m["share_cinemex"]
    if not m["shows_cinemex"]:
        return m["share_cinepolis"]
    return abs(m["gap_pp"])


def dumbbell(conn, d0, d1):
    movies = analytics.movies_by_chain(conn, d0=d0, d1=d1, limit=60, plaza=PLAZA)[:TOTAL_MOVIES]
    movies = sorted(movies, key=_abs_gap, reverse=True)[:SHOWN_MOVIES]
    for m in movies:
        m["title"] = m["title"].strip()
        m["delta"] = (TEXT["only_cinepolis"] if not m["shows_cinemex"] else
                      TEXT["only_cinemex"] if not m["shows_cinepolis"] else _pp(m["gap_pp"]))
        m["tooltip"] = {chain: _DUMBBELL_TOOLTIP.format(chain=CHAIN_LABEL[chain], share=m[f"share_{chain}"] or 0,
                                                         shows=m[f"shows_{chain}"], cinemas=m[f"cinemas_{chain}"])
                        for chain in COMPARED if m[f"shows_{chain}"]}
        m["winner"] = "cinemex" if not m["shows_cinepolis"] or (m["shows_cinemex"] and m["gap_pp"] >= 0) else "cinepolis"
    return movies


def main():
    today = analytics.today()
    _, week_end = analytics.cinema_week(today)
    conn = analytics.connect()
    try:
        data = {"plaza": PLAZA, "d0": today, "d1": week_end, "text": TEXT,
                "heatmap": heatmap(conn, today, week_end), "dumbbell": dumbbell(conn, today, week_end)}
    finally:
        conn.close()
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{OUT}: {len(data['heatmap']['cells'])} celdas, {len(data['dumbbell'])} películas, {today} a {week_end}")


if __name__ == "__main__":
    main()
