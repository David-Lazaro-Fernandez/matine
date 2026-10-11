"""Datos reales para la vista previa de las gráficas de la oferta independiente: escribe
`dashboard/.spike-data/independientes.json` con las mismas funciones de `analytics/` que llama `views/independientes.py`,
en su periodo por defecto (de hoy al miércoles de la semana de cine en curso).

Uso, desde la raíz del repo:
  AC_DATA_DIR=/ruta/a/data /usr/bin/python3 dashboard/scripts/preview_independientes.py

Se borra cuando el dashboard lea `/api/independientes`.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import analytics  # noqa: E402
from analytics import independents  # noqa: E402

OUT = ROOT / "dashboard" / ".spike-data" / "independientes.json"


def main():
    today = analytics.today()
    _, week_end = analytics.cinema_week(today)
    conn = analytics.connect()
    try:
        occupancy = analytics.occupancy_by_cinema(conn, days=independents.OCCUPANCY_DAYS, chain="cineteca")
        data = {
            "d0": today, "d1": week_end,
            "titles": analytics.independent_titles(conn, d0=today, d1=week_end, limit=15),
            "occupancy": occupancy,
            "occupancy_readable": independents.occupancy_readable(occupancy),
            "overlap": analytics.independent_overlap(conn, d0=today, d1=week_end, limit=15),
            "slots": analytics.independent_slots(conn, d0=today, d1=week_end),
        }
    finally:
        conn.close()
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{OUT}: {len(data['titles'])} títulos, {len(occupancy)} celdas de ocupación, {today} a {week_end}")


if __name__ == "__main__":
    main()
