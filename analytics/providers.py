"""Alcance por distribuidor: cuántos cines, salas y funciones de cada cadena trae cada distribuidor.

El nombre viene de `distributor_key` (`scraper/distributors.py`), así que las variantes de una misma distribuidora
suman juntas. Los shares son % de la programación de la cadena en el periodo, incluidas las funciones cuyo
distribuidor es un error de fuente: el denominador es lo que la cadena programa, no lo que sabemos clasificar.
"""
from .db import rows
from .labels import COMPARED
from .queries import _FORMAT_CASE, _window


def provider_reach(conn, d0=None, d1=None, from_now=True, hours=None, plaza=None, chains=COMPARED):
    """Por distribuidor y cadena: `provider`, `kind` (tipo del mapa), `chain`, `cinemas` y `share_cinemas` (% de los
    cines de la cadena), `screens` (salas `cinema|sala`), `shows` y `share_shows` (% de sus funciones), y
    `large_shows` (funciones en formato premium o gran formato). Ordenado por funciones, luego por nombre."""
    where, params, _ = _window(d0, d1, from_now, hours=hours, plaza=plaza, chains=chains)
    return rows(conn, f"""
        WITH base AS (SELECT chain, cinema_id, screen,
                             distributor_key(distributor) provider, distributor_kind(distributor) kind,
                             {_FORMAT_CASE} fmt
                      FROM current_showtime WHERE {where}),
             tot AS (SELECT chain, COUNT(*) shows, COUNT(DISTINCT cinema_id) cinemas FROM base GROUP BY chain)
        SELECT b.provider, MAX(b.kind) kind, b.chain,
               COUNT(DISTINCT b.cinema_id) cinemas,
               ROUND(100.0 * COUNT(DISTINCT b.cinema_id) / (SELECT cinemas FROM tot WHERE chain = b.chain), 1) share_cinemas,
               COUNT(DISTINCT b.cinema_id || '|' || b.screen) screens,
               COUNT(*) shows,
               ROUND(100.0 * COUNT(*) / (SELECT shows FROM tot WHERE chain = b.chain), 1) share_shows,
               SUM(b.fmt IN ('premium', 'large')) large_shows
        FROM base b
        WHERE b.provider IS NOT NULL
        GROUP BY b.provider, b.chain
        ORDER BY shows DESC, b.provider, b.chain""", params)
