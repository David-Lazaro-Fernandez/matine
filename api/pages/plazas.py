"""Las plazas con cines en la base, para el selector de zona de todas las páginas (`analytics.plazas`).

`GET /api/plazas` devuelve la lista en el orden de `scraper.plazas.PLAZAS`. Nacional no va en la lista: es no mandar
`plaza` a los demás endpoints.
"""
from fastapi import APIRouter
from typing_extensions import TypedDict

import analytics

from . import read

router = APIRouter()


class Plaza(TypedDict):
    plaza: str
    cinemas_cinemex: int
    cinemas_cinepolis: int


@router.get("/plazas")
def plazas() -> list[Plaza]:
    """Plazas definidas que tienen cines en la base, con cuántos cines tiene cada cadena."""
    return read(("plazas",), analytics.plazas)
