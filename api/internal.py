"""API interna del dashboard: la sesión, las cuentas y un endpoint por página, todo bajo `/api`.

Es una app aparte de `api/main.py`: exige sesión y no lleva CORS, porque el frontend estático se sirve del mismo
dominio y Caddy pasa `/api/*` a esta app en 127.0.0.1:8501. La cookie la maneja solo `api/session.py`. Los endpoints
de las páginas viven en `api/pages/`, un módulo por página; aquí solo se registran, todos detrás de `current_user`.
Lee `snapshots.db` en solo lectura y escribe solo `app.db`, a través de `auth/`.

Local: `.venv/bin/uvicorn api.internal:app --port 8501`; la documentación queda en http://localhost:8501/api/docs.
"""
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, StringConstraints
from typing_extensions import TypedDict

from analytics.labels import ROLE_LABEL

from . import pages, session

Role = Literal[tuple(ROLE_LABEL)]
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
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    role: Role = "viewer"


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
def me(user: User) -> Me:
    """Usuario de la sesión y su rol, para armar la navegación."""
    return user


@api.get("/usuarios")
def list_users(_: Admin) -> list[Account]:
    """Todas las cuentas: activas primero, por nombre."""
    return session.list_users()


@api.post("/usuarios")
def invite(body: NewAccount, admin: Admin) -> AdminResult:
    """Crea la cuenta y manda la invitación."""
    return session.invite(admin["id"], body.email, body.name, body.role)


@api.post("/usuarios/{user_id}")
def manage(user_id: int, body: AccountAction, admin: Admin) -> AdminResult:
    """Desactiva, reactiva, cambia el rol o reenvía el enlace de otra cuenta. `set_role` exige `role`."""
    if body.action == "set_role" and body.role is None:
        raise HTTPException(422)
    return session.manage(admin["id"], user_id, body.action, role=body.role)


app.include_router(api)
for router in pages.routers():
    app.include_router(router, prefix="/api", dependencies=[Depends(session.current_user)])
