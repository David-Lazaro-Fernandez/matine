"""Datos reales para la vista previa de las gráficas de butacas y de corridas: escribe
`dashboard/.spike-data/butacas_ocupacion.json` con las filas que reciben los componentes.

Uso, desde la raíz del repo:
  AC_DATA_DIR=/ruta/a/data /usr/bin/python3 dashboard/scripts/preview_butacas_ocupacion.py

Llama a las mismas funciones que `views/cartelera.py` (apéndice "butacas") y `views/operaciones.py` ("corridas"), con
plaza CDMX, de hoy al miércoles de la semana de cine y todo el día. Solo lee la base.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import analytics  # noqa: E402
from analytics.labels import COMPARED  # noqa: E402
from scraper import health  # noqa: E402

OUT = ROOT / "dashboard" / ".spike-data" / "butacas_ocupacion.json"
PLAZA = "cdmx"
TOTAL_MOVIES = 15
RUN_DAYS = 7


def main():
    today = analytics.today()
    _, week_end = analytics.cinema_week(today)
    conn = analytics.connect()
    try:
        data = {"d0": today, "d1": week_end,
                "seats": {chain: analytics.offered_by_title(conn, d0=today, d1=week_end, limit=TOTAL_MOVIES, chain=chain,
                                                            plaza=PLAZA)
                          for chain in COMPARED},
                "runs": health.recent_runs(conn, days=RUN_DAYS)}
    finally:
        conn.close()
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{OUT}: {', '.join(f'{c} {len(r)} películas' for c, r in data['seats'].items())}, {len(data['runs'])} corridas")


if __name__ == "__main__":
    main()
