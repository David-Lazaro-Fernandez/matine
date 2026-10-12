"""Página Datos: el explorador de tablas de `snapshots.db` (`analytics/datasets.py`).

`GET /api/datos` devuelve todo lo que pinta la página: los conjuntos con sus filtros, las opciones de los filtros y una
página de renglones del conjunto elegido, con el total. La base pagina y ordena (`analytics.datasets.page`). Los
parámetros se llaman como los argumentos de `analytics.datasets`; solo se aplican los que `DATASETS` declara para el
conjunto. Es el patrón de referencia para los demás módulos de `api/pages/`.
"""
from datetime import date
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Query
from typing_extensions import TypedDict

import analytics
from analytics import datasets
from analytics.labels import CHAIN_LABEL, DAY_TYPE_LABEL, FORMAT_BUCKETS, PLATFORM_LABEL

from . import read

router = APIRouter()


class Dataset(TypedDict):
    key: str
    filters: list[str]


class CinemaOption(TypedDict):
    chain: str
    cinema_id: str
    cinema_name: str


class Datos(TypedDict):
    datasets: list[Dataset]
    dataset: str
    d0: str | None
    d1: str | None
    cinemas: list[CinemaOption]
    categories: list[str]
    rows: list[dict[str, Any]]
    total: int
    limit: int
    offset: int
    max_rows: int


@router.get("/datos")
def datos(dataset: Literal[tuple(datasets.DATASETS)] = "cinemas",
          d0: date | None = None, d1: date | None = None,
          chain: Literal[tuple(CHAIN_LABEL)] | None = None,
          cinema_ids: Annotated[list[str] | None, Query(max_length=500)] = None,
          platform: Literal[tuple(PLATFORM_LABEL)] | None = None,
          format_bucket: Literal[tuple(FORMAT_BUCKETS)] | None = None,
          day_type: Literal[tuple(DAY_TYPE_LABEL)] | None = None,
          category: Annotated[str | None, Query(max_length=120)] = None,
          search: Annotated[str | None, Query(max_length=200)] = None,
          only_open: bool = False, latest_only: bool = True,
          sort: Annotated[str | None, Query(max_length=64)] = None, desc: bool = False,
          limit: Annotated[int, Query(ge=1, le=datasets.MAX_ROWS)] = 50,
          offset: Annotated[int, Query(ge=0)] = 0) -> Datos:
    """La página de `limit` renglones del conjunto `dataset` que empieza en `offset`, ordenada por `sort`. La tabla pide
    uno de `PAGE_SIZES`; el CSV pide `max_rows`. Sin `d0` y `d1`, la semana de cine en curso."""
    filters = datasets.DATASETS[dataset]["filters"]
    given = {"chain": chain, "cinema_ids": tuple(cinema_ids or ()) or None, "platform": platform,
             "format_bucket": format_bucket, "day_type": day_type, "category": category, "search": search or None,
             "only_open": only_open, "latest_only": latest_only}
    kwargs = {k: v for k, v in given.items() if k in filters}
    if "dates" in filters:
        w0, w1 = analytics.cinema_week(analytics.today())
        kwargs["d0"] = d0.isoformat() if d0 else w0
        kwargs["d1"] = d1.isoformat() if d1 else w1

    def compute(conn):
        return {
            "datasets": [{"key": k, "filters": list(v["filters"])} for k, v in datasets.DATASETS.items()],
            "dataset": dataset,
            "d0": kwargs.get("d0"),
            "d1": kwargs.get("d1"),
            "cinemas": datasets.cinema_options(conn, chain=kwargs.get("chain")) if "cinema_ids" in filters else [],
            "categories": [r["category"] for r in datasets.categories(conn, dataset)] if "category" in filters else [],
            "rows": datasets.page(conn, dataset, sort=sort, desc=desc, limit=limit, offset=offset, **kwargs),
            "total": total,
            "limit": limit,
            "offset": offset,
            "max_rows": datasets.MAX_ROWS,
        }

    # El total no depende de la página ni del orden: pasar de página no vuelve a contar.
    total = read(("datos/total", dataset, *sorted(kwargs.items())), lambda conn: datasets.count(conn, dataset, **kwargs))
    return read(("datos", dataset, *sorted(kwargs.items()), sort, desc, limit, offset), compute)
