"""Flujos de acceso que comparten las páginas del dashboard y la línea de comandos: entrar, salir, invitar,
restablecer contraseña y administrar cuentas. Cada función cierra su propia transacción (`db.transaction`) y deja
rastro en `audit`. Sin Streamlit."""
import base64
import binascii
import json
from datetime import datetime, timedelta, timezone

from analytics.labels import MAIL_INTEREST, MAIL_INVITE, MAIL_RESET, MODULE_LABEL
from scraper import config

from . import mail, orgs, security, sessions, users
from .db import DEFAULT_ORG_ID, cursor, one, transaction
from .errors import (
                     AccountInactive,
                     AccountLocked,
                     DuplicateEmail,
                     InvalidCredentials,
                     InvalidImage,
                     MailFailed,
                     TokenInvalid,
                     WeakPassword,
                     WrongPassword,
)

THEMES = ("system", "light", "dark")
# El navegador reduce la imagen antes de mandarla. 400 mil caracteres de base64 son unos 300 KB.
IMAGE_MAX_CHARS = 400_000
_IMAGE_TYPES = ("image/png", "image/jpeg", "image/webp")


def link_for(raw):
    """URL pública del enlace de un token (invitación o restablecimiento)."""
    return f"{config.BASE_URL}/restablecer?token={raw}"


def login(conn, email, password, ip=None, user_agent=None):
    """Verifica credenciales y emite una sesión. Devuelve (valor de la cookie, usuario). Levanta
    `InvalidCredentials`, `AccountInactive` o `AccountLocked`. Un correo desconocido cuesta lo mismo que una
    contraseña mala: se verifica contra un hash falso para no revelar cuentas por tiempo de respuesta. El registro
    del fallo se confirma antes de levantar el error, para que el contador de bloqueo no se deshaga."""
    now = datetime.now(timezone.utc)
    failure = None
    with transaction(conn):
        user = users.by_email(conn, email)
        if user is None:
            security.verify_password(password, _DUMMY_HASH)
            _audit(conn, None, "login_failed", None, {"email": security.normalize_email(email), "ip": ip})
            failure = InvalidCredentials()
        elif user["locked_until"] and user["locked_until"] > now:
            failure = AccountLocked(security.minutes_left(user["locked_until"], now))
        elif not security.verify_password(password, users.password_hash(conn, user["id"])):
            until = users.record_login(conn, user["id"], ok=False, now=now)
            _audit(conn, user["id"], "login_failed", user["id"], {"ip": ip, "locked": until is not None})
            failure = AccountLocked(security.minutes_left(until, now)) if until else InvalidCredentials()
        elif not user["active"]:
            failure = AccountInactive()
        else:
            users.record_login(conn, user["id"], ok=True, now=now)
            raw = sessions.create(conn, user["id"], ip=ip, user_agent=user_agent, now=now)
            _audit(conn, user["id"], "login_ok", user["id"], {"ip": ip})
    if failure:
        raise failure
    return raw, {k: user[k] for k in ("id", "email", "name", "role", "active")}


def logout(conn, raw):
    with transaction(conn):
        user_id = sessions.revoke(conn, raw)
        if user_id:
            _audit(conn, user_id, "logout", user_id, None)


def invite(conn, actor_id, email, name, role="viewer", send_mail=True, org_id=None):
    """Crea la cuenta y su enlace de invitación; lo envía por correo salvo `send_mail=False`. Devuelve
    (usuario, enlace). Sin `org_id`, la cuenta entra a la organización de quien invita, o a la del piloto si invita la
    línea de comandos. Levanta `DuplicateEmail`."""
    with transaction(conn):
        org_id = org_id or (users.by_id(conn, actor_id)["org_id"] if actor_id else DEFAULT_ORG_ID)
        user = users.create(conn, email, name, role, created_by=actor_id, org_id=org_id)
        raw = _issue_token(conn, user["id"], "invite", actor_id)
        _audit(conn, actor_id, "invite", user["id"], {"role": role, "org_id": org_id})
    link = link_for(raw)
    if send_mail:
        _send(user, MAIL_INVITE, link, hours=security.INVITE_TTL_HOURS)
    return user, link


def resend(conn, actor_id, user_id, send_mail=True):
    """Enlace nuevo para una cuenta (invitación si aún no tiene contraseña, restablecimiento si ya la tiene).
    Invalida los enlaces anteriores. Devuelve el enlace."""
    with transaction(conn):
        user = users.by_id(conn, user_id)
        purpose = "reset" if user["has_password"] else "invite"
        raw = _issue_token(conn, user_id, purpose, actor_id)
        _audit(conn, actor_id, "resend", user_id, {"purpose": purpose})
    link = link_for(raw)
    if send_mail:
        if purpose == "invite":
            _send(user, MAIL_INVITE, link, hours=security.INVITE_TTL_HOURS)
        else:
            _send(user, MAIL_RESET, link, minutes=security.RESET_TTL_MIN)
    return link


def request_reset(conn, email, send_mail=True):
    """Flujo público de "olvidé mi contraseña". Silencioso: si el correo no existe, la cuenta está inactiva o ya
    pidió `RESET_MAX_PER_HOUR` enlaces en la última hora, no hace nada y devuelve None. Si no, devuelve el enlace
    (solo lo muestra la línea de comandos; la página nunca lo pinta)."""
    now = datetime.now(timezone.utc)
    with transaction(conn):
        user = users.by_email(conn, email)
        if user is None or not user["active"]:
            return None
        recent = one(conn, """SELECT count(*) AS n FROM token
                              WHERE account_id = ? AND purpose = 'reset' AND created_at > ?""",
                     (user["id"], now - timedelta(hours=1)))["n"]
        if recent >= security.RESET_MAX_PER_HOUR:
            return None
        raw = _issue_token(conn, user["id"], "reset", None, now=now)
        _audit(conn, user["id"], "reset_requested", user["id"], None)
    link = link_for(raw)
    if send_mail:
        _send(user, MAIL_RESET, link, minutes=security.RESET_TTL_MIN)
    return link


def peek_token(conn, raw):
    """Datos del enlace antes de usarlo (propósito y correo de la cuenta), para que la página sepa qué texto
    mostrar. Levanta `TokenInvalid` si no sirve."""
    token = _token(conn, raw)
    return {"purpose": token["purpose"], "email": token["email"], "name": token["name"], "account_id": token["account_id"]}


def redeem_token(conn, raw, password):
    """Fija la contraseña con un enlace válido, lo marca como usado y cierra todas las sesiones de la cuenta.
    Devuelve el usuario. Levanta `TokenInvalid` o `WeakPassword`."""
    now = datetime.now(timezone.utc)
    with transaction(conn):
        token = _token(conn, raw, now)
        problem = security.check_strength(password, token["email"])
        if problem:
            raise WeakPassword(problem)
        users.set_password(conn, token["account_id"], password)
        sessions.revoke_all(conn, token["account_id"], now)
        with cursor(conn) as cur:
            cur.execute("UPDATE token SET used_at = ? WHERE token_hash = ?", (now, token["token_hash"]))
        _audit(conn, token["account_id"], "set_password", token["account_id"], {"via": token["purpose"]})
        return users.by_id(conn, token["account_id"])


def deactivate(conn, actor_id, user_id):
    with transaction(conn):
        users.set_active(conn, actor_id, user_id, False)
        sessions.revoke_all(conn, user_id)
        _audit(conn, actor_id, "deactivate", user_id, None)


def activate(conn, actor_id, user_id):
    with transaction(conn):
        users.set_active(conn, actor_id, user_id, True)
        _audit(conn, actor_id, "activate", user_id, None)


def set_role(conn, actor_id, user_id, role):
    with transaction(conn):
        users.set_role(conn, actor_id, user_id, role)
        _audit(conn, actor_id, "set_role", user_id, {"role": role})


def profile(conn, user_id):
    """Perfil de la cuenta y de su organización: `id`, `email`, `name`, `role`, `avatar`, `theme`, `org` (nombre),
    `logo`, `modules` (los que ve, `orgs.modules_of`), `can_manage` y `can_download`. `avatar` y `logo` son URLs
    `data:` o None."""
    row = one(conn, """SELECT a.id, a.email, a.name, a.role, a.avatar, a.theme, o.name AS org, o.logo, o.modules
                       FROM account a JOIN organization o ON o.id = a.org_id WHERE a.id = ?""", (user_id,))
    row["modules"] = orgs.modules_of({**row, "modules": orgs.decode_modules(row["modules"])})
    return {**row, "can_manage": orgs.can_manage(row), "can_download": orgs.can_download(row)}


def update_profile(conn, user_id, name, theme, avatar):
    """Cambia nombre, tema (`THEMES`) y avatar (None lo quita). Levanta `InvalidImage`."""
    _check_image(avatar)
    with transaction(conn):
        with cursor(conn) as cur:
            cur.execute("UPDATE account SET name = ?, theme = ?, avatar = ? WHERE id = ?",
                        (name.strip(), theme, avatar, user_id))
        _audit(conn, user_id, "update_profile", user_id, {"theme": theme})


def change_email(conn, user_id, email, password):
    """Cambia el correo de entrada si la contraseña actual coincide. Levanta `WrongPassword` o `DuplicateEmail`."""
    email = security.normalize_email(email)
    with transaction(conn):
        _check_password(conn, user_id, password)
        other = users.by_email(conn, email)
        if other and other["id"] != user_id:
            raise DuplicateEmail(email)
        with cursor(conn) as cur:
            cur.execute("UPDATE account SET email = ? WHERE id = ?", (email, user_id))
        _audit(conn, user_id, "change_email", user_id, {"email": email})


def change_password(conn, user_id, current, new, ip=None, user_agent=None):
    """Cambia la contraseña, cierra todas las sesiones de la cuenta y emite una nueva. Devuelve el valor de la
    cookie. Levanta `WrongPassword` o `WeakPassword`."""
    now = datetime.now(timezone.utc)
    with transaction(conn):
        _check_password(conn, user_id, current)
        problem = security.check_strength(new, users.by_id(conn, user_id)["email"])
        if problem:
            raise WeakPassword(problem)
        users.set_password(conn, user_id, new)
        sessions.revoke_all(conn, user_id, now)
        raw = sessions.create(conn, user_id, ip=ip, user_agent=user_agent, now=now)
        _audit(conn, user_id, "set_password", user_id, {"via": "profile"})
    return raw


def set_logo(conn, actor_id, logo):
    """Fija el logo de la organización de `actor_id`, el que ven todas sus cuentas; None lo quita. Levanta
    `InvalidImage`."""
    _check_image(logo)
    with transaction(conn):
        with cursor(conn) as cur:
            cur.execute("UPDATE organization SET logo = ? WHERE id = (SELECT org_id FROM account WHERE id = ?)",
                        (logo, actor_id))
        _audit(conn, actor_id, "set_logo", None, {"removed": logo is None})


def record_interest(conn, user_id, module=None):
    """Deja en `audit` que la cuenta pidió un módulo que su organización no tiene (`upgrade_interest`), o solo hablar
    con Ventas si `module` es None, y avisa a `config.SALES_EMAIL` si está configurado. Un fallo del correo queda en
    el log del servicio y no se levanta."""
    with transaction(conn):
        user = profile(conn, user_id)
        _audit(conn, user_id, "upgrade_interest", user_id, {"module": module})
    if not config.SALES_EMAIL:
        return
    template = MAIL_INTEREST["module" if module else "sales"]
    ctx = {"name": user["name"], "email": user["email"], "org": user["org"], "module": MODULE_LABEL.get(module)}
    try:
        mail.send(config.SALES_EMAIL, template["subject"].format(**ctx), template["text"].format(**ctx))
    # Boto3 tiene su propia jerarquía; aquí solo importa que no salió.
    except Exception as e:
        print(f"aviso de interés no enviado a Ventas: {e}", flush=True)


# --- privado ---------------------------------------------------------------------------------------
# Hash de una contraseña aleatoria: contra él se verifica cuando el correo no existe, para que el tiempo de
# respuesta no delate qué cuentas hay.
_DUMMY_HASH = security.hash_password(security.new_token()[0])


def _issue_token(conn, user_id, purpose, created_by, now=None):
    """Invalida los enlaces vigentes del mismo propósito y emite uno nuevo. Devuelve el valor en claro."""
    now = now or datetime.now(timezone.utc)
    ttl = timedelta(hours=security.INVITE_TTL_HOURS) if purpose == "invite" else timedelta(minutes=security.RESET_TTL_MIN)
    raw, token_hash = security.new_token()
    with cursor(conn) as cur:
        cur.execute("""UPDATE token SET used_at = ?
                       WHERE account_id = ? AND purpose = ? AND used_at IS NULL""", (now, user_id, purpose))
        cur.execute("""INSERT INTO token (token_hash, account_id, purpose, created_at, expires_at, created_by)
                       VALUES (?, ?, ?, ?, ?, ?)""", (token_hash, user_id, purpose, now, now + ttl, created_by))
    return raw


def _token(conn, raw, now=None):
    token = one(conn, """SELECT t.token_hash, t.account_id, t.purpose, t.expires_at, t.used_at, a.email, a.name
                         FROM token t JOIN account a ON a.id = t.account_id
                         WHERE t.token_hash = ? AND a.active""", (security.hash_token(raw or ""),))
    if not security.is_usable(token, now):
        raise TokenInvalid()
    return token


def _send(user, template, link, **ttl):
    """Manda el enlace. Si el correo falla, levanta `MailFailed` con el enlace: la cuenta y el token ya existen."""
    ctx = {"name": user["name"], "link": link, **ttl}
    try:
        mail.send(user["email"], template["subject"], template["text"].format(**ctx), template["html"].format(**ctx))
    # Boto3 tiene su propia jerarquía; aquí solo importa que no salió.
    except Exception as e:
        raise MailFailed(link, e) from e


def _check_password(conn, user_id, password):
    if not security.verify_password(password, users.password_hash(conn, user_id)):
        raise WrongPassword()


def _check_image(data_url):
    """Acepta None o una URL `data:` de PNG, JPEG o WebP en base64 válido, de `IMAGE_MAX_CHARS` o menos.
    SVG no entra: puede llevar código."""
    if data_url is None:
        return
    header, _, payload = data_url.partition(",")
    if len(data_url) > IMAGE_MAX_CHARS or header not in {f"data:{t};base64" for t in _IMAGE_TYPES}:
        raise InvalidImage()
    try:
        base64.b64decode(payload, validate=True)
    except binascii.Error:
        raise InvalidImage() from None


def _audit(conn, actor_id, action, target_id, detail):
    with cursor(conn) as cur:
        cur.execute("INSERT INTO audit (at, actor_id, action, target_id, detail) VALUES (?, ?, ?, ?, ?)",
                    (datetime.now(timezone.utc), actor_id, action, target_id, json.dumps(detail) if detail is not None else None))
