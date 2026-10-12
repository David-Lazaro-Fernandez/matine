"""Página Proveedores: cuántos cines, salas y funciones de cada cadena da cada distribuidor.

`GET /api/proveedores` devuelve `providers`, las filas de `analytics.provider_reach`. El periodo y la franja son los de
la Cartelera: sin `d0` ni `d1`, de hoy al miércoles de la semana de cine. `plaza` acota; sin ella es nacional. Solo
Cinemex y Cinépolis: las cadenas independientes no traen distribuidor en la captura. Solo la ve el equipo de la
plataforma (`staff`).
"""
from datetime import date
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from typing_extensions import TypedDict

import analytics
from analytics.labels import FULL_DAY, HOUR_MARKS
from scraper import plazas

from .. import session
from . import read

# Solo staff mientras el módulo de distribuidores no se vende.
router = APIRouter(dependencies=[Depends(session.require_staff)])

Plaza = Literal[tuple(plazas.PLAZAS)]
Rows = list[dict[str, Any]]


class Proveedores(TypedDict):
    plaza: str | None
    d0: str
    d1: str
    hours: list[int]
    providers: Rows


def _scope(plaza, d0, d1, h0, h1):
    """Los filtros con sus valores por defecto. 422 si `d0 > d1`, `h0 >= h1` o una hora no está en `HOUR_MARKS`."""
    today = analytics.today()
    d0 = d0.isoformat() if d0 else today
    d1 = d1.isoformat() if d1 else analytics.cinema_week(today)[1]
    if d0 > d1 or h0 >= h1 or not {h0, h1} <= set(HOUR_MARKS):
        raise HTTPException(422)
    return {"d0": d0, "d1": d1, "hours": (h0, h1), "plaza": plaza}


@router.get("/proveedores")
def proveedores(plaza: Plaza | None = None, d0: date | None = None, d1: date | None = None,
                h0: int = FULL_DAY[0], h1: int = FULL_DAY[1]) -> Proveedores:
    """Alcance por distribuidor y cadena (`analytics.provider_reach`) con los filtros de la Cartelera."""
    scope = _scope(plaza, d0, d1, h0, h1)
    key = ("proveedores", analytics.today(), scope["d0"], scope["d1"], scope["hours"], scope["plaza"])
    return read(key, lambda conn: {"plaza": plaza, "d0": scope["d0"], "d1": scope["d1"],
                                   "hours": list(scope["hours"]),
                                   "providers": analytics.provider_reach(conn, **scope)})
