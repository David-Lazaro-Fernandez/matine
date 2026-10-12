"""Página Mapa: cada cine con coordenadas, su ficha y los destacados de cada cadena (`analytics/cinema_locations.py`).

`GET /api/mapa` devuelve todo lo que pinta la página, de hoy al miércoles de la semana de cine. Sin `plaza`, todo el
país. `cinema_ids` acota destacados, puntos y tabla a esos cines; `options` siempre lista los cines de la zona. Las
filas van tal cual las devuelve `analytics/`, salvo `sites`: cada lugar lleva `cinema_ids` y no las filas completas, que
ya vienen en `cinemas`. Dónde cae cada punto y su radio los calcula el frontend.
"""
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from typing_extensions import TypedDict

import analytics
from analytics.cinema_locations import MAP_CHAINS
from scraper import plazas

from .. import session
from . import read

router = APIRouter(dependencies=[Depends(session.require_module("cartelera"))])


class CinemaOption(TypedDict):
    chain: str
    cinema_id: str
    cinema_name: str


class Mapa(TypedDict):
    plaza: str | None
    d0: str
    d1: str
    options: list[CinemaOption]
    cinemas: list[dict[str, Any]]
    highlights: list[dict[str, Any]]
    sites: list[dict[str, Any]]


@router.get("/mapa")
def mapa(plaza: Literal[tuple(plazas.PLAZAS)] | None = None,
         chains: Annotated[list[Literal[MAP_CHAINS]] | None, Query(max_length=len(MAP_CHAINS))] = None,
         cinema_ids: Annotated[list[str] | None, Query(max_length=500)] = None) -> Mapa:
    """Cines de `chains` (todas si no se dan) en la zona. `cinemas`, `highlights` y `sites` se acotan a `cinema_ids`."""
    d0 = analytics.today()
    d1 = analytics.cinema_week(d0)[1]
    chains = tuple(c for c in MAP_CHAINS if c in (chains or MAP_CHAINS))
    picked = tuple(sorted(set(cinema_ids or ()))) or None
    scope = {"d0": d0, "d1": d1, "plaza": plaza, "chains": chains}

    def compute(conn):
        zone = analytics.cinema_map(conn, **scope)
        return {
            **scope,
            "options": [{k: r[k] for k in ("chain", "cinema_id", "cinema_name")} for r in zone],
            "cinemas": analytics.cinema_map(conn, **scope, cinema_ids=picked) if picked else zone,
            "highlights": analytics.cinema_highlights(conn, **scope, cinema_ids=picked),
            "sites": [{"site_id": site["site_id"], "chain": site["chain"], "lat": site["lat"], "lng": site["lng"],
                       "cinema_ids": [r["cinema_id"] for r in site["cinemas"]]}
                      for site in analytics.cinema_sites(conn, **scope, cinema_ids=picked)],
        }

    return read(("mapa", d0, plaza, chains, picked), compute)
