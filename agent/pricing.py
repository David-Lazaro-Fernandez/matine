"""Precio de los modelos y costo estimado de una pregunta.

`model_prices.csv` lo mantiene una persona: cada fila es un modelo con su precio en dólares por millón de tokens y la
fecha en que se verificó contra la página del proveedor. El costo se calcula al consultar, con el precio vigente en la
fecha de la pregunta, así un cambio de precio no reescribe la historia. Un modelo sin precio devuelve `None`: nunca se
estima un precio que nadie verificó.

El costo es un tope: la auditoría no distingue los tokens de entrada que salieron de la caché del proveedor, y todos
se cobran como entrada sin caché. Tampoco conoce los festivos que algunos proveedores tratan como fuera de hora pico.
Ejemplo: `cost("deepseek-flash", "2026-10-14T22", 1_000_000, 0)` → `0.15`.
"""
import csv
from datetime import datetime
from functools import lru_cache
from pathlib import Path

PRICES_PATH = Path(__file__).with_name("model_prices.csv")


def _deepseek_peak(moment):
    """DeepSeek cobra el doble de lunes a viernes de 01:00 a 04:00 y de 06:00 a 10:00 UTC (verificado 2026-10-14)."""
    return moment.weekday() < 5 and (1 <= moment.hour < 4 or 6 <= moment.hour < 10)


# Regla de hora pico por nombre (columna `peak` del CSV): cuántas veces sube el precio y cuándo.
_PEAK_RULES = {"deepseek": (2, _deepseek_peak)}


@lru_cache(maxsize=1)
def _prices():
    with open(PRICES_PATH, encoding="utf-8", newline="") as fh:
        return sorted(csv.DictReader(fh), key=lambda r: r["valid_from"])


def cost(model, hour, tokens_in, tokens_out):
    """Dólares estimados de `tokens_in` y `tokens_out` de `model` en `hour` (UTC, '2026-10-14T22'), o None si el modelo
    no tiene precio vigente ese día."""
    moment = datetime.strptime(hour, "%Y-%m-%dT%H")
    found = [p for p in _prices() if p["model"] == model and p["valid_from"] <= moment.date().isoformat()]
    if not found:
        return None
    price = found[-1]
    multiplier, is_peak = _PEAK_RULES.get(price["peak"], (1, lambda _: False))
    factor = multiplier if is_peak(moment) else 1
    return factor * (tokens_in * float(price["input_per_mtok"]) + tokens_out * float(price["output_per_mtok"])) / 1_000_000
