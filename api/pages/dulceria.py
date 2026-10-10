"""Página Dulcería: precio en sala de Cinépolis por complejo y comparación a domicilio (Rappi, DiDi Food).

`GET /api/dulceria` devuelve todo lo que pinta la página. Sin `plaza`, todo el país; la plaza solo acota la sala, porque
el domicilio no tiene plaza. `platform` acota todo lo de domicilio; sin ella, ambas plataformas. `product` elige el
producto de la canasta de la gráfica por complejo; sin él, el primero con precio. Las filas van tal cual las devuelve
`analytics/`.
"""
from typing import Any, Literal

from fastapi import APIRouter
from typing_extensions import TypedDict

import analytics
from analytics.labels import COMPARED, PLATFORM_LABEL
from scraper import plazas

from . import read
from .cartelera import FIRST_SNAPSHOT

router = APIRouter()


class Dulceria(TypedDict):
    plaza: str | None
    platform: str | None
    chain: str
    product: str | None
    first_snapshot: str
    conclusion: str
    findings: list[dict[str, Any]]
    concession_summary: list[dict[str, Any]]
    basket: list[dict[str, Any]]
    product_by_cinema: list[dict[str, Any]]
    by_cinema: list[dict[str, Any]]
    delivery_summary: list[dict[str, Any]]
    delivery_compare: list[dict[str, Any]]
    delivery_products: list[dict[str, Any]]
    delivery_stores: list[dict[str, Any]]


@router.get("/dulceria")
def dulceria(plaza: Literal[tuple(plazas.PLAZAS)] | None = None,
             platform: Literal[tuple(PLATFORM_LABEL)] | None = None,
             chain: Literal[COMPARED] = COMPARED[0],
             product: Literal[tuple(analytics.BASKET)] | None = None) -> Dulceria:
    """Dulcería en sala de la zona y a domicilio. `chain` elige la cadena del catálogo y las tiendas a domicilio."""
    w0, w1 = analytics.cinema_week(analytics.today())

    def compute(conn):
        basket = analytics.concession_basket(conn, plaza=plaza)
        chosen = product or (basket[0]["product_name"] if basket else None)
        concl = analytics.conclusions(conn, d0=w0, d1=w1, plaza=plaza)
        return {
            "plaza": plaza, "platform": platform, "chain": chain, "product": chosen, "first_snapshot": FIRST_SNAPSHOT,
            "conclusion": concl.get("dulceria", ""),
            "findings": [f for f in analytics.findings(conn, d0=w0, d1=w1, top=6, plaza=plaza) if f["topic"] == "dulceria"],
            "concession_summary": analytics.concession_summary(conn, plaza=plaza),
            "basket": basket,
            "product_by_cinema": analytics.concession_product_by_cinema(conn, chosen, plaza=plaza) if chosen else [],
            "by_cinema": analytics.concession_by_cinema(conn, plaza=plaza),
            "delivery_summary": analytics.delivery_summary(conn),
            "delivery_compare": analytics.delivery_compare(conn, platform=platform),
            "delivery_products": analytics.delivery_products(conn, chain=chain, platform=platform),
            "delivery_stores": analytics.delivery_stores(conn, chain=chain, platform=platform),
        }

    return read(("dulceria", w0, plaza, platform, chain, product), compute)
