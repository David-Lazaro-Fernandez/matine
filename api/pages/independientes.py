"""Página Independientes: la Cineteca Nacional frente a nuestra cartelera de CDMX, fuera del head-to-head.

`GET /api/independientes` devuelve todo lo que pinta la página. Cada consulta pide `chain="cineteca"` explícito, así la
Cineteca nunca entra a los shares Cinemex↔Cinépolis. El periodo va de ayer al miércoles de la semana de cine en curso,
que es hasta donde publica la Cineteca. Sin `d0` y `d1`, de hoy a ese miércoles. La Cineteca solo tiene sedes en CDMX:
con otra plaza la respuesta trae `supported=False` y las listas vacías. Sin `plaza`, nacional.
"""
from datetime import date, timedelta
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from typing_extensions import TypedDict

import analytics
from analytics import independents
from scraper import plazas

from . import read
from .cartelera import FIRST_SNAPSHOT

router = APIRouter()

INDEP_CHAIN = "cineteca"
TOP_TITLES = 15
BOARD_LIMIT = 1000


class Thresholds(TypedDict):
    occupancy_days: int
    occupancy_min_samples: int
    indep_min_sold_pct: float
    indep_min_samples: int


class Independientes(TypedDict):
    plaza: str | None
    supported: bool
    d0: str
    d1: str
    min_date: str
    max_date: str
    first_snapshot: str
    occupancy_confirmed: bool
    thresholds: Thresholds
    venues: list[dict[str, Any]]
    conclusions: dict[str, str]
    findings: list[dict[str, Any]]
    titles: list[dict[str, Any]]
    occupancy: list[dict[str, Any]]
    occupancy_samples: int
    occupancy_readable: bool
    occupancy_titles: list[dict[str, Any]]
    overlap: list[dict[str, Any]]
    overlap_top: list[dict[str, Any]]
    slots: list[dict[str, Any]]
    board: list[dict[str, Any]]
    capacity: list[dict[str, Any]]


@router.get("/independientes")
def independientes(d0: date | None = None, d1: date | None = None,
                   plaza: Literal[tuple(plazas.PLAZAS)] | None = None) -> Independientes:
    """Cartelera, ocupación, solape y franjas de la Cineteca en `d0`–`d1`, con los hallazgos de su tema."""
    today = date.fromisoformat(analytics.today())
    week_end = analytics.cinema_week(today.isoformat())[1]
    min_date = (today - timedelta(days=1)).isoformat()
    d0 = d0.isoformat() if d0 else today.isoformat()
    d1 = d1.isoformat() if d1 else week_end
    if not min_date <= d0 <= d1 <= week_end:
        raise HTTPException(422, f"El periodo debe estar entre {min_date} y {week_end}.")
    supported = plaza in (None, "cdmx")
    base = {"plaza": plaza, "supported": supported, "d0": d0, "d1": d1, "min_date": min_date, "max_date": week_end,
            "first_snapshot": FIRST_SNAPSHOT,
            "occupancy_confirmed": independents.OCCUPANCY_CONFIRMED,
            "thresholds": {"occupancy_days": independents.OCCUPANCY_DAYS,
                           "occupancy_min_samples": independents.OCCUPANCY_MIN_SAMPLES,
                           "indep_min_sold_pct": independents.INDEP_MIN_SOLD_PCT,
                           "indep_min_samples": independents.INDEP_MIN_SAMPLES}}
    empty = {"venues": [], "conclusions": {}, "findings": [], "titles": [], "occupancy": [], "occupancy_samples": 0,
             "occupancy_readable": False, "occupancy_titles": [], "overlap": [], "overlap_top": [], "slots": [],
             "board": [], "capacity": []}
    if not supported:
        return {**base, **empty}

    def compute(conn):
        window = {"d0": d0, "d1": d1}
        occupancy = analytics.occupancy_by_cinema(conn, days=independents.OCCUPANCY_DAYS, chain=INDEP_CHAIN)
        readable = independents.occupancy_readable(occupancy)
        by_title = analytics.occupancy_by_title(conn, days=independents.OCCUPANCY_DAYS, chain=INDEP_CHAIN,
                                                min_samples=independents.INDEP_MIN_SAMPLES) if readable else []
        return {
            **base,
            "venues": analytics.independent_summary(conn, **window, chain=INDEP_CHAIN),
            "conclusions": analytics.independent_conclusions(conn, **window),
            "findings": [f for f in analytics.findings(conn, **window, top=None, plaza=plaza)
                         if f["topic"] == "independientes"],
            "titles": analytics.independent_titles(conn, **window, chain=INDEP_CHAIN, limit=TOP_TITLES),
            "occupancy": occupancy,
            "occupancy_samples": sum(r["samples"] for r in occupancy),
            "occupancy_readable": readable,
            "occupancy_titles": sorted(by_title, key=lambda r: (-r["sold_pct"], r["title_norm"])),
            "overlap": analytics.independent_overlap(conn, **window, chain=INDEP_CHAIN),
            "overlap_top": analytics.independent_overlap(conn, **window, chain=INDEP_CHAIN, limit=TOP_TITLES),
            "slots": analytics.independent_slots(conn, **window, chain=INDEP_CHAIN),
            "board": analytics.independent_titles(conn, **window, chain=INDEP_CHAIN, limit=BOARD_LIMIT),
            "capacity": analytics.capacity_by_cinema(conn, chain=INDEP_CHAIN),
        }

    return read(("independientes", plaza, d0, d1), compute)
