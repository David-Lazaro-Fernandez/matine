"""Organizaciones (`organization`) y qué puede hacer cada cuenta: los módulos que contrató su organización y lo que
permite su rol.

Roles, de más a menos: `staff` (el equipo de la plataforma: todos los módulos, Operaciones y todas las cuentas),
`admin` (gestiona las cuentas y el logo de su organización), `analyst` (además de ver, descarga) y `viewer` (ve y
filtra). Los módulos de una organización son claves de `MODULES`; un plan es solo el nombre comercial de una lista.
"""
import json
from datetime import datetime, timezone

from . import secrets
from .db import MODULES, cursor, one, rows, transaction

ROLES = ("staff", "admin", "analyst", "viewer")
# Lo que un admin puede asignar desde el dashboard. `staff` solo se da por la línea de comandos.
CLIENT_ROLES = ROLES[1:]
_MANAGERS = {"staff", "admin"}
_DOWNLOADERS = {"staff", "admin", "analyst"}
# Lo que configura el admin desde el dashboard o la línea de comandos.
SETTINGS = ("slack_webhook", "digest_recipients")
# Estado que escribe el envío de `integrations/`: el cursor de alertas y la última semana con resumen enviado.
STATE = ("slack_last_event_id", "digest_last_week", "slack_digest_week")
SLACK_WEBHOOK_PREFIX = "https://hooks.slack.com/"
MAX_RECIPIENTS = 20


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


def workspace(conn, org_id):
    """Lo que el admin ve de su espacio de trabajo: `name`, `seats` (pagados, None sin suscripción), `members` (cuentas
    activas de clientes, con invitación pendiente incluida, porque ya ocupan un asiento) y `next_billing_at`."""
    org = one(conn, "SELECT name, seats, next_billing_at FROM organization WHERE id = ?", (org_id,))
    members = one(conn, "SELECT count(*) AS n FROM account WHERE org_id = ? AND active AND role != 'staff'",
                  (org_id,))["n"]
    return {**org, "members": members}


def set_billing(conn, org_id, seats, next_billing_at):
    """Fija asientos pagados y próximo cobro (fecha ISO). `seats=None` quita la suscripción y su fecha."""
    if seats is None:
        next_billing_at = None
    elif seats < 1:
        raise ValueError("los asientos deben ser 1 o más")
    elif not next_billing_at:
        raise ValueError("falta la fecha del próximo cobro")
    else:
        when = datetime.fromisoformat(next_billing_at)
        next_billing_at = when.replace(tzinfo=when.tzinfo or timezone.utc).astimezone(timezone.utc).isoformat()
    with cursor(conn) as cur:
        cur.execute("UPDATE organization SET seats = ?, next_billing_at = ? WHERE id = ?",
                    (seats, next_billing_at, org_id))
        return cur.rowcount == 1


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


def integrations(conn, org_id):
    """Ajustes y estado de envío de una organización; {} si no existe."""
    row = one(conn, "SELECT integrations FROM organization WHERE id = ?", (org_id,))
    return json.loads(row["integrations"]) if row else {}


def set_settings(conn, org_id, changes):
    """Cambia los ajustes del admin. Un valor vacío o None quita el ajuste. Solo acepta webhooks de Slack, para que el
    servidor no publique en cualquier URL."""
    unknown = set(changes) - set(SETTINGS)
    if unknown:
        raise ValueError(f"ajustes desconocidos: {sorted(unknown)}")
    if changes.get("slack_webhook") and not changes["slack_webhook"].startswith(SLACK_WEBHOOK_PREFIX):
        raise ValueError(f"el webhook debe empezar por {SLACK_WEBHOOK_PREFIX}")
    if "digest_recipients" in changes:
        changes = {**changes, "digest_recipients": _recipients(changes["digest_recipients"])}
    _merge(conn, org_id, changes)


def record_state(conn, org_id, key, value):
    """Guarda el estado de un envío. Solo lo llama `integrations/`; el admin no lo ve."""
    if key not in STATE:
        raise ValueError(f"estado desconocido: {key}")
    _merge(conn, org_id, {key: value})


def _recipients(emails):
    clean = [e.strip() for e in emails or () if e.strip()]
    if len(clean) > MAX_RECIPIENTS:
        raise ValueError(f"máximo {MAX_RECIPIENTS} destinatarios")
    bad = [e for e in clean if "@" not in e or " " in e]
    if bad:
        raise ValueError(f"correos inválidos: {bad}")
    return clean


def _merge(conn, org_id, changes):
    with transaction(conn):
        row = one(conn, "SELECT integrations FROM organization WHERE id = ?", (org_id,))
        if row is None:
            raise ValueError(f"no hay organización {org_id}")
        values = {**json.loads(row["integrations"]), **changes}
        conn.execute("UPDATE organization SET integrations = ? WHERE id = ?", (json.dumps(values), org_id))


def set_agent_provider(conn, org_id, provider, api_key, actor_id=None):
    """Guarda el proveedor de IA de la organización y su clave, cifrada con KMS. `api_key=None` quita ambos. El cambio
    queda en `audit` sin la clave."""
    token = secrets.encrypt(api_key, org_id) if api_key else None
    with transaction(conn):
        with cursor(conn) as cur:
            cur.execute("UPDATE organization SET agent_provider = ?, agent_key = ? WHERE id = ?",
                        (provider if api_key else None, token, org_id))
            changed = cur.rowcount == 1
        if changed:
            conn.execute("INSERT INTO audit (at, actor_id, action, detail) VALUES (?, ?, ?, ?)",
                         (datetime.now(timezone.utc), actor_id, "set_agent_provider",
                          json.dumps({"org_id": org_id, "provider": provider if api_key else None})))
    return changed


def agent_provider(conn, org_id):
    """(proveedor, clave en claro) de la organización, o None sin configurar. Solo para `agent/`: la clave nunca
    llega al navegador ni al modelo."""
    row = one(conn, "SELECT agent_provider, agent_key FROM organization WHERE id = ?", (org_id,))
    if not row or not row["agent_key"]:
        return None
    return row["agent_provider"], secrets.decrypt(row["agent_key"], org_id)


def agent_status(conn):
    """Por organización: `id`, `name` y `provider` (None sin configurar). Nunca trae la clave."""
    return rows(conn, """SELECT id, name, CASE WHEN agent_key IS NULL THEN NULL ELSE agent_provider END AS provider
                         FROM organization ORDER BY id""")
