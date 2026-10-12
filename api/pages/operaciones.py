"""Página Operaciones (solo staff): el estado de la plataforma para quien la opera (`scraper/health.py`).

`GET /api/operaciones` devuelve todo lo que pinta la página. Lo que sale de `snapshots.db` (`report`, `coverage`,
`runs`, `units`) pasa por `read`, con la misma caché que el resto. Sin base, esas llaves van en None y la página aún
muestra trabajos, servidor y logs. Lo que sale de `data/` (`jobs`, `deployment`, `storage`, `log`) se lee en vivo, sin
conexión ni caché: es barato y quien opera mira el log mientras cambia.
"""
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from typing_extensions import TypedDict

import analytics
from scraper import config, health

from .. import session
from . import read

router = APIRouter(dependencies=[Depends(session.require_staff)])

HOURS = 24


class Thresholds(TypedDict):
    max_age_min: int
    coverage_min_ratio: float


class Operaciones(TypedDict):
    hours: int
    thresholds: Thresholds
    seats_plazas: list[str]
    logs: dict[str, str]
    report: dict[str, Any] | None
    coverage: list[dict[str, Any]] | None
    runs: list[dict[str, Any]] | None
    units: list[dict[str, Any]] | None
    jobs: list[dict[str, Any]]
    deployment: dict[str, Any]
    storage: dict[str, Any]
    log: dict[str, Any]


Days = Annotated[int, Query(ge=1, le=30)]


@router.get("/operaciones")
def operaciones(job_days: Days = 7, run_days: Days = 7, unit_days: Days = 7,
                log: Literal[tuple(health.LOGS)] = "run",
                lines: Annotated[int, Query(ge=1, le=500)] = 60) -> Operaciones:
    """Salud de la captura de las últimas `HOURS` horas, corridas y unidades de `run_days` y `unit_days` días,
    trabajos de `job_days` días, servidor y las últimas `lines` líneas del log `log`."""
    def compute(conn):
        return {"report": health.check(conn, hours=HOURS),
                "coverage": analytics.plaza_coverage(conn),
                "runs": health.recent_runs(conn, days=run_days),
                "units": health.capture_units(conn, days=unit_days)}

    from_db = (read(("operaciones", run_days, unit_days), compute) if config.DB_PATH.exists()
               else dict.fromkeys(("report", "coverage", "runs", "units")))
    return {
        "hours": HOURS,
        "thresholds": {"max_age_min": health.MAX_AGE_MIN, "coverage_min_ratio": health.COVERAGE_MIN_RATIO},
        "seats_plazas": list(config.SEATS_PLAZAS),
        "logs": health.LOGS,
        **from_db,
        "jobs": health.jobs_status(days=job_days),
        "deployment": health.deployment(),
        "storage": health.storage(),
        "log": health.log_tail(log, lines=lines),
    }
