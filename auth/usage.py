"""Uso del asistente de IA por hora, cuenta y modelo, leído de `agent_audit`. Solo lee: las estadísticas y el costo
estimado los arma `agent/usage.py`. La auditoría no lleva texto, así que sigue ahí cuando las conversaciones se purgan.
"""
from .db import rows


def hourly(conn, since, org_id=None):
    """Una fila por (hora, cuenta, proveedor, modelo) desde `since` (datetime): `hour` ('2026-10-14T22'), `account_id`,
    `name`, `email`, `org_id`, `org_name`, `provider`, `model`, `questions`, `errors`, `tokens_in` y `tokens_out`. Con
    `org_id`, solo esa organización. La hora importa porque el precio de un modelo puede cambiar con ella."""
    return rows(conn, """
        SELECT substr(a.at, 1, 13) AS hour, a.account_id, ac.name, ac.email, a.org_id, o.name AS org_name,
               a.provider, a.model, count(*) AS questions, sum(a.error IS NOT NULL) AS errors,
               coalesce(sum(a.tokens_in), 0) AS tokens_in, coalesce(sum(a.tokens_out), 0) AS tokens_out
        FROM agent_audit a
        JOIN account ac ON ac.id = a.account_id
        LEFT JOIN organization o ON o.id = a.org_id
        WHERE a.at >= ? AND (? IS NULL OR a.org_id = ?)
        GROUP BY hour, a.account_id, a.provider, a.model
        ORDER BY hour, a.account_id""", (since, org_id, org_id))
