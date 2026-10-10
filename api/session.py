"""Pegamento entre la API interna del dashboard (`api/internal.py`) y `auth/`: la cookie de sesión y los flujos de acceso.

Único módulo de la presentación nueva que conoce la cookie `ac_session`. La escribe el servidor con `Set-Cookie`:
HttpOnly, SameSite=Strict y Secure cuando `config.BASE_URL` es https. La sesión se valida en `app.db` en cada petición.
Los errores de `auth/` salen como `HTTPException` con el texto de `AUTH_TEXT`, nunca con el texto interno.
"""
import sqlite3
from typing import Annotated

from fastapi import Depends, HTTPException, Request

import auth
from analytics.labels import AUTH_TEXT
from auth.security import SESSION_TTL_DAYS
from scraper import config

COOKIE = "ac_session"
_PROXY = "127.0.0.1"

# Código HTTP de cada error de `auth/`. Los que no están aquí salen con 401.
_STATUS = {
    "AccountLocked": 423,
    "TokenInvalid": 400,
    "WeakPassword": 422,
    "DuplicateEmail": 409,
    "LastAdmin": 409,
    "SelfChange": 409,
}


def current_user(request: Request):
    """Dependencia: usuario de la cookie vigente (`id`, `email`, `name`, `role`, `active`) o 401."""
    raw = request.cookies.get(COOKIE)
    user = with_conn(lambda conn: auth.current_session(conn, raw)) if raw else None
    if user is None:
        raise HTTPException(401, AUTH_TEXT["InvalidCredentials"])
    return user


def require_admin(user: Annotated[dict, Depends(current_user)]):
    """Dependencia: el usuario si es admin; 403 si no."""
    if user["role"] != "admin":
        raise HTTPException(403, AUTH_TEXT["SelfChange"])
    return user


def sign_in(request, response, email, password):
    """Entra y pone la cookie en `response`. Devuelve el usuario o levanta la `HTTPException` del error."""
    try:
        raw, user = with_conn(lambda conn: auth.login(conn, email, password, ip=client_ip(request),
                                                      user_agent=request.headers.get("user-agent")))
    except auth.AuthError as e:
        raise _http_error(e) from None
    _set_cookie(response, raw, SESSION_TTL_DAYS * 86400)
    return user


def sign_out(request, response):
    """Revoca la sesión de la cookie, si hay, y borra la cookie."""
    raw = request.cookies.get(COOKIE)
    if raw:
        with_conn(lambda conn: auth.logout(conn, raw))
    _set_cookie(response, "", 0)


def request_reset(email):
    """Pide el enlace de restablecimiento. No devuelve nada: la respuesta es igual exista o no la cuenta. Un fallo
    del correo tampoco llega al visitante; queda en el log del servicio."""
    try:
        with_conn(lambda conn: auth.request_reset(conn, email))
    except auth.MailFailed as e:
        print(f"correo de restablecimiento no enviado: {e.cause}", flush=True)


def peek_token(raw):
    """Propósito (`invite` o `reset`) y correo del enlace, o la `HTTPException` de `TokenInvalid`."""
    try:
        return with_conn(lambda conn: auth.peek_token(conn, raw))
    except auth.TokenInvalid as e:
        raise _http_error(e) from None


def redeem_token(raw, password, response):
    """Fija la contraseña con el enlace. `auth` cierra todas las sesiones de la cuenta, así que también borra la cookie."""
    try:
        with_conn(lambda conn: auth.redeem_token(conn, raw, password))
    except auth.AuthError as e:
        raise _http_error(e) from None
    _set_cookie(response, "", 0)


def invite(actor_id, email, name, role):
    """Crea la cuenta y manda la invitación. Devuelve {"link", "mail_error"}: `link` se rellena en modo consola o
    cuando el correo falló; `mail_error` si el correo no salió pero la cuenta quedó."""
    return _admin_action(lambda conn: auth.invite(conn, actor_id, email, name, role)[1])


def manage(actor_id, user_id, action, role=None):
    """deactivate | activate | set_role | resend sobre una cuenta. Mismo resultado que `invite`; 404 si no existe."""
    if not with_conn(lambda conn: auth.users.by_id(conn, user_id)):
        raise HTTPException(404)
    fn = {"deactivate": lambda conn: auth.deactivate(conn, actor_id, user_id),
          "activate": lambda conn: auth.activate(conn, actor_id, user_id),
          "set_role": lambda conn: auth.set_role(conn, actor_id, user_id, role),
          "resend": lambda conn: auth.resend(conn, actor_id, user_id)}[action]
    return _admin_action(fn)


def list_users():
    """Todas las cuentas, sin el hash de la contraseña (`auth.list_users`)."""
    return with_conn(auth.list_users)


def with_conn(fn):
    """`fn(conn)` sobre `app.db`, con una conexión por operación. Si la base no abre, 503."""
    try:
        conn = auth.connect()
    except sqlite3.Error:
        raise HTTPException(503, AUTH_TEXT["db_unavailable"]) from None
    try:
        return fn(conn)
    finally:
        conn.close()


def error_text(e):
    """Mensaje para el usuario a partir de la clase del error y de su detalle en WeakPassword o AccountLocked."""
    if isinstance(e, auth.WeakPassword):
        return AUTH_TEXT.get(str(e), AUTH_TEXT["WeakPassword"])
    return AUTH_TEXT[type(e).__name__].format(minutes=getattr(e, "minutes", 0))


def client_ip(request):
    """IP real del visitante. Caddy la pone al final de X-Forwarded-For. Solo se cree esa cabecera si la conexión
    viene de Caddy en 127.0.0.1; si no, cualquiera podría inventarla."""
    peer = request.client.host if request.client else None
    forwarded = request.headers.get("x-forwarded-for")
    if peer == _PROXY and forwarded:
        return forwarded.split(",")[-1].strip() or None
    return peer


# --- privado ---------------------------------------------------------------------------------------
def _set_cookie(response, value, max_age):
    response.set_cookie(COOKIE, value, max_age=max_age, path="/", httponly=True, samesite="strict",
                        secure=config.BASE_URL.startswith("https"))


def _http_error(e):
    return HTTPException(_STATUS.get(type(e).__name__, 401), error_text(e))


def _admin_action(fn):
    out = {"link": None, "mail_error": None}
    try:
        link = with_conn(fn)
        if link and config.MAIL_BACKEND == "console":
            out["link"] = link
    except auth.MailFailed as e:
        out["link"], out["mail_error"] = e.link, str(e.cause)
    except auth.AuthError as e:
        raise _http_error(e) from None
    return out
