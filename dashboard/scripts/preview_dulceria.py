"""Datos reales para la vista previa de las gráficas de dulcería: escribe `dashboard/.spike-data/dulceria.json` con lo
que devuelven las mismas funciones de `analytics/` que llama `views/dulceria.py`, plaza CDMX, ambas plataformas y el
primer producto de la canasta (los valores por defecto de los controles de la vista).

Uso, desde la raíz del repo:
  AC_DATA_DIR=/ruta/a/data /usr/bin/python3 dashboard/scripts/preview_dulceria.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import analytics  # noqa: E402

OUT = ROOT / "dashboard" / ".spike-data" / "dulceria.json"
PLAZA = "cdmx"


def main():
    conn = analytics.connect()
    try:
        basket = analytics.concession_basket(conn, plaza=PLAZA)
        product = basket[0] if basket else None
        data = {"delivery_compare": analytics.delivery_compare(conn),
                "basket_row": product,
                "product_by_cinema": analytics.concession_product_by_cinema(conn, product["product_name"], plaza=PLAZA) if product else []}
    finally:
        conn.close()
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{OUT}: {len(data['delivery_compare'])} cubetas, {len(data['product_by_cinema'])} complejos")


if __name__ == "__main__":
    main()
