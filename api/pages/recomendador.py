"""Página Recomendador: las funciones cerca de un punto que caben en el presupuesto de un grupo (`analytics/recommender.py`).

`GET /api/recomendador` devuelve todo lo que pinta la página para un día `d0`. Sin `lat` y `lng` solo trae los límites
del formulario; sin personas en el grupo trae las películas cercanas y ningún resultado. Las horas van de `h0` a `h1`.
`GET /api/recomendador/geocodificar` convierte una dirección en coordenadas con Nominatim. Va aparte porque hace red y
no lee `snapshots.db`.
"""
import functools
from datetime import date, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from typing_extensions import TypedDict

import analytics
from analytics import recommender
from analytics.labels import FORMAT_BUCKETS
from scraper import geocode

from .. import session
from . import read

router = APIRouter(dependencies=[Depends(session.require_module("cartelera"))])

# Las cadenas publican hasta el miércoles de la semana siguiente.
DAYS_AHEAD = 13
PER_CINEMA, LIMIT = 3, 40
MAX_PER_GROUP = 10
MAX_BUDGET = 20000
MAX_RADIUS_KM = 20


class GeoPoint(TypedDict):
    lat: float
    lng: float
    label: str


class Recomendador(TypedDict):
    d0: str
    min_date: str
    max_date: str
    per_cinema: int
    limit: int
    titles: list[dict[str, Any]]
    summary: dict[str, Any] | None
    results: list[dict[str, Any]]
    snacks_unpriced: list[dict[str, Any]]
    unpriced: list[dict[str, Any]]


@router.get("/recomendador")
def recomendador(lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
                 lng: Annotated[float | None, Query(ge=-180, le=180)] = None,
                 d0: date | None = None,
                 adults: Annotated[int, Query(ge=0, le=MAX_PER_GROUP)] = 2,
                 children: Annotated[int, Query(ge=0, le=MAX_PER_GROUP)] = 0,
                 seniors: Annotated[int, Query(ge=0, le=MAX_PER_GROUP)] = 0,
                 budget: Annotated[float, Query(ge=0, le=MAX_BUDGET)] = 0,
                 snacks: Literal[recommender.SNACK_PACKAGES] = "none",
                 h0: Annotated[int, Query(ge=0, le=23)] = 0, h1: Annotated[int, Query(ge=1, le=24)] = 24,
                 radius_km: Annotated[int, Query(ge=1, le=MAX_RADIUS_KM)] = 5,
                 sort: Literal[recommender.SORTS] = "distance",
                 title_norm: Annotated[str | None, Query(max_length=200)] = None,
                 formats: Annotated[list[Literal[tuple(FORMAT_BUCKETS)]] | None, Query(max_length=20)] = None,
                 ) -> Recomendador:
    """Películas cercanas, resumen, funciones que caben, las de dulcería sin precio y las de boletos sin precio.
    `budget=0` es sin presupuesto. Sin `d0`, hoy."""
    today = date.fromisoformat(analytics.today())
    max_date = (today + timedelta(days=DAYS_AHEAD)).isoformat()
    day = d0.isoformat() if d0 else today.isoformat()
    if not today.isoformat() <= day <= max_date:
        raise HTTPException(422, f"La fecha debe estar entre {today.isoformat()} y {max_date}.")
    if h0 >= h1:
        raise HTTPException(422, "`h0` debe ser menor que `h1`.")
    if (lat is None) != (lng is None):
        raise HTTPException(422, "`lat` y `lng` van juntos.")
    base = {"d0": day, "min_date": today.isoformat(), "max_date": max_date, "per_cinema": PER_CINEMA, "limit": LIMIT,
            "titles": [], "summary": None, "results": [], "snacks_unpriced": [], "unpriced": []}
    if lat is None:
        return base
    point = (round(lat, 5), round(lng, 5))
    area = {"d0": day, "d1": day, "hours": (h0, h1), "radius_km": float(radius_km)}
    filters = {**area, "adults": adults, "children": children, "seniors": seniors, "snacks": snacks,
               "budget": float(budget) or None, "title_norm": title_norm,
               "formats": tuple(sorted(set(formats))) if formats else None}

    def compute(conn):
        out = {**base, "titles": analytics.recommend_titles(conn, *point, **area)}
        if not adults + children + seniors:
            return out
        summary = analytics.recommend_summary(conn, *point, **filters)
        listed = {"sort": sort, "per_cinema": PER_CINEMA, "limit": LIMIT, **filters}
        out.update(
            summary=summary,
            results=analytics.recommend(conn, *point, **listed),
            snacks_unpriced=analytics.recommend(conn, *point, status="snacks_unpriced", **listed)
            if snacks != "none" and summary["snacks_unpriced"] else [],
            unpriced=analytics.recommend(conn, *point, status="unpriced", sort="distance", limit=LIMIT, **filters))
        return out

    return read(("recomendador", point, sort, *sorted(filters.items())), compute)


# ponytail: caché en memoria sin vencimiento hasta reiniciar el proceso. Nominatim pide no repetir consultas.
@functools.lru_cache(maxsize=512)
def _geocode(address):
    return geocode.geocode(address)


@router.get("/recomendador/geocodificar")
def geocodificar(q: Annotated[str, Query(min_length=1, max_length=200)]) -> GeoPoint | None:
    """Coordenadas de la dirección `q` y la dirección que entendió el servicio, o null si no la encontró. 502 si el
    servicio no responde."""
    address = q.strip()
    if not address:
        raise HTTPException(422, "`q` está vacía.")
    try:
        return _geocode(address)
    except geocode.ApiError:
        raise HTTPException(502) from None
