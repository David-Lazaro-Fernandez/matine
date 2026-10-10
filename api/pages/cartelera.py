"""Página Cartelera: Cinemex frente a Cinépolis en tres capas (hallazgos, evidencia y apéndice).

`GET /api/cartelera` devuelve lo que la página pinta al abrir, con los filtros de la barra lateral: zona (`plaza`,
nacional si falta), periodo (`d0`, `d1`; por defecto de hoy al miércoles de la semana de cine) y franja (`h0`, `h1`,
horas de inicio en `HOUR_MARKS`). Los controles dentro de una sección piden sus datos aparte, con los valores por
defecto ya incluidos en la respuesta principal:

- `GET /api/cartelera/curva`: curva de venta de otro título en preventa.
- `GET /api/cartelera/cambios`: registro de cambios filtrado por tipo.
- `GET /api/cartelera/historia`: historial de una función y cartelera tal como estaba.

Las filas van tal cual las devuelve `analytics/`. Solo compara Cinemex y Cinépolis (`COMPARED`), y con el día en curso
solo cuenta funciones que no han empezado (`from_now=True` de `analytics/`).
"""
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query
from typing_extensions import TypedDict

import analytics
from analytics.labels import COMPARED, FULL_DAY, HOUR_MARKS, KIND_LABEL, PRIME_START_HOUR
from jobs import keys as job_keys
from jobs import registry as job_registry
from scraper import plazas

from . import read

router = APIRouter()

# El dumbbell de películas muestra las de mayor diferencia y todas al pedirlo.
SHOWN_MOVIES, TOTAL_MOVIES = 8, 15
FIRST_SNAPSHOT = "2026-09-07"
# La ocupación es una medida, no un cambio de cartelera.
CARTELERA_KINDS = ("added", "removed", "moved", "changed")
_EVENTS_LIMIT = 300
_EVENTS_DAYS = 7
_OCCUPANCY_RECENT = 30
# El Resumen general muestra siempre todo el día y desde las 6 PM, sin el filtro de franja.
_SUMMARY_HOURS = (FULL_DAY, (PRIME_START_HOUR, 24))

Plaza = Literal[tuple(plazas.PLAZAS)]
Chain = Literal[COMPARED]
Rows = list[dict[str, Any]]


class SummaryCut(TypedDict):
    hours: list[int]
    rows: Rows


class Cartelera(TypedDict):
    plaza: str | None
    d0: str
    d1: str
    hours: list[int]
    full_day: bool
    includes_today: bool
    today: str
    week: list[str]
    next_week: list[str]
    next_week_publication: str | None
    snapshot_times: list[str]
    first_snapshot: str
    shown_movies: int
    total_movies: int
    coverage: Rows
    capture: Rows
    kpis: Rows
    findings: Rows
    conclusions: dict[str, Any]
    general_summary: list[SummaryCut]
    movie_gaps: Rows
    heatmap: Rows
    mix: Rows
    presale_compare: Rows
    presale_by_chain: Rows
    presale_curve: dict[str, Rows]
    offered_seats: Rows
    concentration: Rows
    events_by_kind: Rows
    recent_events: Rows
    prices: Rows
    price_summary: dict[str, Any]
    capacity_summary: Rows
    offered_by_title: dict[str, Rows]
    capacity_by_cinema: dict[str, Rows]
    occupancy_summary: Rows
    semaphore_calibration: Rows
    occupancy_total: dict[str, Any]
    estimated_occupancy: Rows
    occupancy_recent: Rows


class Historia(TypedDict):
    chain: str
    cinemas: Rows
    cinema_id: str | None
    dates: list[str]
    date: str | None
    functions: Rows
    show_id: str | None
    timeline: Rows
    snapshots: list[str]
    as_of: str | None
    board: Rows


def _curves(conn, title_norms, plaza):
    """Curva de venta por cadena; `title_norms` es `{chain: title_norm}` y una cadena sin título no lleva curva."""
    return {c: analytics.presale_curve(conn, t, chain=c, plaza=plaza) for c, t in title_norms.items() if t}


def _next_week(today):
    _, w1 = analytics.cinema_week(today)
    return analytics.cinema_week((date.fromisoformat(w1) + timedelta(days=1)).isoformat())


@router.get("/cartelera")
def cartelera(plaza: Plaza | None = None, d0: date | None = None, d1: date | None = None,
              h0: int = FULL_DAY[0], h1: int = FULL_DAY[1]) -> Cartelera:
    """Las tres capas de la cartelera para la zona, el periodo y la franja. 422 si `d0 > d1`, `h0 >= h1` o una hora no está en `HOUR_MARKS`."""
    today = analytics.today()
    week = analytics.cinema_week(today)
    d0 = d0.isoformat() if d0 else today
    d1 = d1.isoformat() if d1 else week[1]
    # Solo corta en los límites de las franjas, así ninguna queda partida.
    if d0 > d1 or h0 >= h1 or not {h0, h1} <= set(HOUR_MARKS):
        raise HTTPException(422)
    hours = (h0, h1)
    scope = {"d0": d0, "d1": d1, "hours": hours, "plaza": plaza}

    def compute(conn):
        next_week = _next_week(today)
        presale_compare = analytics.presale_compare(conn, plaza=plaza)
        first = presale_compare[0] if presale_compare else {}
        calibration = analytics.semaphore_calibration(conn, chain="cinemex")
        occupancy_total = analytics.occupancy_total(conn, plaza=plaza)[0]
        return {
            "plaza": plaza, "d0": d0, "d1": d1, "hours": list(hours), "full_day": analytics.is_full_day(hours),
            "includes_today": d0 <= today <= d1, "today": today, "week": list(week), "next_week": list(next_week),
            "next_week_publication": analytics.week_publication(conn, *next_week, plaza=plaza),
            "snapshot_times": job_registry.daily_times(job_keys.SNAPSHOT), "first_snapshot": FIRST_SNAPSHOT,
            "shown_movies": SHOWN_MOVIES, "total_movies": TOTAL_MOVIES,
            "coverage": analytics.coverage(conn, plaza=plaza),
            "capture": analytics.capture_status(conn, limit=12),
            "kpis": analytics.kpis(conn, **scope),
            "findings": analytics.findings(conn, **scope),
            "conclusions": analytics.conclusions(conn, shown=SHOWN_MOVIES, total=TOTAL_MOVIES, **scope),
            "general_summary": [{"hours": list(h), "rows": analytics.general_summary(conn, d0=d0, d1=d1, hours=h,
                                                                                     plaza=plaza)}
                                for h in _SUMMARY_HOURS],
            "movie_gaps": analytics.movie_gaps(conn, limit=TOTAL_MOVIES, **scope),
            "heatmap": analytics.heatmap_day_slot(conn, **scope),
            "mix": analytics.mix(conn, **scope),
            "presale_compare": presale_compare,
            "presale_by_chain": analytics.presale_by_chain(conn, plaza=plaza),
            "presale_curve": _curves(conn, {c: first.get(f"title_norm_{c}") for c in COMPARED}, plaza),
            "offered_seats": analytics.offered_seats(conn, **scope),
            "concentration": analytics.concentration(conn, **scope),
            "events_by_kind": analytics.events_by_kind(conn, since_hours=24 * _EVENTS_DAYS, plaza=plaza),
            "recent_events": analytics.recent_events(conn, limit=_EVENTS_LIMIT, kinds=list(CARTELERA_KINDS),
                                                     plaza=plaza),
            "prices": analytics.prices(conn, plaza=plaza),
            "price_summary": analytics.price_summary(conn, plaza=plaza),
            "capacity_summary": analytics.capacity_summary(conn, plaza=plaza),
            "offered_by_title": {c: analytics.offered_by_title(conn, limit=TOTAL_MOVIES, chain=c, **scope)
                                 for c in COMPARED},
            "capacity_by_cinema": {c: analytics.capacity_by_cinema(conn, chain=c, plaza=plaza) for c in COMPARED},
            "occupancy_summary": analytics.occupancy_summary(conn, plaza=plaza),
            "semaphore_calibration": calibration,
            "occupancy_total": occupancy_total,
            "estimated_occupancy": (analytics.estimated_occupancy(conn, chain="cinemex", **scope)
                                    if calibration else []),
            "occupancy_recent": (analytics.occupancy_recent(conn, limit=_OCCUPANCY_RECENT, plaza=plaza)
                                 if occupancy_total["samples"] else []),
        }

    return read(("cartelera", today, d0, d1, hours, plaza), compute)


@router.get("/cartelera/curva")
def curva(plaza: Plaza | None = None,
          title_norm_cinemex: Annotated[str | None, Query(max_length=300)] = None,
          title_norm_cinepolis: Annotated[str | None, Query(max_length=300)] = None) -> dict[str, Rows]:
    """Curva de venta de un título en preventa, por cadena. Los `title_norm_*` salen de `presale_compare`."""
    title_norms = {"cinemex": title_norm_cinemex, "cinepolis": title_norm_cinepolis}
    return read(("cartelera/curva", plaza, *title_norms.values()), lambda conn: _curves(conn, title_norms, plaza))


@router.get("/cartelera/cambios")
def cambios(plaza: Plaza | None = None,
            kinds: Annotated[list[Literal[CARTELERA_KINDS]] | None, Query()] = None) -> Rows:
    """Últimos cambios de la cartelera publicada; sin `kinds`, los de todos los tipos de `CARTELERA_KINDS`."""
    kinds = sorted(set(kinds or CARTELERA_KINDS), key=list(KIND_LABEL).index)
    return read(("cartelera/cambios", plaza, *kinds),
                lambda conn: analytics.recent_events(conn, limit=_EVENTS_LIMIT, kinds=kinds, plaza=plaza))


@router.get("/cartelera/historia")
def historia(plaza: Plaza | None = None, chain: Chain = COMPARED[0],
             cinema_id: Annotated[str | None, Query(max_length=120)] = None, date: date | None = None,
             show_id: Annotated[str | None, Query(max_length=300)] = None,
             as_of: Annotated[str | None, Query(max_length=40)] = None) -> Historia:
    """Cines, fechas y funciones de un cine, la línea de tiempo de una función y la cartelera en una captura.

    Cada parámetro que falta toma el valor por defecto de la vista: el primer cine, hoy (o la última fecha conocida),
    la primera función del día y la última captura. `board` solo llega con dos capturas o más desde que se publicó
    la función. El filtro por sala se aplica en el navegador sobre `functions` y `board`.
    """
    today = analytics.today()

    def compute(conn):
        cinemas = analytics.cinemas(conn, chain=chain, plaza=plaza)
        cinema = cinema_id or (cinemas[0]["cinema_id"] if cinemas else None)
        dates = [r["date"] for r in analytics.dates_known(conn, chain, cinema)] if cinema else []
        day = date.isoformat() if date else (today if today in dates else (dates[-1] if dates else None))
        functions = analytics.functions_on(conn, chain, cinema, day) if day else []
        show = show_id or (functions[0]["show_id"] if functions else None)
        timeline = analytics.showtime_timeline(conn, chain, show, day) if show else []
        since = timeline[0]["detected_at"] if timeline else FIRST_SNAPSHOT
        until = datetime.now(timezone.utc).isoformat(timespec="seconds")
        snapshots = [r["taken_at"] for r in analytics.snapshot_times(conn, chain, since, until)] if show else []
        moment = as_of or (snapshots[-1] if snapshots else None)
        board = analytics.board_as_of(conn, chain, cinema, day, moment) if len(snapshots) >= 2 else []
        return {"chain": chain, "cinemas": cinemas, "cinema_id": cinema, "dates": dates, "date": day,
                "functions": functions, "show_id": show, "timeline": timeline, "snapshots": snapshots,
                "as_of": moment, "board": board}

    return read(("cartelera/historia", today, plaza, chain, cinema_id, date, show_id, as_of), compute)
