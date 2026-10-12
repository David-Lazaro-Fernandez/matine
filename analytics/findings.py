"""Hallazgos del dashboard, como cifras y una gráfica, y las conclusiones de cada sección de evidencia.

Cada hallazgo sale de las mismas consultas que el resto del dashboard y solo aparece si cruza un umbral que lo hace
relevante para una decisión de programación esta semana. Nunca hay cifras fijas aquí: si el dato no existe, el
hallazgo no aparece. Un hallazgo da el hecho y una sugerencia; la decisión queda a cargo de quien lo usa.

`findings()` devuelve hasta `top` dicts {topic, theme, label, action, metric, compare, delta, chart, context, strength,
as_of}:
- `theme`: la llave de `FINDING_THEME_LABEL` (programacion, preventa, precios, cines, dulceria, independientes).
- `label`: la conclusión con su cifra y su referencia, 'A domicilio, Cinépolis cobra 52 % más que nosotros'.
- `action`: la sugerencia, 'Valora abrirle funciones a Tu Nombre.', o None.
- `metric`, `compare`, `delta`: {label, value, unit, chain}; `unit` es pct, pp, pct_diff, money, count o pace.
  `compare` y `delta` pueden ser None.
- `chart`: {kind, unit, rows: [{label, values: {chain: valor}, highlight}]} o None. Una fila va resaltada. `kind` es la
  forma del dato: bars (ranking), meter (% de un aforo), donut y stack (partes de un todo por cadena; stack para más de
  cuatro partes), dumbbell (una cifra por cadena en cada fila) o diverging (cambios con signo).
- `context`: la muestra y el periodo que sostienen la cifra, o None.
Se evalúan todas las reglas y entran las más fuertes. `strength` es la brecha entre el umbral, por la raíz de `stake`,
la parte de la programación en juego (0 a 1): un título chico que vende raro no pasa delante de una brecha de toda la
cadena. El umbral decide si un hallazgo entra; `stake` solo decide el orden. `as_of` es la fecha del dato
muestreado que sostiene el hallazgo (None si solo usa la cartelera vigente).
`conclusions()` devuelve {resumen, peliculas, peliculas_note, franjas, formatos, preventa, dulceria}: la frase que abre cada
sección de evidencia; `independent_conclusions()` lo mismo para la página de la oferta independiente, y
`distributor_conclusions()` para la de distribuidoras."""
import math
from datetime import datetime, timedelta, timezone

from scraper import distributors

from .cinema_sales import DAYS as SALES_DAYS
from .cinema_sales import chain_occupancy, main_rivals
from .concessions import concession_basket
from .db import rows
from .delivery import delivery_compare
from .distributors import distributor_gaps, distributor_reach
from .independents import (
    INDEP_MIN_SAMPLES,
    INDEP_MIN_SOLD_PCT,
    OCCUPANCY_CONFIRMED,
    OCCUPANCY_DAYS,
    independent_overlap,
    independent_slots,
    independent_summary,
    independent_titles,
)
from .labels import (
    CHAIN_LABEL,
    DAY_TYPE_LABEL,
    FORMAT_LABEL,
    FULL_DAY,
    SLOT_SHORT,
    SLOTS,
    THEM,
    US,
    date_es,
)
from .presale import presale_compare, presale_ranking
from .queries import (
    concentration,
    is_full_day,
    kpis,
    mix,
    movies_by_chain,
    now_local,
    programming_moves,
    showtimes_by_slot,
    today,
)
from .seats import effective_ticket_price, occupancy_by_cinema, occupancy_by_title, offered_by_title, prices
from .summary import general_summary

THEM_NAME = CHAIN_LABEL[THEM]

# Umbrales (en puntos porcentuales salvo que se indique) a partir de los cuales una diferencia
# merece una tarjeta de hallazgo.
# Diferencia entre Δ funciones y Δ butacas de un título.
TITLE_SEATS_MIN_PP = 1.5
# % mínimo de la parrilla de alguna cadena para considerar un título.
TITLE_MIN_SHARE = 2.0
TOP3_MIN_PP = 3.0
SLOT_MIN_PP = 1.0
FORMAT_MIN_PP = 5.0
EXCLUSIVE_MIN_TITLES = 3
EXCLUSIVE_MIN_SHOWS = 20
# Brecha mediana de precio en la canasta comparable de dulcería a domicilio.
CONCESSION_MIN_PCT = 10.0
# Cambio de share de un título en lo que falta de la semana.
MOVE_MIN_PP = 1.0
# Y al menos estas funciones netas, para que un título chico no cruce solo por pp.
MOVE_MIN_SHOWS = 30
# Brecha del boleto promedio ponderado por la parrilla de cada cadena.
PRICE_MIN_PCT = 10.0
# % mínimo de funciones con precio muestreado para afirmar un promedio.
PRICE_MIN_PRICED = 50.0
# Un título vende 30 % más (o menos) de lo esperado para su horario en Cinépolis.
DEMAND_MIN_DEV = 0.3
# Planos tras el inicio del título en la ventana de muestreo.
DEMAND_MIN_SAMPLES = 20
# % de la parrilla vigente de Cinépolis: el título tiene que seguir en su cartelera.
DEMAND_MIN_SHARE = 1.0
# El título que más vende en preventa le saca al menos el doble al segundo.
PRESALE_MIN_RATIO = 2.0
# Funciones del panel vigente para comparar un título.
PRESALE_MIN_SHOWS = 10
# Brecha de % del aforo vendido en un mismo título entre cadenas.
PRESALE_GAP_MIN_PP = 10.0
# % del aforo vendido de una preventa exclusiva de Cinépolis que ya merece atención.
PRESALE_EXCLUSIVE_MIN_PCT = 40.0
# Cines muestreados por cadena para citar una combinación de formato y tipo de día.
PRICE_MIN_CINEMAS = 5
# Brecha del % de butacas vendidas entre cadenas, medido en el plano después del inicio.
OCCUPANCY_MIN_PP = 2.0
# Brecha del % vendido entre un lugar de Cinemex y su rival número uno, el Cinépolis cercano que más vende.
RIVAL_MIN_PP = 15.0
# Brecha del share de funciones de una distribuidora entre cadenas.
DISTRIBUTOR_MIN_PP = 3.0

# Ventanas de muestreo. El precio se renueva una vez por semana por cine, formato y tipo de día. Con 14 días cubrimos
# una vuelta completa con holgura. La ocupación se mide cada hora y una semana de cine basta para leer la demanda.
PRICE_SAMPLE_DAYS = 14
DEMAND_SAMPLE_DAYS = 7
# La dulcería a domicilio se captura a diario: un dato más viejo ya no describe el precio de hoy.
CONCESSION_MAX_AGE_DAYS = 3
# La pantalla de evidencia de cada tema, que es también su filtro en la portada.
_THEME = {"titulo": "programacion", "concentracion": "programacion", "franjas": "programacion", "formato": "programacion",
          "exclusivas": "programacion", "movimientos": "programacion", "demanda": "programacion",
          "preventa": "preventa", "preventa_brecha": "preventa", "preventa_exclusiva": "preventa", "precio": "precios",
          "ocupacion": "cines", "rival": "cines", "dulceria": "dulceria", "independientes": "independientes"}
# El formato es una diferencia de sala, no de semana: solo desplaza a otro hallazgo si la brecha es muy grande.
_STRUCTURAL_WEIGHT = 0.5
# La dulcería a domicilio es un canal secundario: mueve mucho menos que el boleto, aunque toque a toda la cadena.
_DELIVERY_WEIGHT = 0.3


# Largo de un título dentro de la conclusión de una tarjeta.
_LABEL_TITLE = 48


def _pp(v):
    return f"{v:+.1f} pp".replace("-", "−")


def _pct(v):
    return f"{v:.0f} %"


def _pct1(v):
    """6.71 -> '6.7 %'; 12.4 -> '12 %'. Un decimal solo debajo de 10, donde cambia la lectura."""
    return f"{v:.1f} %" if abs(v) < 10 else f"{v:.0f} %"


def _gap(v):
    """La diferencia en pp con su sentido para nosotros: −5.5 -> 'vamos atrás por 5.5 pp'."""
    return f"vamos {'adelante' if v > 0 else 'atrás'} por {abs(v):.1f} pp"


def _times(ratio):
    """4.04 -> '4×'; 1.6 -> '1.6×'."""
    return f"{ratio:.0f}×" if ratio >= 3 else f"{ratio:.1f}×"


def _short(title, n=32):
    """Recorta a la mitad para que dos títulos que empiezan igual se distingan: 'BTS WORLD TOUR … SÃO PAULO'."""
    t = " ".join(title.split())
    if len(t) <= n:
        return t
    head, tail = t[: n // 2], t[-(n // 2):]
    head = head.rsplit(" ", 1)[0] if " " in head else head
    tail = tail.split(" ", 1)[1] if " " in tail else tail
    return f"{head} … {tail}"


def _slot_phrase(key):
    """'despues_21' -> 'después de las 9 PM'; 'de_15_a_18' -> 'de 3 a 6 PM'."""
    label = SLOT_SHORT[key]
    if key == "despues_21":
        return "después de las 9 PM"
    if key == "antes_10":
        return "antes de las 10 AM"
    return "de " + label.replace(" – ", " a ").replace("P.M.", "PM").replace("A.M.", "AM")


def _slot_name(key):
    return SLOT_SHORT[key].replace("P.M.", "PM").replace("A.M.", "AM")


def _metric(label, value, unit, chain=None):
    """Una cifra de la tarjeta: {label, value, unit, chain}. `unit` es pct, pp, pct_diff, money, count o pace."""
    return {"label": label, "value": round(value, 2), "unit": unit, "chain": chain}


def _chart(unit, rows, kind="bars"):
    """La gráfica de la tarjeta: {kind, unit, rows}. Cada fila es (texto, {cadena: valor}, resaltada)."""
    return {"kind": kind, "unit": unit, "rows": [{"label": label, "values": {c: round(v, 2) for c, v in values.items() if v is not None},
                                    "highlight": highlight} for label, values, highlight in rows]}


def _card(topic, label, metric, strength, compare=None, delta=None, chart=None, context=None, as_of=None, stake=100.0,
          action=None):
    """`label` es la conclusión y `action`, la sugerencia o None. `strength` es la brecha entre el umbral; `stake`, el %
    de la programación del que habla la tarjeta."""
    return {"topic": topic, "theme": _THEME[topic], "label": label, "action": action, "metric": metric, "compare": compare,
            "delta": delta, "chart": chart, "context": context,
            "strength": strength * math.sqrt(min(stake, 100.0) / 100.0), "as_of": as_of}


def _title_finding(conn, d0, d1, hours=None, plaza=None):
    """¿Dónde la apuesta por sala (butacas) cuenta otra historia que la apuesta por funciones?"""
    movies = movies_by_chain(conn, d0, d1, limit=60, hours=hours, plaza=plaza)
    seats = {c: {r["title_norm"]: r for r in offered_by_title(conn, d0, d1, limit=60, chain=c, hours=hours, plaza=plaza)} for c in (US, THEM)}
    if not seats[US] or not seats[THEM]:
        return None
    best, score = None, 0
    for m in movies:
        if not (m["shows_cinemex"] and m["shows_cinepolis"]):
            continue
        if max(m["share_cinemex"], m["share_cinepolis"]) < TITLE_MIN_SHARE:
            continue
        su, st_ = seats[US].get(m["title_norm"]), seats[THEM].get(m["title_norm"])
        if not su or not st_:
            continue
        sg = m["share_cinemex"] - m["share_cinepolis"]
        kg = su["share_seats"] - st_["share_seats"]
        s = abs(kg - sg)
        if s > score:
            best, score = (m, su, st_, sg, kg), s
    if not best or score < TITLE_SEATS_MIN_PP:
        return None
    m, su, st_, sg, kg = best
    label = f"{_short(m['title'], _LABEL_TITLE)}, frente a {THEM_NAME}: {_pp(sg)} en funciones y {_pp(kg)} en butacas"
    action = (f"Valora pasar {_short(m['title'])} a salas más grandes." if kg < sg
              else f"Valora si las salas grandes de {_short(m['title'])} se llenan.")
    return _card("titulo", label,
                 _metric("De nuestras butacas", su["share_seats"], "pct", US), score / TITLE_SEATS_MIN_PP,
                 compare=_metric(f"De las de {THEM_NAME}", st_["share_seats"], "pct", THEM),
                 delta=_metric("Diferencia", kg, "pp"),
                 chart=_chart("pct", [("Funciones", {US: m["share_cinemex"], THEM: m["share_cinepolis"]}, False),
                                      ("Butacas", {US: su["share_seats"], THEM: st_["share_seats"]}, True)]),
                 context=f"Sala promedio: {su['avg_seats']:.0f} asientos Cinemex, {st_['avg_seats']:.0f} {THEM_NAME}",
                 stake=max(su["share_seats"], st_["share_seats"]), action=action)


def _concentration_finding(conn, d0, d1, movies, hours=None, plaza=None):
    cc = {r["chain"]: r for r in concentration(conn, d0, d1, hours=hours, plaza=plaza)}
    if US not in cc or THEM not in cc:
        return None
    cu, ct = cc[US], cc[THEM]
    gap = cu["top3_pct"] - ct["top3_pct"]
    if abs(gap) < TOP3_MIN_PP:
        return None
    label = (f"Nuestros 3 títulos principales suman {_pct1(cu['top3_pct'])} de la parrilla; "
             f"los de {THEM_NAME}, {_pct1(ct['top3_pct'])}")
    return _card("concentracion", label,
                 _metric("De nuestra parrilla", cu["top3_pct"], "pct", US), abs(gap) / TOP3_MIN_PP,
                 compare=_metric(f"De la de {THEM_NAME}", ct["top3_pct"], "pct", THEM),
                 delta=_metric("Diferencia", gap, "pp"),
                 chart=_chart("pct", [("3 títulos principales", {US: cu["top3_pct"], THEM: ct["top3_pct"]}, True),
                                      ("Resto", {US: 100 - cu["top3_pct"], THEM: 100 - ct["top3_pct"]}, False)], "donut"),
                 context=f"Títulos en cartelera: {cu['titles']} Cinemex, {ct['titles']} {THEM_NAME}",
                 action="Valora abrir espacio a más títulos fuera de nuestros 3 principales." if gap > 0 else None)


def _slot_finding(conn, d0, d1, hours=None, plaza=None):
    if not is_full_day(hours):
        # Con la franja recortada, la "franja ganadora" pierde el sentido comparativo.
        return None
    slots = {r["chain"]: r for r in showtimes_by_slot(conn, d0, d1, plaza=plaza)}
    if US not in slots or THEM not in slots or not slots[US]["total"] or not slots[THEM]["total"]:
        return None
    su, st_ = slots[US], slots[THEM]
    share = {c: {k: 100.0 * r[k] / r["total"] for k, *_ in SLOTS} for c, r in ((US, su), (THEM, st_))}
    gaps = {k: share[US][k] - share[THEM][k] for k, *_ in SLOTS}
    key = max(gaps, key=lambda k: abs(gaps[k]))
    g = gaps[key]
    if abs(g) < SLOT_MIN_PP:
        return None
    when = _slot_phrase(key)
    label = (f"Programamos más {when}: {_pct1(share[US][key])} de nuestras funciones contra {_pct1(share[THEM][key])} de {THEM_NAME}"
             if g > 0 else
             f"{THEM_NAME} programa más {when}: {_pct1(share[THEM][key])} de sus funciones contra {_pct1(share[US][key])} de las nuestras")
    action = (f"Valora si la venta {when} justifica esa oferta." if g > 0 else f"Valora si nos falta oferta {when}.")
    return _card("franjas", label,
                 _metric("De nuestras funciones", share[US][key], "pct", US), abs(g) / SLOT_MIN_PP,
                 compare=_metric(f"De las de {THEM_NAME}", share[THEM][key], "pct", THEM),
                 delta=_metric("Diferencia", g, "pp"),
                 chart=_chart("pct", [(_slot_name(k), {US: share[US][k], THEM: share[THEM][k]}, k == key) for k, *_ in SLOTS], "stack"),
                 stake=max(share[US][key], share[THEM][key]), action=action)


def _format_finding(conn, d0, d1, kp, hours=None, plaza=None):
    mx = {(r["dimension"], r["chain"], r["bucket"]): r["share"] for r in mix(conn, d0, d1, hours=hours, plaza=plaza)}
    gaps = [(mx.get(("format", US, b), 0) - mx.get(("format", THEM, b), 0), b) for b in FORMAT_LABEL if b != "traditional"]
    g, b = max(gaps, key=lambda x: abs(x[0]))
    if abs(g) < FORMAT_MIN_PP:
        return None
    us, them = kp.get(US), kp.get(THEM)
    fu, ft = mx.get(("format", US, b), 0), mx.get(("format", THEM, b), 0)
    name = FORMAT_LABEL[b]
    label = (f"Damos más pantalla a {name}: {_pct1(fu)} de nuestras funciones contra {_pct1(ft)} de {THEM_NAME}" if g > 0
             else f"{THEM_NAME} da más pantalla a {name}: {_pct1(ft)} de sus funciones contra {_pct1(fu)} de las nuestras")
    action = (f"Valora si la venta de {name} sostiene esa apuesta." if g > 0 else f"Valora si nos falta oferta de {name}.")
    return _card("formato", label,
                 _metric("De nuestras funciones", mx.get(("format", US, b), 0), "pct", US),
                 _STRUCTURAL_WEIGHT * abs(g) / FORMAT_MIN_PP,
                 compare=_metric(f"De las de {THEM_NAME}", mx.get(("format", THEM, b), 0), "pct", THEM),
                 delta=_metric("Diferencia", g, "pp"),
                 chart=_chart("pct", [(FORMAT_LABEL[k], {US: mx.get(("format", US, k), 0), THEM: mx.get(("format", THEM, k), 0)}, k == b)
                                      for k in FORMAT_LABEL], "donut"),
                 context=(f"Subtituladas: {us['pct_subtitled']:.0f} % Cinemex, {them['pct_subtitled']:.0f} % {THEM_NAME}"
                          if us and them else None),
                 stake=max(fu, ft), action=action)


def _concession_gap(conn):
    """Brecha mediana (%) Cinépolis vs Cinemex en las cubetas comparables de dulcería a domicilio, las cubetas y la
    fecha de la lectura más reciente (ISO UTC)."""
    as_of = rows(conn, "SELECT MAX(sampled_at) t FROM delivery_price")[0]["t"]
    cmp_ = [r for r in delivery_compare(conn) if r["delta_pct"] is not None]
    if not cmp_:
        return None, [], as_of
    gaps = sorted(r["delta_pct"] for r in cmp_)
    return gaps[len(gaps) // 2], cmp_, as_of


def _local_date(iso_utc):
    return datetime.fromisoformat(iso_utc).astimezone(now_local().tzinfo).date().isoformat()


def _is_fresh(as_of, max_age_days):
    return bool(as_of) and datetime.fromisoformat(as_of) >= datetime.now(timezone.utc) - timedelta(days=max_age_days)


def _concession_finding(conn, plaza=None):
    gap, cmp_, as_of = _concession_gap(conn)
    if gap is None or abs(gap) < CONCESSION_MIN_PCT or not _is_fresh(as_of, CONCESSION_MAX_AGE_DAYS):
        return None
    pop = {r["product_name"]: r for r in concession_basket(conn, plaza=plaza)}.get("Palomitas")
    widest = max(cmp_, key=lambda r: (abs(r["delta_pct"]), r["bucket"]))
    label = (f"A domicilio, {THEM_NAME} cobra {gap:.0f} % más que nosotros" if gap > 0
             else f"A domicilio, cobramos {abs(gap):.0f} % más que {THEM_NAME}")
    action = (f"Valora si hay margen de precio en la dulcería a domicilio sin pasar a {THEM_NAME}." if gap > 0
              else "Valora si nuestro precio en la dulcería a domicilio nos quita pedidos.")
    return _card("dulceria", label,
                 _metric(f"Lo que cobra {THEM_NAME} sobre nuestro precio", gap, "pct_diff", THEM if gap > 0 else US),
                 _DELIVERY_WEIGHT * abs(gap) / CONCESSION_MIN_PCT,
                 chart=_chart("money", [(r["label"], {US: r["cinemex_median"], THEM: r["cinepolis_median"]}, r is widest) for r in cmp_], "dumbbell"),
                 context=(f"Palomitas en sala {THEM_NAME}: de ${pop['min_price']:,.0f} a ${pop['max_price']:,.0f} en "
                          f"{int(pop['distinct_prices'])} niveles de precio" if pop else None),
                 as_of=as_of, action=action)


def _exclusive_finding(movies):
    only_them = [m for m in movies if not m["shows_cinemex"] and m["shows_cinepolis"] >= EXCLUSIVE_MIN_SHOWS]
    only_us = [m for m in movies if not m["shows_cinepolis"] and m["shows_cinemex"] >= EXCLUSIVE_MIN_SHOWS]
    if len(only_them) < EXCLUSIVE_MIN_TITLES:
        return None
    ours = f"nosotros, {len(only_us)} que no tiene" if only_us else "nosotros, ninguno que no tenga"
    label = f"{THEM_NAME} exhibe {len(only_them)} títulos que no tenemos; {ours}"
    return _card("exclusivas", label,
                 _metric(f"Títulos que solo exhibe {THEM_NAME}", len(only_them), "count", THEM),
                 len(only_them) / EXCLUSIVE_MIN_TITLES,
                 compare=_metric("Títulos que solo exhibimos nosotros", len(only_us), "count", US),
                 chart=_chart("pct", [(_short(m["title"], 40), {THEM: m["share_cinepolis"]}, i == 0) for i, m in enumerate(only_them[:5])]),
                 context=f"% de la parrilla de {THEM_NAME}",
                 stake=sum(m["share_cinepolis"] for m in only_them),
                 action=f"Valora si alguno de los títulos que solo exhibe {THEM_NAME} cabe en nuestra cartelera.")


def _moves_finding(conn, d0, d1, movies, hours=None, plaza=None):
    """El título al que una cadena le cambió más la parrilla de lo que falta de la semana; primero Cinépolis."""
    moves = programming_moves(conn, d0, d1, hours=hours, plaza=plaza)
    big = [m for m in moves if abs(m["delta_pp"]) >= MOVE_MIN_PP and abs(m["shows_now"] - m["shows_then"]) >= MOVE_MIN_SHOWS]
    pick = next((m for m in big if m["chain"] == THEM), None) or next((m for m in big if m["chain"] == US), None)
    if not pick:
        return None
    chain = pick["chain"]
    net = pick["shows_now"] - pick["shows_then"]
    since = date_es(_local_date(pick["since"]), with_year=False)
    others = sorted((m for m in moves if m["chain"] == chain and m["title_norm"] != pick["title_norm"]
                     and m["delta_pp"] * pick["delta_pp"] < 0), key=lambda m: -abs(m["delta_pp"]))[:3]
    mine = [r for r in movies if r["title_norm"] == pick["title_norm"]]
    ours = f" · Cinemex le da {mine[0]['share_cinemex']:.0f} %" if chain == THEM and mine else ""
    verb = "subió" if pick["delta_pp"] > 0 else "bajó"
    label = (f"{CHAIN_LABEL[chain]} {verb} {_short(pick['title'], _LABEL_TITLE)} de {_pct1(pick['share_then'])} a "
             f"{_pct1(pick['share_now'])} de lo que falta de la semana")
    action = None
    if chain == THEM:
        action = (f"Valora responder con más funciones de {_short(pick['title'])}." if pick["delta_pp"] > 0
                  else f"Valora ganar las funciones de {_short(pick['title'])} que {THEM_NAME} deja.")
    return _card("movimientos", label,
                 _metric("De lo que falta de semana, ahora", pick["share_now"], "pct", chain), abs(pick["delta_pp"]) / MOVE_MIN_PP,
                 compare=_metric("Antes", pick["share_then"], "pct", chain),
                 delta=_metric("Cambio", pick["delta_pp"], "pp"),
                 chart=_chart("pp", [(_short(m["title"], 40), {chain: m["delta_pp"]}, m is pick) for m in [pick, *others]], "diverging"),
                 context=f"Desde el {since} · {net:+,} funciones{ours}".replace("-", "−"),
                 stake=max(pick["share_now"], pick["share_then"]), action=action)


def _price_finding(conn, d0, d1, hours=None, plaza=None):
    """Quién es más caro en lo que de verdad programa: boleto promedio ponderado por formato y tipo de día."""
    ep = {r["chain"]: r for r in effective_ticket_price(conn, d0, d1, hours=hours, plaza=plaza, days=PRICE_SAMPLE_DAYS)}
    us, them = ep.get(US), ep.get(THEM)
    if not us or not them or not us["avg_price"] or not them["avg_price"]:
        return None
    if min(us["pct_priced"], them["pct_priced"]) < PRICE_MIN_PRICED:
        return None
    gap = 100.0 * (them["avg_price"] / us["avg_price"] - 1)
    if abs(gap) < PRICE_MIN_PCT:
        return None
    med = {(r["chain"], r["format_bucket"], r["day_type"]): r["median_price"]
           for r in prices(conn, days=PRICE_SAMPLE_DAYS, plaza=plaza) if r["cinemas"] >= PRICE_MIN_CINEMAS}
    cells = sorted(((mc / mu - 1, b, d, mu, mc) for (ch, b, d), mu in med.items() if ch == US
                    for mc in [med.get((THEM, b, d))] if mu and mc), key=lambda x: (-abs(x[0]), x[1], x[2]))
    label = (f"El boleto promedio de {THEM_NAME} cuesta {gap:.0f} % más que el nuestro "
             f"(${them['avg_price']:,.0f} contra ${us['avg_price']:,.0f})" if gap > 0 else
             f"Nuestro boleto promedio cuesta {abs(gap):.0f} % más que el de {THEM_NAME} "
             f"(${us['avg_price']:,.0f} contra ${them['avg_price']:,.0f})")
    action = ("Valora si hay margen en el precio del boleto en los formatos con más brecha." if gap > 0
              else f"Valora si el precio del boleto nos quita asistencia frente a {THEM_NAME}.")
    return _card("precio", label,
                 _metric("Nuestro boleto promedio", us["avg_price"], "money", US), _STRUCTURAL_WEIGHT * abs(gap) / PRICE_MIN_PCT,
                 compare=_metric(f"El de {THEM_NAME}", them["avg_price"], "money", THEM),
                 delta=_metric(f"{THEM_NAME} frente a nosotros", gap, "pct_diff"),
                 chart=_chart("money", [(f"{FORMAT_LABEL[b]} · {DAY_TYPE_LABEL[d].lower()}", {US: mu, THEM: mc}, i == 0)
                                        for i, (_, b, d, mu, mc) in enumerate(cells[:4])], "dumbbell") if cells else None,
                 context=f"Ponderado por la parrilla de cada cadena · precios de los últimos {PRICE_SAMPLE_DAYS} días",
                 as_of=min(us["last_sampled"], them["last_sampled"]), action=action)


def _demand_finding(conn, movies, plaza=None):
    """Un título que en las salas de Cinépolis vende muy por encima (o por debajo) de lo normal para su horario,
    contra cuánta parrilla le damos. Solo con plaza: los planos se leen en las plazas de `AC_SEATS_PLAZAS`."""
    if plaza is None:
        return None
    occ = occupancy_by_title(conn, days=DEMAND_SAMPLE_DAYS, min_samples=DEMAND_MIN_SAMPLES, plaza=plaza)
    by_title = {m["title_norm"]: m for m in movies}
    best = None
    for o in occ:
        m = by_title.get(o["title_norm"])
        if not m or o["demand_index"] is None:
            continue
        hot = (o["demand_index"] >= 1 + DEMAND_MIN_DEV and m["share_cinepolis"] >= DEMAND_MIN_SHARE
               and m["share_cinemex"] <= m["share_cinepolis"])
        cold = (o["demand_index"] <= 1 - DEMAND_MIN_DEV and m["share_cinemex"] >= TITLE_MIN_SHARE
                and m["share_cinemex"] > m["share_cinepolis"])
        score = abs(o["demand_index"] - 1) / DEMAND_MIN_DEV
        if (hot or cold) and (not best or score > best[0]):
            best = (score, o, m)
    if not best:
        return None
    score, o, m = best
    title = _short(o["title"], _LABEL_TITLE)
    if o["demand_index"] > 1:
        ours = "No la tenemos." if not m["share_cinemex"] else (
            f"Le damos {_pct1(m['share_cinemex'])} de la parrilla; {THEM_NAME}, {_pct1(m['share_cinepolis'])}.")
        label = (f"{title} vende {_times(o['demand_index'])} lo esperado en {THEM_NAME} "
                 f"({_pct1(o['sold_pct'])} contra {_pct1(o['expected_pct'])}). {ours}")
        action = (f"Valora abrirle funciones a {_short(o['title'])}." if not m["share_cinemex"]
                  else f"Valora darle más funciones a {_short(o['title'])}.")
    else:
        label = (f"{title} vende menos de lo esperado en {THEM_NAME} ({_pct1(o['sold_pct'])} contra "
                 f"{_pct1(o['expected_pct'])}) y le damos {_pct1(m['share_cinemex'])} de la parrilla")
        action = f"Valora pasar funciones de {_short(o['title'])} a un título con más demanda."
    return _card("demanda", label,
                 _metric(f"Butacas vendidas en {THEM_NAME}", o["sold_pct"], "pct", THEM), score,
                 compare=_metric("Lo esperado para su horario", o["expected_pct"], "pct"),
                 delta=_metric("Diferencia", o["sold_pct"] - o["expected_pct"], "pp"),
                 chart=_chart("pct", [("Parrilla", {US: m["share_cinemex"], THEM: m["share_cinepolis"]}, True)]),
                 context=f"{o['samples']:,} planos de funciones ya empezadas · últimos {DEMAND_SAMPLE_DAYS} días",
                 as_of=o["last_sampled"], stake=max(m["share_cinemex"], m["share_cinepolis"]), action=action)


def _presale_finding(conn, plaza=None):
    """La preventa nuestra que se despega: por ritmo (puntos de aforo vendidos al día) si hay dos lecturas, si no por
    el % del aforo que ya lleva vendido. No depende del periodo: la preventa es de funciones futuras."""
    everything = presale_ranking(conn, plaza=plaza)
    ranking = [r for r in everything if r["shows"] >= PRESALE_MIN_SHOWS]
    paced = [r for r in ranking if r["pace_pct_day"] is not None and r["paced_shows"] >= PRESALE_MIN_SHOWS]
    key = "pace_pct_day" if len(paced) >= 2 else "sold_pct"
    pool = sorted(paced if len(paced) >= 2 else ranking, key=lambda r: -r[key])
    if len(pool) < 2 or pool[0][key] <= 0:
        return None
    first, second = pool[0], pool[1]
    ratio = first[key] / second[key] if second[key] > 0 else float("inf")
    if ratio < PRESALE_MIN_RATIO:
        return None
    unit = "pace" if key == "pace_pct_day" else "pct"
    what = "Ritmo de venta" if key == "pace_pct_day" else "Aforo vendido"
    when = f" · a {first['days_to_release']} días de su estreno" if first["days_to_release"] is not None else ""
    lead = (f"vende {first[key]:.1f} % del aforo por día en preventa" if unit == "pace"
            else f"ya vendió {_pct1(first[key])} de su aforo en preventa")
    label = f"{_short(first['title'], _LABEL_TITLE)} {lead}, {_times(ratio)} el segundo lugar" if ratio != float("inf") \
        else f"{_short(first['title'], _LABEL_TITLE)} {lead}"
    return _card("preventa", label,
                 _metric(what, first[key], unit, US), min(ratio, 10.0) / PRESALE_MIN_RATIO,
                 compare=_metric(f"Segundo lugar, {_short(second['title'], 28)}", second[key], unit, US),
                 chart=_chart(unit, [(_short(r["title"], 40), {US: r[key]}, r is first) for r in pool[:5]]),
                 context=f"{first['sold_pct']:.0f} % vendido en {first['shows']} funciones{when}",
                 as_of=first["last_sampled"], stake=100.0 * first["shows"] / sum(r["shows"] for r in everything),
                 action=f"Valora asegurarle salas grandes a {_short(first['title'])} para su estreno.")


def _presale_shows(compare, *chains):
    """Funciones en preventa de `chains` en `presale_compare`; 1 si no hay, para dividir sin error."""
    return sum(r[f"shows_{c}"] or 0 for r in compare for c in chains) or 1


def _presale_gap_finding(compare):
    """El título en preventa en ambas cadenas donde una lleva vendido mucho más de su aforo que la otra."""
    shared = [r for r in compare
              if r["gap_pp"] is not None and min(r["shows_cinemex"], r["shows_cinepolis"]) >= PRESALE_MIN_SHOWS]
    if not shared:
        return None
    shared.sort(key=lambda x: (-abs(x["gap_pp"]), x["title"]))
    r = shared[0]
    if abs(r["gap_pp"]) < PRESALE_GAP_MIN_PP:
        return None
    release = f" · estreno el {date_es(r['release_date'], with_year=False)}" if r["release_date"] else ""
    label = (f"{_short(r['title'], _LABEL_TITLE)}: llevamos {_pct1(r['sold_pct_cinemex'])} del aforo vendido y {THEM_NAME} "
             f"{_pct1(r['sold_pct_cinepolis'])}; {_gap(r['gap_pp'])}")
    action = (f"Valora reforzar la promoción de la preventa de {_short(r['title'])}." if r["gap_pp"] < 0
              else f"Valora asegurarle salas a {_short(r['title'])} para su estreno.")
    return _card("preventa_brecha", label,
                 _metric("Nuestro aforo vendido", r["sold_pct_cinemex"], "pct", US), abs(r["gap_pp"]) / PRESALE_GAP_MIN_PP,
                 compare=_metric(f"El de {THEM_NAME}", r["sold_pct_cinepolis"], "pct", THEM),
                 delta=_metric("Diferencia", r["gap_pp"], "pp"),
                 chart=_chart("pct", [(_short(x["title"], 40), {US: x["sold_pct_cinemex"], THEM: x["sold_pct_cinepolis"]}, x is r)
                                      for x in shared[:5]], "dumbbell"),
                 context=f"{r['shows_cinemex']} funciones nuestras y {r['shows_cinepolis']} suyas{release}",
                 stake=100.0 * (r["shows_cinemex"] + r["shows_cinepolis"]) / _presale_shows(compare, US, THEM),
                 action=action)


def _presale_exclusive_finding(compare):
    """Preventas de Cinépolis de títulos que no exhibimos y que ya venden buena parte de su aforo."""
    theirs = [r for r in compare
              if r["status"] == "exclusiva_cinepolis" and r["shows_cinepolis"] >= PRESALE_MIN_SHOWS]
    hot = sorted((r for r in theirs if r["sold_pct_cinepolis"] >= PRESALE_EXCLUSIVE_MIN_PCT),
                 key=lambda r: (-r["sold_pct_cinepolis"], r["title"]))
    if not hot:
        return None
    first = hot[0]
    release = f" · estreno el {date_es(first['release_date'], with_year=False)}" if first["release_date"] else ""
    ours = [r for r in compare if (r["shows_cinemex"] or 0) >= PRESALE_MIN_SHOWS and r["sold_pct_cinemex"] is not None]
    best_ours = max(ours, key=lambda r: (r["sold_pct_cinemex"], r["title"]), default=None)
    label = f"{_short(first['title'], _LABEL_TITLE)}, solo en {THEM_NAME}, ya vendió {_pct1(first['sold_pct_cinepolis'])} de su aforo"
    return _card("preventa_exclusiva", label,
                 _metric("Aforo vendido", first["sold_pct_cinepolis"], "pct", THEM),
                 first["sold_pct_cinepolis"] / PRESALE_EXCLUSIVE_MIN_PCT,
                 compare=(_metric(f"Nuestra preventa más vendida, {_short(best_ours['title'], 28)}", best_ours["sold_pct_cinemex"], "pct", US)
                          if best_ours else None),
                 chart=_chart("pct", [(_short(r["title"], 40), {THEM: r["sold_pct_cinepolis"]}, r is first) for r in hot[:5]], "meter"),
                 context=f"{first['shows_cinepolis']} funciones suyas{release} · {len(theirs)} preventas solo de {THEM_NAME}",
                 stake=100.0 * first["shows_cinepolis"] / _presale_shows(compare, THEM),
                 action=f"Valora pedir {_short(first['title'])} a su distribuidora.")


def _independent_finding(conn, d0, d1, hours=None, plaza=None):
    """Un título que llena la Cineteca y que no exhibimos en CDMX. Solo con zona CDMX o nacional (la Cineteca solo tiene
    sedes en CDMX) y solo si la lectura de sus planos está confirmada (`independents.OCCUPANCY_CONFIRMED`)."""
    if plaza not in (None, "cdmx") or not OCCUPANCY_CONFIRMED:
        return None
    overlap = independent_overlap(conn, d0, d1, hours=hours)
    full = sorted((r for r in overlap if r["status"] == "indep_only" and r["samples"] >= INDEP_MIN_SAMPLES
                   and (r["sold_pct"] or 0) >= INDEP_MIN_SOLD_PCT), key=lambda r: (-r["sold_pct"], r["title_norm"]))
    if not full:
        return None
    best = full[0]
    label = f"{_short(best['title'], _LABEL_TITLE)} vende {_pct1(best['sold_pct'])} en la Cineteca y no lo exhibimos en CDMX"
    return _card("independientes", label,
                 _metric("Butacas vendidas en la Cineteca", best["sold_pct"], "pct", "cineteca"),
                 best["sold_pct"] / INDEP_MIN_SOLD_PCT,
                 compare=_metric("Funciones nuestras en CDMX", 0, "count", US),
                 chart=_chart("pct", [(_short(r["title"], 40), {"cineteca": r["sold_pct"]}, r is best) for r in full[:5]], "meter"),
                 context=f"{best['samples']:,} funciones medidas · últimos {OCCUPANCY_DAYS} días",
                 action=f"Valora programar {_short(best['title'])} en alguno de nuestros complejos de CDMX.")


def _occupancy_finding(conn, plaza=None):
    """Qué cadena llena más sus salas: % de butacas vendidas de todas sus funciones medidas, esta semana y la anterior."""
    by = {r["chain"]: r for r in chain_occupancy(conn, plaza=plaza)}
    us, them = by.get(US), by.get(THEM)
    if not us or not them:
        return None
    gap = us["sold_pct"] - them["sold_pct"]
    if abs(gap) < OCCUPANCY_MIN_PP:
        return None
    label = (f"Vendemos {_pct1(us['sold_pct'])} de nuestras butacas y {THEM_NAME} {_pct1(them['sold_pct'])} "
             f"de las suyas; {_gap(gap)}")
    action = ("Valora revisar en Cines qué complejos explican la brecha de ocupación." if gap < 0
              else "Valora sostener la programación de los cines que más venden.")
    return _card("ocupacion", label,
                 _metric("De nuestras butacas vendidas", us["sold_pct"], "pct", US), abs(gap) / OCCUPANCY_MIN_PP,
                 compare=_metric(f"De las de {THEM_NAME}", them["sold_pct"], "pct", THEM),
                 delta=_metric("Diferencia", gap, "pp"),
                 chart=_chart("pct", [(f"Últimos {SALES_DAYS} días", {US: us["sold_pct"], THEM: them["sold_pct"]}, True),
                                      (f"{SALES_DAYS} días anteriores", {US: us["sold_pct_prev"], THEM: them["sold_pct_prev"]}, False)], "meter"),
                 context=(f"{us['shows'] + them['shows']:,} funciones medidas en el plano después de empezar · "
                          f"{us['cinemas']} cines Cinemex, {them['cinemas']} {THEM_NAME} · últimos {SALES_DAYS} días"),
                 action=action)


def _rival_finding(conn, plaza=None):
    """El lugar de Cinemex que más vende de menos (o de más) frente a su rival número uno."""
    duels = sorted(main_rivals(conn, plaza=plaza), key=lambda d: (-abs(d["gap_pp"]), d[US]["name"]))
    if not duels or abs(duels[0]["gap_pp"]) < RIVAL_MIN_PP:
        return None
    d = duels[0]
    label = (f"{_short(d[US]['name'])} vende {_pct1(d[US]['sold_pct'])} de sus butacas y {_short(d[THEM]['name'])}, a "
             f"{d['km']} km, {_pct1(d[THEM]['sold_pct'])}; {_gap(d['gap_pp'])}")
    action = (f"Valora revisar precio y horarios de {_short(d[US]['name'])} frente a {_short(d[THEM]['name'])}."
              if d["gap_pp"] < 0 else None)
    return _card("rival", label,
                 _metric("De nuestras butacas vendidas", d[US]["sold_pct"], "pct", US), abs(d["gap_pp"]) / RIVAL_MIN_PP,
                 compare=_metric(f"De las de {THEM_NAME}", d[THEM]["sold_pct"], "pct", THEM),
                 delta=_metric("Diferencia", d["gap_pp"], "pp"),
                 chart=_chart("pct", [(_short(x[US]["name"], 40), {US: x[US]["sold_pct"], THEM: x[THEM]["sold_pct"]}, x is d)
                                      for x in duels[:5]], "dumbbell"),
                 context=(f"El {THEM_NAME} que más vende a {d['km']} km · {d[US]['shows']:,} y {d[THEM]['shows']:,} "
                          f"funciones medidas · últimos {SALES_DAYS} días"),
                 stake=100.0 * (d[US]["shows"] + d[THEM]["shows"]) / sum(x[US]["shows"] + x[THEM]["shows"] for x in duels),
                 action=action)


def findings(conn, d0=None, d1=None, top=3, hours=None, plaza=None):
    """Los `top` hallazgos más fuertes (`strength` = brecha / umbral); `top=None` los devuelve todos. Cada regla solo entra si
    cruza su umbral y, si depende de un muestreo, si el dato está vigente: movimientos del competidor, demanda por
    título (ocupación de Cinépolis), nuestra preventa que se despega, brecha de preventa en un
    mismo título, preventa exclusiva de Cinépolis que ya vende, título por butacas, concentración, dulcería, precio del boleto, franjas, formato,
    exclusivas y títulos que llenan la Cineteca sin funciones nuestras; un empate conserva ese orden. Precio y formato pesan la mitad: cambian poco de semana a semana. `plaza` acota la
    cartelera; la dulcería a domicilio no depende de la plaza (Rappi y DiDi se leen en CDMX)."""
    d0 = d0 or today()
    d1 = d1 or d0
    kp = {r["chain"]: r for r in kpis(conn, d0, d1, hours=hours, plaza=plaza)}
    if US not in kp or THEM not in kp:
        return []
    movies = movies_by_chain(conn, d0, d1, limit=200, hours=hours, plaza=plaza)
    compare = presale_compare(conn, plaza=plaza)
    out = []
    for fn in (lambda: _moves_finding(conn, d0, d1, movies, hours=hours, plaza=plaza),
               lambda: _occupancy_finding(conn, plaza=plaza),
               lambda: _rival_finding(conn, plaza=plaza),
               lambda: _demand_finding(conn, movies, plaza=plaza),
               lambda: _presale_finding(conn, plaza=plaza),
               lambda: _presale_gap_finding(compare),
               lambda: _presale_exclusive_finding(compare),
               lambda: _title_finding(conn, d0, d1, hours=hours, plaza=plaza),
               lambda: _concentration_finding(conn, d0, d1, movies, hours=hours, plaza=plaza),
               lambda: _concession_finding(conn, plaza=plaza),
               lambda: _price_finding(conn, d0, d1, hours=hours, plaza=plaza),
               lambda: _slot_finding(conn, d0, d1, hours=hours, plaza=plaza),
               lambda: _format_finding(conn, d0, d1, kp, hours=hours, plaza=plaza),
               lambda: _exclusive_finding(movies),
               lambda: _independent_finding(conn, d0, d1, hours=hours, plaza=plaza)):
        f = fn()
        if f:
            f.setdefault("as_of", None)
            out.append(f)
    return sorted(out, key=lambda f: -f["strength"])[:top]


# Las secciones de evidencia que llevan conclusión, en el orden en que `conclusions()` las devuelve.
CONCLUSION_SECTIONS = ("resumen", "peliculas", "franjas", "formatos", "preventa", "dulceria")


def conclusions(conn, d0=None, d1=None, shown=8, total=15, hours=None, plaza=None, sections=CONCLUSION_SECTIONS):
    """Frase de apertura de cada sección de evidencia. `sections` calcula solo esas llaves de
    `CONCLUSION_SECTIONS`; `"peliculas"` trae también `peliculas_note`. Ejemplo: `sections=("franjas",)` → {franjas}."""
    d0 = d0 or today()
    d1 = d1 or d0
    out = {}
    kp = {r["chain"]: r for r in kpis(conn, d0, d1, hours=hours, plaza=plaza)}
    us, them = kp.get(US), kp.get(THEM)
    if not us or not them:
        return out

    # Resumen general: volumen total y cuánto concentra el Top del reporte del cliente.
    if "resumen" in sections:
        summary = general_summary(conn, d0, d1, hours=hours, plaza=plaza)
        titles = [r for r in summary if r["kind"] == "title"]
        tot = summary[-1]
        top_us, top_them = sum(r["share_cinemex"] for r in titles), sum(r["share_cinepolis"] for r in titles)
        ratio = f"{tot['ratio']:.2f}" if tot["ratio"] else "—"
        out["resumen"] = (f"Publicamos {tot['shows_cinemex']:,} funciones frente a {tot['shows_cinepolis']:,} de {THEM_NAME} "
                          f"({ratio} funciones suyas por cada una nuestra); las {len(titles)} películas con más funciones concentran "
                          f"{_pct(top_us)} de nuestra parrilla y {_pct(top_them)} de la suya.")

    # Películas: sobre-indexamos / ellos apuestan más / exclusivas, sobre las `total` con más funciones.
    if "peliculas" in sections:
        top_movies = movies_by_chain(conn, d0, d1, limit=total, hours=hours, plaza=plaza)
        shared = [m for m in top_movies if m["shows_cinemex"] and m["shows_cinepolis"]]
        more = sorted([m for m in shared if m["gap_pp"] >= 1], key=lambda m: -m["gap_pp"])[:2]
        less = sorted([m for m in shared if m["gap_pp"] <= -1], key=lambda m: m["gap_pp"])[:2]
        only_us = [m for m in top_movies if not m["shows_cinepolis"]]
        only_them = [m for m in top_movies if not m["shows_cinemex"]]
        parts = []
        if more:
            parts.append("Sobre-indexamos en " + " y ".join(f"{_short(m['title'], 28)} ({_pp(m['gap_pp'])})" for m in more))
        if less:
            doubles = all(m["share_cinepolis"] >= 2 * m["share_cinemex"] for m in less)
            parts.append(f"{THEM_NAME} {'nos dobla' if doubles else 'apuesta más'} en " +
                         " y ".join(f"{_short(m['title'], 28)} ({_pp(m['gap_pp'])})" for m in less))
        if only_us or only_them:
            ex = []
            if only_us:
                ex.append(f"{len(only_us)} exclusiva{'s' if len(only_us) != 1 else ''} nuestra{'s' if len(only_us) != 1 else ''}")
            if only_them:
                ex.append(f"{len(only_them)} de {THEM_NAME}")
            parts.append("entre los títulos más programados hay " + " y ".join(ex))
        out["peliculas"] = "; ".join(parts) + "." if parts else f"Repartimos la parrilla casi igual que {THEM_NAME} entre los títulos principales."
        out["peliculas_note"] = f"Mostrando las {shown} con mayor diferencia; el resto no mueve decisiones."

    # Franjas: dónde ganamos y dónde perdemos.
    if "franjas" in sections:
        slots = {r["chain"]: r for r in showtimes_by_slot(conn, d0, d1, hours=hours, plaza=plaza)}
        su, st_ = slots[US], slots[THEM]
        h0, h1 = hours or FULL_DAY
        gaps = {k: 100.0 * su[k] / su["total"] - 100.0 * st_[k] / st_["total"] for k, lo, hi, _ in SLOTS
                if lo >= h0 and hi <= h1 and (su[k] or st_[k])}
        win = sorted([k for k in gaps if gaps[k] >= 0.5], key=lambda k: -gaps[k])
        lose = sorted([k for k in gaps if gaps[k] <= -0.5], key=lambda k: gaps[k])
        txt = []
        if win:
            txt.append("Ganamos " + " y ".join(_slot_phrase(k) for k in win[:2]))
        if lose:
            k = lose[0]
            txt.append(f"perdemos {_slot_phrase(k)}, donde {THEM_NAME} pone {abs(gaps[k]):.1f} pp más" +
                       (f", y también {_slot_phrase(lose[1])}" if len(lose) > 1 else ""))
        out["franjas"] = ("; ".join(txt) + "." if txt else f"La distribución por franja es prácticamente la misma que la de {THEM_NAME}.")
        out["franjas"] = out["franjas"][0].upper() + out["franjas"][1:]

    # Formatos e idioma.
    if "formatos" in sections:
        mx = {(r["dimension"], r["chain"], r["bucket"]): r["share"] for r in mix(conn, d0, d1, hours=hours, plaza=plaza)}
        fg = [(mx.get(("format", US, b), 0) - mx.get(("format", THEM, b), 0), b) for b in FORMAT_LABEL if b != "traditional"]
        g, b = max(fg, key=lambda x: abs(x[0]))
        u, t = mx.get(("format", US, b), 0), mx.get(("format", THEM, b), 0)
        if abs(g) >= 2:
            fmt = (f"Nuestra diferencia estructural es {FORMAT_LABEL[b]}: {_pct(u)} de nuestras funciones frente a {_pct(t)} en {THEM_NAME}."
                   if g > 0 else
                   f"{THEM_NAME} pone más en {FORMAT_LABEL[b]}: {_pct(t)} de sus funciones frente a {_pct(u)} nuestras.")
        else:
            fmt = f"El mix de formato es casi el mismo que el de {THEM_NAME}."
        ds = us["pct_subtitled"] - them["pct_subtitled"]
        if ds <= -1:
            fmt += f" Ellos subtitulan más ({them['pct_subtitled']:.0f} % vs {us['pct_subtitled']:.0f} %)."
        elif ds >= 1:
            fmt += f" Nosotros subtitulamos más ({us['pct_subtitled']:.0f} % vs {them['pct_subtitled']:.0f} %)."
        out["formatos"] = fmt

    # Preventa: cuántos títulos tenemos en preventa y cuál se vende más.
    if "preventa" in sections:
        ranking = [r for r in presale_ranking(conn, plaza=plaza) if r["shows"] >= PRESALE_MIN_SHOWS]
        compare = presale_compare(conn, plaza=plaza)
        shared = [r for r in compare if r["gap_pp"] is not None and min(r["shows_cinemex"], r["shows_cinepolis"]) >= PRESALE_MIN_SHOWS]
        only_them = [r for r in compare if r["status"] == "exclusiva_cinepolis" and r["shows_cinepolis"] >= PRESALE_MIN_SHOWS]
        only_us = [r for r in compare if r["status"] == "exclusiva_cinemex" and r["shows_cinemex"] >= PRESALE_MIN_SHOWS]
        if ranking:
            top = ranking[0]
            out["preventa"] = (f"Tenemos {len(ranking)} títulos en preventa con panel suficiente; {_short(top['title'], 50)} "
                               + (f"vende {top['pace_pct_day']:.1f} puntos de su aforo al día y lleva {top['sold_pct']:.0f} % vendido."
                                  if top["pace_pct_day"] is not None else f"es el que más lleva vendido: {top['sold_pct']:.0f} % del aforo de su panel."))
            if shared:
                ahead = sum(r["gap_pp"] > 0 for r in shared)
                out["preventa"] += (f" En los {len(shared)} títulos que ambas cadenas tienen en preventa, vamos adelante en {ahead}"
                                    f" y {THEM_NAME} en {len(shared) - ahead}.")
            if only_them or only_us:
                out["preventa"] += (f" Exclusivas en preventa: nosotros {len(only_us)} y {THEM_NAME} {len(only_them)}"
                                    + (f", la más vendida {_short(only_them[0]['title'], 30)} ({only_them[0]['sold_pct_cinepolis']:.0f} %)."
                                       if only_them else "."))

    # Dulcería: brecha a domicilio (misma plataforma) y modelo de precio en sala.
    if "dulceria" in sections:
        gap, cmp_, as_of = _concession_gap(conn)
        basket = {r["product_name"]: r for r in concession_basket(conn, plaza=plaza)}
        pop = basket.get("Palomitas")
        if gap is not None:
            who = (f"{THEM_NAME} cobra {gap:.0f} % más que nosotros" if gap > 0 else f"cobramos {abs(gap):.0f} % más que {THEM_NAME}")
            when = "" if _is_fresh(as_of, CONCESSION_MAX_AGE_DAYS) else f" con los precios del {date_es(_local_date(as_of), with_year=False)}, la última lectura,"
            out["dulceria"] = (f"En la dulcería a domicilio{when} {who} en la canasta comparable ({len(cmp_)} tipos de producto)"
                               + (f"; en sala, {THEM_NAME} fija precio por complejo (palomitas de ${pop['min_price']:,.0f} a "
                                  f"${pop['max_price']:,.0f}) y nosotros una lista única." if pop else "."))
        elif pop:
            out["dulceria"] = (f"{THEM_NAME} fija el precio de dulcería por complejo: palomitas de ${pop['min_price']:,.0f} a "
                               f"${pop['max_price']:,.0f} en {int(pop['distinct_prices'])} niveles. Nuestra lista llegará con tus datos.")

    return out


def independent_conclusions(conn, d0=None, d1=None, hours=None):
    """Frase de apertura de cada sección de la página de la oferta independiente: {programa, ocupacion, solape,
    franjas}. Una clave falta si no hay dato que la sostenga (sin cartelera, o sin planos confirmados)."""
    d0 = d0 or today()
    d1 = d1 or d0
    out = {}
    venues = independent_summary(conn, d0, d1, hours=hours)
    if not venues:
        return out
    titles = independent_titles(conn, d0, d1, hours=hours, limit=1000)
    shows = sum(v["shows"] for v in venues)
    original = sum(t["other"] for t in titles)
    top = titles[0]
    out["programa"] = (f"La Cineteca programa {shows:,} funciones de {len(titles)} títulos en sus {len(venues)} sedes; "
                       f"la más programada es {_short(top['title'], 40)} ({_pct(top['share_shows'])} de su parrilla) y "
                       f"{_pct(100.0 * original / shows)} de sus funciones van en lengua original.")

    occ = occupancy_by_cinema(conn, days=OCCUPANCY_DAYS)
    if OCCUPANCY_CONFIRMED and occ:
        sold = sum(r["seats"] * r["sold_pct"] / 100.0 for r in occ)
        seats = sum(r["seats"] for r in occ)
        best = max(occ, key=lambda r: (r["sold_pct"], r["cinema_id"]))
        out["ocupacion"] = (f"En la última semana sus funciones vendieron {_pct(100.0 * sold / seats)} de las butacas "
                            f"({sum(r['samples'] for r in occ):,} funciones medidas); lo más lleno es {best['cinema_name']} "
                            f"{_slot_phrase(best['slot'])} ({_pct(best['sold_pct'])}).")

    overlap = independent_overlap(conn, d0, d1, hours=hours)
    shared = [r for r in overlap if r["status"] == "shared"]
    shared_shows = sum(r["shows_indep"] for r in shared)
    out["solape"] = (f"{_pct(100.0 * shared_shows / shows)} de sus funciones son de títulos que también exhibimos en CDMX "
                     f"({len(shared)} de {len(overlap)} títulos); el resto es oferta que no tenemos.")
    out["solape"] = out["solape"][0].upper() + out["solape"][1:]

    slots = {(r["chain"], r["slot"]): r["share"] for r in independent_slots(conn, d0, d1, hours=hours)}
    gaps = {k: slots.get(("cineteca", k), 0) - slots.get((US, k), 0) for k, _, _, _ in SLOTS
            if ("cineteca", k) in slots and (US, k) in slots}
    if gaps:
        k = max(gaps, key=lambda k: (gaps[k], k))
        out["franjas"] = (f"La Cineteca pone {_pct(slots[('cineteca', k)])} de sus funciones {_slot_phrase(k)}, "
                          f"frente a {_pct(slots[(US, k)])} de las nuestras en CDMX ({_pp(gaps[k])}).")
    return out


def distributor_conclusions(conn, d0=None, d1=None, from_now=True, hours=None, plaza=None):
    """Frases de la página de distribuidoras: {brecha, sin_conciliar}. `brecha` nombra la distribuidora con la mayor
    diferencia de share entre cadenas, o dice que ninguna cruza `DISTRIBUTOR_MIN_PP`; falta si no hay funciones.
    `sin_conciliar` cuenta los títulos que la brecha deja fuera; falta si no hay ninguno. Los programas propios no
    entran a la brecha: cada cadena tiene el suyo."""
    reach = distributor_reach(conn, d0, d1, from_now=from_now, hours=hours, plaza=plaza)
    if not reach:
        return {}
    out = {}
    gaps = [g for g in distributor_gaps(conn, d0, d1, from_now=from_now, hours=hours, plaza=plaza)
            if g["kind"] != "programa_propio"]
    top = gaps[0] if gaps else None
    if top and abs(top["gap_pp"]) >= DISTRIBUTOR_MIN_PP:
        us, them = _pct(top[f"share_{US}"]), _pct(top[f"share_{THEM}"])
        gap = f"{abs(top['gap_pp']):.1f} pp"
        if top["gap_pp"] < 0:
            out["brecha"] = (f"{THEM_NAME} le da a {top['distributor']} {gap} más de su programación que nosotros "
                             f"({them} frente a {us}).")
        else:
            out["brecha"] = (f"Le damos a {top['distributor']} {gap} más de nuestra programación que {THEM_NAME} "
                             f"({us} frente a {them}).")
    else:
        out["brecha"] = f"Ninguna distribuidora se separa {DISTRIBUTOR_MIN_PP:.0f} pp o más entre las dos cadenas."
    unreconciled = [r for r in reach if r["kind"] == distributors.KIND_UNRECONCILED]
    if unreconciled:
        shows = sum(r["shows"] for r in unreconciled)
        out["sin_conciliar"] = (f"{shows:,} funciones son de títulos con distinta distribuidora en cada cadena y quedan "
                                "fuera de la brecha.")
    return out
