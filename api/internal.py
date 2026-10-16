"""API interna del dashboard: la sesión, las cuentas y un endpoint por página, todo bajo `/api`.

Es una app aparte de `api/main.py`: exige sesión y no lleva CORS, porque el frontend estático se sirve del mismo
dominio y Caddy pasa `/api/*` a esta app en 127.0.0.1:8501. La cookie la maneja solo `api/session.py`. Los endpoints
de las páginas viven en `api/pages/`, un módulo por página; aquí solo se registran, todos detrás de `current_user`.
Lee `snapshots.db` en solo lectura y escribe solo `app.db`, a través de `auth/`.

Local: `make dashboard` (puerto 8500 en main); la documentación queda en http://localhost:8500/api/docs.
"""
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, StringConstraints
from typing_extensions import TypedDict

import auth

from . import pages, session

# Lo que un admin asigna. `staff` solo se da por la línea de comandos (`auth.cli role`).
Role = Literal[auth.CLIENT_ROLES]
Module = Literal[auth.MODULES]
Theme = Literal[auth.THEMES]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Image = Annotated[str, StringConstraints(max_length=auth.IMAGE_MAX_CHARS)]
Email = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=320)]
Password = Annotated[str, StringConstraints(min_length=1, max_length=1024)]
Token = Annotated[str, StringConstraints(min_length=1, max_length=200)]
User = Annotated[dict, Depends(session.current_user)]
Admin = Annotated[dict, Depends(session.require_admin)]


class Me(TypedDict):
    id: int
    email: str
    name: str
    role: str


class Profile(Me):
    avatar: str | None
    theme: Theme
    org: str
    logo: str | None
    modules: list[Module]
    can_manage: bool
    can_download: bool


class Account(TypedDict):
    id: int
    email: str
    name: str
    role: str
    active: bool
    has_password: bool
    pending_invite: bool
    created_at: datetime
    last_login_at: datetime | None


class Workspace(TypedDict):
    name: str
    seats: int | None
    members: int
    next_billing_at: datetime | None


class Integrations(TypedDict):
    slack_connected: bool
    digest_recipients: list[str]


class TokenInfo(TypedDict):
    purpose: Literal["invite", "reset"]
    email: str


class AdminResult(TypedDict):
    link: str | None
    mail_error: str | None


class Health(TypedDict):
    ok: bool


class Login(BaseModel):
    email: Email
    password: Password


class Forgot(BaseModel):
    email: Email


class Reset(BaseModel):
    token: Token
    password: Password


class NewAccount(BaseModel):
    email: Email
    name: Name
    role: Role = "viewer"


class ProfileChange(BaseModel):
    name: Name
    theme: Theme
    avatar: Image | None = None


class EmailChange(BaseModel):
    email: Email
    password: Password


class PasswordChange(BaseModel):
    current: Password
    new: Password


class LogoChange(BaseModel):
    logo: Image | None = None


class Interest(BaseModel):
    module: Module | None = None


class IntegrationsChange(BaseModel):
    slack_webhook: str | None = None
    digest_recipients: list[Email] | None = None


class AccountAction(BaseModel):
    action: Literal["deactivate", "activate", "set_role", "resend"]
    role: Role | None = None


app = FastAPI(title="Absolut Cinema · API interna", version="1", docs_url="/api/docs", redoc_url=None,
              openapi_url="/api/openapi.json")
app.add_middleware(GZipMiddleware, minimum_size=1000)
api = APIRouter(prefix="/api")


@api.get("/salud")
def health() -> Health:
    """200 si el servicio responde y `app.db` abre; 503 si no. Sin sesión: la usa `deploy/update.sh`."""
    session.with_conn(lambda conn: conn.execute("SELECT 1"))
    return {"ok": True}


@api.post("/login")
def login(body: Login, request: Request, response: Response) -> Me:
    """Entra y pone la cookie de sesión."""
    return session.sign_in(request, response, body.email, body.password)


@api.post("/logout", status_code=204)
def logout(request: Request, response: Response):
    """Cierra la sesión de la cookie, si hay, y la borra."""
    session.sign_out(request, response)


@api.post("/olvide", status_code=204)
def forgot(body: Forgot):
    """Manda el enlace de restablecimiento. Responde igual exista o no la cuenta."""
    session.request_reset(body.email)


@api.get("/restablecer")
def peek_token(token: Annotated[str, Query(min_length=1, max_length=200)]) -> TokenInfo:
    """Propósito y correo del enlace, para elegir el texto de la página. 400 si el enlace no sirve."""
    return session.peek_token(token)


@api.post("/restablecer", status_code=204)
def redeem_token(body: Reset, response: Response):
    """Fija la contraseña con el enlace y cierra todas las sesiones de la cuenta."""
    session.redeem_token(body.token, body.password, response)


@api.get("/yo")
def me(user: User) -> Profile:
    """Usuario de la sesión con su rol, avatar y tema, y su organización: nombre, logo y módulos que ve, para armar la
    navegación. `can_manage` y `can_download` dicen qué botones mostrar; la API los vuelve a revisar."""
    return session.profile(user["id"])


@api.post("/perfil")
def update_profile(body: ProfileChange, user: User) -> Profile:
    """Cambia nombre, tema y avatar de la propia cuenta. Sin `avatar`, lo quita."""
    return session.update_profile(user["id"], body.name, body.theme, body.avatar)


@api.post("/perfil/correo")
def change_email(body: EmailChange, user: User) -> Profile:
    """Cambia el correo de entrada. Pide la contraseña actual: 403 si no coincide."""
    return session.change_email(user["id"], body.email, body.password)


@api.post("/perfil/contrasena", status_code=204)
def change_password(body: PasswordChange, user: User, request: Request, response: Response):
    """Cambia la contraseña, cierra las demás sesiones y renueva la cookie de esta."""
    session.change_password(request, response, user["id"], body.current, body.new)


@api.post("/logo")
def set_logo(body: LogoChange, admin: Admin) -> Profile:
    """Fija el logo que ven todas las cuentas de la organización. Sin `logo`, lo quita."""
    return session.set_logo(admin["id"], body.logo)


@api.post("/interes", status_code=204)
def interest(body: Interest, user: User):
    """Avisa a Ventas que la cuenta quiere un módulo que su organización no tiene, o solo hablar con Ventas."""
    session.record_interest(user["id"], body.module)


@api.get("/espacio")
def workspace(admin: Admin) -> Workspace:
    """Nombre, asientos pagados, miembros y próximo cobro de la organización del admin."""
    return session.workspace(admin)


@api.get("/integraciones")
def integrations(admin: Admin) -> Integrations:
    """Si la organización tiene Slack conectado y a quién llega el resumen por correo. El webhook no sale de la API."""
    return session.integrations(admin)


@api.post("/integraciones")
def set_integrations(body: IntegrationsChange, admin: Admin) -> Integrations:
    """Cambia los ajustes que vienen en el cuerpo; una cadena vacía o una lista vacía quita el ajuste."""
    return session.set_integrations(admin, body.model_dump(exclude_unset=True))


@api.get("/usuarios")
def list_users(admin: Admin) -> list[Account]:
    """Las cuentas de la organización (todas para staff): activas primero, por nombre."""
    return session.list_users(admin)


@api.post("/usuarios")
def invite(body: NewAccount, admin: Admin) -> AdminResult:
    """Crea la cuenta en la organización del admin y manda la invitación."""
    return session.invite(admin, body.email, body.name, body.role)


@api.post("/usuarios/{user_id}")
def manage(user_id: int, body: AccountAction, admin: Admin) -> AdminResult:
    """Desactiva, reactiva, cambia el rol o reenvía el enlace de otra cuenta. `set_role` exige `role`."""
    if body.action == "set_role" and body.role is None:
        raise HTTPException(422)
    return session.manage(admin, user_id, body.action, role=body.role)


app.include_router(api)
for router in pages.routers():
    app.include_router(router, prefix="/api", dependencies=[Depends(session.current_user)])
