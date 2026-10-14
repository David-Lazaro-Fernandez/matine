"""Página Dulcería: precio en sala de Cinépolis por complejo y comparación a domicilio (Rappi, DiDi Food).

`GET /api/dulceria` devuelve todo lo que pinta la página. Sin `plaza`, todo el país; la plaza solo acota la sala, porque
el domicilio no tiene plaza. `platform` acota todo lo de domicilio; sin ella, ambas plataformas. `product` elige el
producto de la canasta de la gráfica por complejo; sin él, el primero con precio. `size` elige su tamaño; sin él,
el que trae el menú. Las filas van tal cual las devuelve
`analytics/`.
"""
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from typing_extensions import TypedDict

import analytics
from analytics.labels import PLATFORM_LABEL
from scraper import plazas

from .. import session
from . import read
from .cartelera import FIRST_SNAPSHOT

router = APIRouter(dependencies=[Depends(session.require_module("dulceria"))])


class Dulceria(TypedDict):
    plaza: str | None
    platform: str | None
    product: str | None
    size: str | None
    sizes: list[dict[str, Any]]
    first_snapshot: str
    conclusion: str
    findings: list[dict[str, Any]]
    concession_summary: list[dict[str, Any]]
    basket: list[dict[str, Any]]
    product_by_cinema: list[dict[str, Any]]
    delivery_compare: list[dict[str, Any]]


@router.get("/dulceria")
def dulceria(plaza: Literal[tuple(plazas.PLAZAS)] | None = None,
             platform: Literal[tuple(PLATFORM_LABEL)] | None = None,
             product: Literal[tuple(analytics.BASKET)] | None = None,
             size: Annotated[str | None, Query(max_length=40)] = None) -> Dulceria:
    """Dulcería en sala de la zona y a domicilio."""
    w0, w1 = analytics.cinema_week(analytics.today())

    def compute(conn):
        basket = analytics.concession_basket(conn, plaza=plaza)
        chosen = product or (basket[0]["product_name"] if basket else None)
        sizes = analytics.concession_sizes(conn, chosen, plaza=plaza) if chosen else []
        by_name = {z["size_name"]: z for z in sizes}
        chosen_size = size if size in by_name else next((z["size_name"] for z in sizes if z["is_menu_size"]), None)
        concl = analytics.conclusions(conn, d0=w0, d1=w1, plaza=plaza, sections=("dulceria",))
        return {
            "plaza": plaza, "platform": platform, "product": chosen, "size": chosen_size, "sizes": sizes, "first_snapshot": FIRST_SNAPSHOT,
            "conclusion": concl.get("dulceria", ""),
            "findings": [f for f in analytics.findings(conn, d0=w0, d1=w1, top=None, plaza=plaza) if f["topic"] == "dulceria"],
            "concession_summary": analytics.concession_summary(conn, plaza=plaza),
            "basket": basket,
            "product_by_cinema": analytics.concession_product_by_cinema(conn, chosen, plaza=plaza, size=chosen_size) if chosen else [],
            "delivery_compare": analytics.delivery_compare(conn, platform=platform),
        }

    return read(("dulceria", w0, plaza, platform, product, size), compute)
