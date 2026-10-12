"""Organizaciones (`organization`) y qué puede hacer cada cuenta: los módulos que contrató su organización y lo que
permite su rol.

Roles, de más a menos: `staff` (el equipo de la plataforma: todos los módulos, Operaciones y todas las cuentas),
`admin` (gestiona las cuentas y el logo de su organización), `analyst` (además de ver, descarga) y `viewer` (ve y
filtra). Los módulos de una organización son claves de `MODULES`; un plan es solo el nombre comercial de una lista.
"""
import json
from datetime import datetime, timezone

from .db import MODULES, cursor, one, rows

ROLES = ("staff", "admin", "analyst", "viewer")
# Lo que un admin puede asignar desde el dashboard. `staff` solo se da por la línea de comandos.
CLIENT_ROLES = ROLES[1:]
_MANAGERS = {"staff", "admin"}
_DOWNLOADERS = {"staff", "admin", "analyst"}


def modules_of(user):
    """Módulos que ve la cuenta: los de su organización, o todos si es staff."""
    return list(MODULES) if user["role"] == "staff" else user["modules"]


def can_manage(user):
    return user["role"] in _MANAGERS


def can_download(user):
    return user["role"] in _DOWNLOADERS


def create(conn, name, modules):
    return _decode(one(conn, """INSERT INTO organization (name, modules, created_at) VALUES (?, ?, ?)
                                RETURNING id, name, modules""",
                       (name.strip(), json.dumps(_known(modules)), datetime.now(timezone.utc))))


def set_modules(conn, org_id, modules):
    with cursor(conn) as cur:
        cur.execute("UPDATE organization SET modules = ? WHERE id = ?", (json.dumps(_known(modules)), org_id))
        return cur.rowcount == 1


def list_orgs(conn):
    return [_decode(row) for row in rows(conn, "SELECT id, name, modules FROM organization ORDER BY id")]


def decode_modules(raw):
    """La columna `modules` como lista: '["cartelera"]' → ['cartelera']."""
    return json.loads(raw or "[]")


def _known(modules):
    unknown = set(modules) - set(MODULES)
    if unknown:
        raise ValueError(f"módulos desconocidos: {sorted(unknown)}")
    return [m for m in MODULES if m in modules]


def _decode(row):
    return {**row, "modules": decode_modules(row["modules"])}
