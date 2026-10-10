"""Datos reales para la vista previa de las gráficas de formatos y preventa: escribe
`dashboard/.spike-data/formatos_preventa.json` con las mismas funciones de `analytics/` que llama `views/cartelera.py`,
plaza CDMX, del día de hoy al miércoles de la semana de cine en curso.

Uso, desde la raíz del repo:
  AC_DATA_DIR=/ruta/a/data /usr/bin/python3 dashboard/scripts/preview_formatos_preventa.py

La curva de venta es la del primer título de `presale_compare`, el que la vista elige por defecto.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import analytics  # noqa: E402

OUT = ROOT / "dashboard" / ".spike-data" / "formatos_preventa.json"
PLAZA = "cdmx"


def main():
    today = analytics.today()
    _, week_end = analytics.cinema_week(today)
    conn = analytics.connect()
    try:
        compare = analytics.presale_compare(conn, plaza=PLAZA)
        first = compare[0] if compare else {}
        curves = {chain: analytics.presale_curve(conn, first[f"title_norm_{chain}"], chain=chain, plaza=PLAZA)
                  for chain in analytics.labels.COMPARED if first.get(f"title_norm_{chain}")}
        data = {"plaza": PLAZA, "d0": today, "d1": week_end,
                "mix": analytics.mix(conn, d0=today, d1=week_end, plaza=PLAZA),
                "presale": analytics.presale_by_chain(conn, plaza=PLAZA),
                "curve_title": first.get("title"), "curves": curves}
    finally:
        conn.close()
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{OUT}: {len(data['mix'])} filas de mezcla, {len(data['presale'])} de preventa, curva de {data['curve_title']}")


if __name__ == "__main__":
    main()
