"""Distribuidoras: cuántos cines, salas y funciones de cada cadena trae cada distribuidora, y la brecha de share entre
cadenas.

El nombre viene de `distributor_key` (`scraper/distributors.py`), así que las variantes de una misma distribuidora
suman juntas. Los shares son % de la programación de la cadena en el periodo, incluidas las funciones cuyo
distribuidor es un error de fuente: el denominador es lo que la cadena programa, no lo que sabemos clasificar.
"""
from scraper import distributors

from .db import rows
from .labels import COMPARED, THEM, US
from .queries import _FORMAT_CASE, _window


def distributor_reach(conn, d0=None, d1=None, from_now=True, hours=None, plaza=None, chains=COMPARED):
    """Por distribuidora, tipo y cadena: `distributor`, `kind` (tipo del mapa), `chain`, `cinemas` y `share_cinemas`
    (% de los cines de la cadena), `screens` (salas `cinema|sala`), `shows` y `share_shows` (% de sus funciones), y
    `large_shows` (funciones en formato premium o gran formato). Ordenado por funciones, luego por nombre.

    Cada función cuenta con la distribuidora de su título: la de `title_distributors.csv`, o la única que dan las
    cadenas en el periodo. Si dan varias y la tabla no decide, cuenta con la de su cadena y tipo `sin_conciliar`.
    Ejemplo: Verity como Amazon MGM en Cinemex y Universal en Cinépolis, sin fila → dos renglones `sin_conciliar`."""
    where, params, _ = _window(d0, d1, from_now, hours=hours, plaza=plaza, chains=chains)
    return rows(conn, f"""
        WITH base AS (SELECT chain, cinema_id, screen, title_key(title_norm) title,
                             distributor_key(distributor) named, {_FORMAT_CASE} fmt
                      FROM current_showtime WHERE {where}),
             title AS (SELECT title, title_distributor(title) decided, COUNT(DISTINCT named) names, MAX(named) only_name
                       FROM base GROUP BY title),
             shows AS (SELECT b.chain, b.cinema_id, b.screen, b.fmt,
                              COALESCE(t.decided, CASE WHEN t.names = 1 THEN t.only_name ELSE b.named END) distributor,
                              t.decided IS NULL AND t.names > 1 unreconciled
                       FROM base b JOIN title t USING (title)),
             tot AS (SELECT chain, COUNT(*) shows, COUNT(DISTINCT cinema_id) cinemas FROM shows GROUP BY chain)
        SELECT s.distributor, CASE WHEN s.unreconciled THEN '{distributors.KIND_UNRECONCILED}'
                                   ELSE distributor_kind(s.distributor) END kind, s.chain,
               COUNT(DISTINCT s.cinema_id) cinemas,
               ROUND(100.0 * COUNT(DISTINCT s.cinema_id) / (SELECT cinemas FROM tot WHERE chain = s.chain), 1) share_cinemas,
               COUNT(DISTINCT s.cinema_id || '|' || s.screen) screens,
               COUNT(*) shows,
               ROUND(100.0 * COUNT(*) / (SELECT shows FROM tot WHERE chain = s.chain), 1) share_shows,
               SUM(s.fmt IN ('premium', 'large')) large_shows
        FROM shows s
        WHERE s.distributor IS NOT NULL
        GROUP BY s.distributor, s.unreconciled, s.chain
        ORDER BY shows DESC, s.distributor, kind, s.chain""", params)


def distributor_gaps(conn, d0=None, d1=None, from_now=True, hours=None, plaza=None):
    """Por distribuidora: `distributor`, `kind`, `share_cinemex` y `share_cinepolis` (% de las funciones de cada
    cadena; 0 si una cadena no la programa), `shows_cinemex` y `shows_cinepolis`, y `gap_pp` (nosotros menos ellos). Deja fuera las funciones
    `sin_conciliar`: su brecha sería de etiqueta, no de programación. Primero las que programan ambas cadenas, luego las
    de una sola y al final los programas propios; en cada grupo, de la brecha más grande, con cualquier signo, a la
    más chica, luego por nombre. Ejemplo: Warner con 18 % en Cinemex y 22 % en Cinépolis → `gap_pp` −4.0."""
    by_name = {}
    for r in distributor_reach(conn, d0, d1, from_now=from_now, hours=hours, plaza=plaza):
        if r["kind"] == distributors.KIND_UNRECONCILED:
            continue
        row = by_name.setdefault(r["distributor"], {"distributor": r["distributor"], "kind": r["kind"],
                                                    f"share_{US}": 0.0, f"share_{THEM}": 0.0,
                                                    f"shows_{US}": 0, f"shows_{THEM}": 0})
        row[f"share_{r['chain']}"] = r["share_shows"]
        row[f"shows_{r['chain']}"] = r["shows"]
    for row in by_name.values():
        row["gap_pp"] = round(row[f"share_{US}"] - row[f"share_{THEM}"], 1)
    return sorted(by_name.values(), key=lambda r: (r["kind"] == "programa_propio", not (r[f"shows_{US}"] and r[f"shows_{THEM}"]),
                                                   -abs(r["gap_pp"]), r["distributor"]))
