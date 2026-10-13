"""Venta por cine: la ocupación medida en el plano de asientos después del inicio de cada función.

Cada función de las plazas de `AC_SEATS_PLAZAS` se lee una vez entre 15 y 75 minutos después de empezar, en ambas
cadenas y con la misma regla (`scraper.sample --post-start`). El % vendido es butacas vendidas entre butacas medidas,
así compara cines y cadenas de distinto tamaño. Fuera de esas plazas no hay planos y estas funciones no traen renglones.

`chain_occupancy` es el total de cada cadena y `cinema_occupancy` el de cada cine. Lo que mira al competidor va por
lugar (un complejo y su Platino o VIP juntos): `competitor_sites` ordena los lugares de Cinépolis por boletos vendidos,
con nuestros cines cercanos, y `main_rivals` da a cada lugar de Cinemex su rival número uno, el Cinépolis cercano que más
vende. La ventana son los últimos `days` días contra los `days` anteriores.
"""
from datetime import datetime, timedelta, timezone

from .cinema_locations import site_id
from .db import rows
from .labels import COMPARED, THEM, US
from .plaza import plaza_cinema_where
from .queries import now_local
from .recommender import distance_km

# La ventana: los últimos días contra los mismos días anteriores.
DAYS = 7
# Un cine con menos funciones medidas en la ventana queda fuera: su % vendido cambia mucho con una sola función.
MIN_SHOWS = 50
# Más lejos, un Cinépolis ya no compite por el mismo público que nuestro cine.
RIVAL_MAX_KM = 3.0


def _since(days):
    now = datetime.now(timezone.utc)
    return [(now - timedelta(days=n)).isoformat(timespec="seconds") for n in (days, 2 * days)]


def _measured(conn, days, plaza, chains):
    """Por cine: funciones, butacas y vendidas en la ventana y en la anterior, con nombre y coordenadas."""
    where, params = plaza_cinema_where(plaza, "o.", chains=chains)
    since, before = _since(days)
    return rows(conn, f"""
        SELECT o.chain, o.cinema_id, c.name AS cinema_name, c.lat, c.lng,
               SUM(o.sampled_at >= ?) AS shows,
               SUM(CASE WHEN o.sampled_at >= ? THEN o.seats END) AS seats,
               SUM(CASE WHEN o.sampled_at >= ? THEN o.sold END) AS sold,
               SUM(CASE WHEN o.sampled_at < ? THEN o.seats END) AS seats_prev,
               SUM(CASE WHEN o.sampled_at < ? THEN o.sold END) AS sold_prev
        FROM occupancy_sample o JOIN cinema c ON c.chain = o.chain AND c.cinema_id = o.cinema_id
        WHERE o.minutes_to_start < 0 AND o.seats > 0 AND o.sold IS NOT NULL AND o.sampled_at >= ?{where}
        GROUP BY o.chain, o.cinema_id
        ORDER BY o.chain, o.cinema_id""", [since, since, since, since, since, before, *params])


def _pct(sold, seats):
    return round(100.0 * sold / seats, 1) if seats else None


def cinema_occupancy(conn, days=DAYS, plaza=None, min_shows=MIN_SHOWS, chains=COMPARED):
    """Los cines con al menos `min_shows` funciones medidas en la ventana, de más a menos vendido en cada cadena.
    Por fila: `chain`, `cinema_id`, `cinema_name`, `lat`, `lng`, `shows`, `seats`, `sold`, `sold_pct`,
    `sold_pct_prev` (None sin funciones en la ventana anterior) y `delta_pp`."""
    out = []
    for r in _measured(conn, days, plaza, chains):
        if r["shows"] < min_shows:
            continue
        r["sold_pct"] = _pct(r["sold"], r["seats"])
        r["sold_pct_prev"] = _pct(r["sold_prev"], r["seats_prev"])
        r["delta_pp"] = round(r["sold_pct"] - r["sold_pct_prev"], 1) if r["sold_pct_prev"] is not None else None
        del r["seats_prev"], r["sold_prev"]
        out.append(r)
    return sorted(out, key=lambda r: (r["chain"], -r["sold_pct"], r["cinema_name"] or "", r["cinema_id"]))


def chain_occupancy(conn, days=DAYS, plaza=None, chains=COMPARED):
    """El % vendido de cada cadena en la ventana y en la anterior, sobre todas sus funciones medidas.
    Por fila: `chain`, `cinemas`, `shows`, `seats`, `sold`, `sold_pct`, `sold_pct_prev`. Orden: `chains`."""
    measured = _measured(conn, days, plaza, chains)
    out = []
    for chain in chains:
        mine = [r for r in measured if r["chain"] == chain]
        if not any(r["shows"] for r in mine):
            continue
        total = {k: sum(r[k] or 0 for r in mine) for k in ("shows", "seats", "sold", "seats_prev", "sold_prev")}
        out.append({"chain": chain, "cinemas": sum(1 for r in mine if r["shows"]), "shows": total["shows"],
                    "seats": total["seats"], "sold": total["sold"], "sold_pct": _pct(total["sold"], total["seats"]),
                    "sold_pct_prev": _pct(total["sold_prev"], total["seats_prev"])})
    return out


def chain_occupancy_by_day(conn, days=DAYS, plaza=None, chains=COMPARED):
    """El % vendido de cada cadena en cada uno de los últimos `days` días completos (sin hoy, que va a medias), por la
    fecha de la función. Por fila: `chain`, `date`, `shows`, `sold_pct`. Orden: fecha y cadena."""
    where, params = plaza_cinema_where(plaza, "o.", chains=chains)
    today = now_local().date()
    first, last = (today - timedelta(days=days)).isoformat(), (today - timedelta(days=1)).isoformat()
    return rows(conn, f"""
        SELECT o.chain, date(o.datetime_local) AS date, COUNT(*) AS shows, ROUND(100.0 * SUM(o.sold) / SUM(o.seats), 1) AS sold_pct
        FROM occupancy_sample o
        WHERE o.minutes_to_start < 0 AND o.seats > 0 AND o.sold IS NOT NULL
          AND date(o.datetime_local) BETWEEN ? AND ?{where}
        GROUP BY o.chain, date(o.datetime_local)
        ORDER BY date, o.chain""", [first, last, *params])


def _sites(cinemas, min_shows):
    """Los cines agrupados por lugar (`cinema_locations.site_id`): un complejo y su Platino o VIP cuentan juntos. Solo
    los lugares con `min_shows` funciones medidas en la ventana."""
    sites = {}
    for r in cinemas:
        if r["lat"] is None or r["lng"] is None:
            continue
        s = sites.setdefault(site_id(r["chain"], r["lat"], r["lng"]),
                             {"chain": r["chain"], "lat": r["lat"], "lng": r["lng"], "cinemas": [],
                              "shows": 0, "seats": 0, "sold": 0, "seats_prev": 0, "sold_prev": 0})
        name = r["cinema_name"] or r["cinema_id"]
        # Cinépolis llama igual al complejo y a su sala VIP.
        if name not in s["cinemas"]:
            s["cinemas"].append(name)
        for k in ("shows", "seats", "sold", "seats_prev", "sold_prev"):
            s[k] += r[k] or 0
    out = []
    for s in sites.values():
        if s["shows"] < min_shows:
            continue
        s["cinemas"].sort(key=lambda name: (len(name), name))
        s["name"] = s["cinemas"][0]
        s["sold_pct"] = _pct(s["sold"], s["seats"])
        s["sold_pct_prev"] = _pct(s.pop("sold_prev"), s.pop("seats_prev"))
        s["delta_pp"] = round(s["sold_pct"] - s["sold_pct_prev"], 1) if s["sold_pct_prev"] is not None else None
        out.append(s)
    return out


def _public(site):
    return {k: site[k] for k in ("name", "cinemas", "shows", "seats", "sold", "sold_pct", "sold_pct_prev", "delta_pp")}


def _km(a, b):
    return distance_km(a["lat"], a["lng"], b["lat"], b["lng"])


def competitor_sites(conn, days=DAYS, plaza=None, min_shows=MIN_SHOWS, max_km=RIVAL_MAX_KM):
    """Los lugares de Cinépolis de más a menos boletos vendidos en la ventana. Por fila: `name`, `cinemas`, `shows`,
    `seats`, `sold`, `sold_pct`, `sold_pct_prev`, `delta_pp` y `neighbors`, nuestros lugares a `max_km` o menos
    ({name, cinemas, sold_pct, km}, del más cercano al más lejano). Ordenar por boletos compara Cinépolis con Cinépolis;
    contra nuestros cines se compara en % vendido."""
    sites = _sites(_measured(conn, days, plaza, COMPARED), min_shows)
    ours = [s for s in sites if s["chain"] == US]
    out = []
    for t in (s for s in sites if s["chain"] == THEM):
        near = sorted(((round(_km(t, o), 1), o) for o in ours), key=lambda x: (x[0], x[1]["name"]))
        out.append({**_public(t), "neighbors": [{"name": o["name"], "cinemas": o["cinemas"], "sold_pct": o["sold_pct"], "km": km}
                                                 for km, o in near if km <= max_km]})
    return sorted(out, key=lambda r: (-r["sold"], r["name"]))


def main_rivals(conn, days=DAYS, plaza=None, min_shows=MIN_SHOWS, max_km=RIVAL_MAX_KM):
    """El rival número uno de cada lugar de Cinemex: el lugar de Cinépolis a `max_km` o menos que más boletos vende, que
    no siempre es el más cercano. Por fila: `cinemex` y `cinepolis` (como en `competitor_sites`, sin `neighbors`), `km`,
    `rivals` (cuántos Cinépolis hay a esa distancia) y `gap_pp` (Cinemex menos Cinépolis). Orden: `gap_pp`."""
    sites = _sites(_measured(conn, days, plaza, COMPARED), min_shows)
    theirs = [s for s in sites if s["chain"] == THEM]
    out = []
    for us in (s for s in sites if s["chain"] == US):
        near = [t for t in theirs if _km(us, t) <= max_km]
        if not near:
            continue
        rival = max(near, key=lambda t: (t["sold"], t["name"]))
        out.append({US: _public(us), THEM: _public(rival), "km": round(_km(us, rival), 1), "rivals": len(near),
                    "gap_pp": round(us["sold_pct"] - rival["sold_pct"], 1)})
    return sorted(out, key=lambda d: (d["gap_pp"], d[US]["name"]))
