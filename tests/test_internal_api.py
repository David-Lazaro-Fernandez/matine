"""La API interna del dashboard (`api/internal.py`) con `TestClient`: sesión por cookie, roles, restablecimiento y la
página Datos. Las cuentas viven en un `app.db` temporal; Datos lee la captura grabada en un archivo, en solo lectura."""
import hashlib
import sqlite3

import pytest

pytest.importorskip("fastapi")
if not hasattr(hashlib, "scrypt"):
    pytest.skip("sin hashlib.scrypt", allow_module_level=True)
from fastapi.testclient import TestClient  # noqa: E402

import analytics  # noqa: E402
from analytics.labels import AUTH_TEXT  # noqa: E402
from api import internal, pages, precalc, session  # noqa: E402
from api.pages import recomendador  # noqa: E402
from auth import db, flows, orgs  # noqa: E402
from scraper import config  # noqa: E402
from scraper.plazas import PLAZAS  # noqa: E402

PASSWORD = "contraseña-de-pruebas-123"


@pytest.fixture
def conn(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "APP_DB_PATH", tmp_path / "app.db")
    monkeypatch.setattr(config, "LOG_DIR", tmp_path)
    monkeypatch.setattr(config, "MAIL_LOG_PATH", tmp_path / "mail.log")
    monkeypatch.setattr(config, "MAIL_BACKEND", "console")
    c = db.connect()
    yield c
    c.close()


def _account(conn, email, role, org_id=None):
    user, link = flows.invite(conn, None, email, role.title(), role, send_mail=False, org_id=org_id)
    flows.redeem_token(conn, link.split("token=")[1], PASSWORD)
    return user


@pytest.fixture
def admin(conn):
    return _account(conn, "admin@example.test", "admin")


@pytest.fixture
def viewer(conn):
    return _account(conn, "viewer@example.test", "viewer")


@pytest.fixture
def staff(conn):
    return _account(conn, "staff@example.test", "staff")


@pytest.fixture
def client(conn):
    return TestClient(internal.app)


def _login(client, email):
    return client.post("/api/login", json={"email": email, "password": PASSWORD})


def test_without_session_is_401(client):
    for path in ("/api/yo", "/api/usuarios", "/api/datos"):
        res = client.get(path)
        assert res.status_code == 401 and res.json()["detail"] == AUTH_TEXT["session_expired"]
    client.cookies.set(session.COOKIE, "inventada")
    assert client.get("/api/yo").status_code == 401


def test_login_sets_a_strict_http_only_cookie(client, viewer):
    res = _login(client, "VIEWER@example.test")
    assert res.status_code == 200 and res.json() == {"id": viewer["id"], "email": "viewer@example.test",
                                                     "name": "Viewer", "role": "viewer"}
    cookie = res.headers["set-cookie"]
    assert cookie.startswith(f"{session.COOKIE}=")
    for flag in ("HttpOnly", "SameSite=strict", "Path=/", "Max-Age=2592000"):
        assert flag in cookie
    assert "Secure" not in cookie
    assert client.get("/api/yo").json()["role"] == "viewer"


def test_cookie_is_secure_behind_https(client, viewer, monkeypatch):
    monkeypatch.setattr(config, "BASE_URL", "https://tablero.example.test")
    assert "Secure" in _login(client, "viewer@example.test").headers["set-cookie"]


def test_wrong_password_and_unknown_email_say_the_same(client, viewer):
    for email in ("viewer@example.test", "nadie@example.test"):
        res = client.post("/api/login", json={"email": email, "password": "mala"})
        assert res.status_code == 401 and res.json()["detail"] == AUTH_TEXT["InvalidCredentials"]
        assert "set-cookie" not in res.headers


def test_audit_ip_comes_from_forwarded_only_behind_the_proxy(conn, client, viewer):
    # TestClient conecta como "testclient": no es Caddy, así que X-Forwarded-For no cuenta.
    client.post("/api/login", json={"email": "viewer@example.test", "password": PASSWORD},
                headers={"X-Forwarded-For": "6.6.6.6"})
    assert conn.execute("SELECT ip FROM session").fetchone()["ip"] == "testclient"
    behind_caddy = TestClient(internal.app, client=("127.0.0.1", 5000))
    behind_caddy.post("/api/login", json={"email": "viewer@example.test", "password": PASSWORD},
                      headers={"X-Forwarded-For": "1.2.3.4"})
    assert conn.execute("SELECT ip FROM session ORDER BY created_at DESC").fetchone()["ip"] == "1.2.3.4"


def test_logout_revokes_the_session(client, viewer):
    _login(client, "viewer@example.test")
    raw = client.cookies.get(session.COOKIE)
    res = client.post("/api/logout")
    assert res.status_code == 204 and 'Max-Age=0' in res.headers["set-cookie"]
    client.cookies.set(session.COOKIE, raw)
    assert client.get("/api/yo").status_code == 401


def test_viewer_cannot_manage_accounts(client, viewer, admin):
    _login(client, "viewer@example.test")
    assert client.get("/api/usuarios").status_code == 403
    assert client.post("/api/usuarios", json={"email": "x@example.test", "name": "X"}).status_code == 403
    assert client.post(f"/api/usuarios/{admin['id']}", json={"action": "deactivate"}).status_code == 403


def test_admin_manages_accounts(client, admin, viewer):
    _login(client, "admin@example.test")
    listed = client.get("/api/usuarios").json()
    assert {u["email"] for u in listed} == {"admin@example.test", "viewer@example.test"}
    assert all("password_hash" not in u for u in listed)
    res = client.post("/api/usuarios", json={"email": "nueva@example.test", "name": "Nueva"})
    assert res.status_code == 200 and "token=" in res.json()["link"]
    res = client.post("/api/usuarios", json={"email": "NUEVA@example.test", "name": "Otra"})
    assert res.status_code == 409 and res.json()["detail"] == AUTH_TEXT["DuplicateEmail"]
    assert client.post(f"/api/usuarios/{viewer['id']}", json={"action": "set_role", "role": "admin"}).status_code == 200
    res = client.post(f"/api/usuarios/{admin['id']}", json={"action": "deactivate"})
    assert res.status_code == 409 and res.json()["detail"] == AUTH_TEXT["SelfChange"]
    assert client.post(f"/api/usuarios/{viewer['id']}", json={"action": "set_role"}).status_code == 422
    assert client.post("/api/usuarios/9999", json={"action": "resend"}).status_code == 404


def test_deactivated_account_loses_its_session(client, admin, viewer):
    other = TestClient(internal.app)
    _login(other, "viewer@example.test")
    _login(client, "admin@example.test")
    client.post(f"/api/usuarios/{viewer['id']}", json={"action": "deactivate"})
    assert other.get("/api/yo").status_code == 401


def test_reset_flow_with_token(client, conn, viewer):
    _login(client, "viewer@example.test")
    assert client.post("/api/olvide", json={"email": "viewer@example.test"}).status_code == 204
    assert client.post("/api/olvide", json={"email": "nadie@example.test"}).status_code == 204
    token = (config.MAIL_LOG_PATH.read_text().split("token=")[1].split()[0])
    assert client.get("/api/restablecer", params={"token": token}).json() == {"purpose": "reset",
                                                                              "email": "viewer@example.test"}
    res = client.post("/api/restablecer", json={"token": token, "password": "corta"})
    assert res.status_code == 422 and res.json()["detail"] == AUTH_TEXT["password_short"]
    assert client.post("/api/restablecer", json={"token": token, "password": "otra-contraseña-larga"}).status_code == 204
    # Cambiar la contraseña cierra todas las sesiones de la cuenta.
    assert client.get("/api/yo").status_code == 401
    res = client.get("/api/restablecer", params={"token": token})
    assert res.status_code == 400 and res.json()["detail"] == AUTH_TEXT["TokenInvalid"]
    res = client.post("/api/login", json={"email": "viewer@example.test", "password": "otra-contraseña-larga"})
    assert res.status_code == 200


def test_health_needs_no_session(client):
    assert client.get("/api/salud").json() == {"ok": True}


def _recorded(capture_db, tmp_path, monkeypatch, *chains):
    path = tmp_path / "snapshots.db"
    with sqlite3.connect(path) as disk:
        capture_db(*chains).backup(disk)
    monkeypatch.setattr(config, "DB_PATH", path)
    monkeypatch.setattr(analytics, "today", lambda: "2026-09-26")
    pages._cache.clear()


@pytest.fixture
def recorded(capture_db, tmp_path, monkeypatch):
    """`snapshots.db` en disco con la captura grabada de Cinemex y Cinépolis, con hoy fijo y la caché vacía."""
    _recorded(capture_db, tmp_path, monkeypatch, "cinemex", "cinepolis")


def test_datos_reads_the_recorded_capture(client, viewer, recorded):
    _login(client, "viewer@example.test")
    body = client.get("/api/datos").json()
    assert body["dataset"] == "cinemas" and body["rows"] and body["total"] >= len(body["rows"])
    first = client.get("/api/datos", params={"dataset": "week_showtimes", "limit": 25, "sort": "starts_at", "desc": True}).json()
    second = client.get("/api/datos", params={"dataset": "week_showtimes", "limit": 25, "offset": 25, "sort": "starts_at", "desc": True}).json()
    assert len(first["rows"]) == 25 and first["rows"][-1]["starts_at"] >= second["rows"][0]["starts_at"]
    assert client.get("/api/datos", params={"limit": 5001}).status_code == 422
    assert {d["key"] for d in body["datasets"]} >= {"cinemas", "week_showtimes"}
    body = client.get("/api/datos", params={"dataset": "week_showtimes", "chain": "cinemex"}).json()
    assert (body["d0"], body["d1"]) == analytics.cinema_week("2026-09-26")
    assert body["rows"] and {r["chain"] for r in body["rows"]} == {"cinemex"}
    assert body["cinemas"] and {c["chain"] for c in body["cinemas"]} == {"cinemex"}
    assert client.get("/api/datos", params={"dataset": "nada"}).status_code == 422


def test_independientes_reads_only_the_cineteca(client, viewer, capture_db, tmp_path, monkeypatch):
    _recorded(capture_db, tmp_path, monkeypatch, "cinemex", "cineteca")
    _login(client, "viewer@example.test")
    body = client.get("/api/independientes", params={"plaza": "cdmx"}).json()
    assert body["supported"] and (body["d0"], body["d1"]) == ("2026-09-26", "2026-09-30")
    assert body["venues"] and body["board"] and body["titles"]
    assert {r["chain"] for r in body["slots"]} <= {"cinemex", "cineteca"}
    assert all(f["topic"] == "independientes" for f in body["findings"])
    other = client.get("/api/independientes", params={"plaza": "gdl"}).json()
    assert not other["supported"] and other["venues"] == []
    assert client.get("/api/independientes", params={"d1": "2026-10-01"}).status_code == 422


def test_distribuidoras_is_staff_only_and_reads_the_recorded_capture(client, viewer, admin, staff, recorded):
    for email in ("viewer@example.test", "admin@example.test"):
        _login(client, email)
        assert client.get("/api/distribuidoras").status_code == 403
    _login(client, "staff@example.test")
    body = client.get("/api/distribuidoras", params={"d0": "2026-09-26", "d1": "2026-09-26"}).json()
    assert body["distributors"] and {r["chain"] for r in body["distributors"]} <= {"cinemex", "cinepolis"}
    assert all(r["distributor"] and r["kind"] for r in body["distributors"])
    assert body["gaps"] and "brecha" in body["conclusions"]
    assert client.get("/api/distribuidoras", params={"d0": "2026-09-27", "d1": "2026-09-26"}).status_code == 422


def test_recomendador_reads_the_recorded_capture(client, viewer, capture_db, tmp_path, monkeypatch):
    _recorded(capture_db, tmp_path, monkeypatch, "cinemex", "cinepolis")
    _login(client, "viewer@example.test")
    empty = client.get("/api/recomendador").json()
    assert empty["summary"] is None and empty["max_date"] == "2026-10-09"
    forum_tepic = {"lat": 21.493764, "lng": -104.8664, "d0": "2026-09-27"}
    body = client.get("/api/recomendador", params={**forum_tepic, "snacks": "popcorn"}).json()
    # La captura grabada no trae lecturas de precio: todas las funciones salen sin precio.
    assert body["titles"] and body["unpriced"] and body["summary"]["unpriced"]
    assert len(body["unpriced"]) <= body["limit"]
    nobody = client.get("/api/recomendador", params={**forum_tepic, "adults": 0}).json()
    assert nobody["titles"] and nobody["summary"] is None
    assert client.get("/api/recomendador", params={"lat": 21.49}).status_code == 422
    assert client.get("/api/recomendador", params={"h0": 20, "h1": 12}).status_code == 422


def test_geocodificar_calls_the_geocoder_once(client, viewer, monkeypatch):
    calls = []

    def fake(address):
        calls.append(address)
        if address == "caída":
            raise recomendador.geocode.ApiError("sin servicio")
        return {"lat": 19.43, "lng": -99.13, "label": "Zócalo"} if address == "Zócalo" else None

    monkeypatch.setattr(recomendador.geocode, "geocode", fake)
    recomendador._geocode.cache_clear()
    _login(client, "viewer@example.test")
    for _ in range(2):
        res = client.get("/api/recomendador/geocodificar", params={"q": " Zócalo "})
        assert res.json() == {"lat": 19.43, "lng": -99.13, "label": "Zócalo"}
    assert calls == ["Zócalo"]
    assert client.get("/api/recomendador/geocodificar", params={"q": "nada"}).json() is None
    assert client.get("/api/recomendador/geocodificar", params={"q": "caída"}).status_code == 502
    assert client.get("/api/recomendador/geocodificar", params={"q": "x" * 201}).status_code == 422
    assert client.get("/api/recomendador/geocodificar", params={"q": "   "}).status_code == 422


def test_mapa_reads_the_recorded_capture(client, viewer, recorded):
    _login(client, "viewer@example.test")
    body = client.get("/api/mapa").json()
    assert (body["d0"], body["d1"]) == ("2026-09-26", analytics.cinema_week("2026-09-26")[1])
    assert body["plaza"] is None and body["cinemas"] and len(body["options"]) == len(body["cinemas"])
    assert {r["chain"] for r in body["highlights"]} <= {"cinemex", "cinepolis"} and body["sites"]
    one = body["cinemas"][0]["cinema_id"]
    body = client.get("/api/mapa", params={"chains": ["cinemex", "cinepolis"], "cinema_ids": [one]}).json()
    assert [r["cinema_id"] for r in body["cinemas"]] == [one] and len(body["options"]) > 1
    assert [c for s in body["sites"] for c in s["cinema_ids"]] == [one]
    assert client.get("/api/mapa", params={"chains": "nadie"}).status_code == 422
    assert client.get("/api/mapa", params={"plaza": "nadie"}).status_code == 422


def test_dulceria_reads_the_recorded_capture(client, viewer, recorded):
    _login(client, "viewer@example.test")
    body = client.get("/api/dulceria", params={"plaza": "cdmx", "platform": "rappi"}).json()
    assert (body["plaza"], body["platform"]) == ("cdmx", "rappi")
    assert isinstance(body["conclusion"], str) and all(f["topic"] == "dulceria" for f in body["findings"])
    for key in ("basket", "sizes", "product_by_cinema", "delivery_compare"):
        assert isinstance(body[key], list)
    assert client.get("/api/dulceria", params={"product": "Caviar"}).status_code == 422


def test_operaciones_is_staff_only(client, viewer, admin, staff, recorded):
    for email in ("viewer@example.test", "admin@example.test"):
        _login(client, email)
        assert client.get("/api/operaciones").status_code == 403
    _login(client, "staff@example.test")
    body = client.get("/api/operaciones", params={"log": "health", "lines": 20}).json()
    assert set(body["report"]["chains"]) >= {"cinemex", "cinepolis"} and body["report"]["hours"] == 24
    # Corridas y unidades cuentan días desde la hora real: la captura grabada envejece.
    assert isinstance(body["runs"], list) and isinstance(body["units"], list) and body["coverage"]
    assert body["jobs"] and body["log"]["name"] == "health" and "db_bytes" in body["storage"]
    assert client.get("/api/operaciones", params={"lines": 0}).status_code == 422


def test_operaciones_without_database_still_shows_the_server(client, staff, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DB_PATH", tmp_path / "no-existe.db")
    _login(client, "staff@example.test")
    body = client.get("/api/operaciones").json()
    assert body["report"] is None and body["runs"] is None and body["jobs"] and body["log"]["lines"] == []


def test_plazas_lists_the_zones_with_cinemas(client, viewer, recorded):
    _login(client, "viewer@example.test")
    body = client.get("/api/plazas").json()
    assert body == sorted(body, key=lambda p: list(PLAZAS).index(p["plaza"]))
    assert all(p["cinemas_cinemex"] or p["cinemas_cinepolis"] for p in body)


def test_cartelera_reads_the_recorded_capture(client, viewer, recorded):
    _login(client, "viewer@example.test")
    body = client.get("/api/cartelera").json()
    assert body["plaza"] is None and body["hours"] == [0, 24] and body["full_day"]
    assert (body["d0"], body["d1"]) == ("2026-09-26", analytics.cinema_week("2026-09-26")[1])
    assert {r["chain"] for r in body["kpis"]} == {"cinemex", "cinepolis"}
    assert "findings" in client.get("/api/cartelera/hallazgos").json()
    def section(slug):
        return client.get(f"/api/cartelera/seccion/{slug}").json()

    peliculas = section("peliculas")
    assert peliculas["movie_gaps"] and set(peliculas["conclusions"]) == {"peliculas", "peliculas_note"}
    assert section("horarios")["heatmap"] and section("formatos")["mix"]
    assert [c["hours"] for c in section("resumen")["general_summary"]] == [[0, 24], [18, 24]]
    butacas = client.get("/api/cartelera/apendice/butacas").json()
    assert set(butacas["offered_by_title"]) == set(butacas["capacity_by_cinema"]) == {"cinemex", "cinepolis"}
    assert client.get("/api/cartelera", params={"h0": 18}).json()["hours"] == [18, 24]
    historia = client.get("/api/cartelera/historia", params={"chain": "cinepolis"}).json()
    assert historia["cinemas"] and historia["cinema_id"] == historia["cinemas"][0]["cinema_id"]
    assert client.get("/api/cartelera/cambios", params={"kinds": ["removed"]}).status_code == 200
    for path in ("/api/cartelera", "/api/cartelera/hallazgos", "/api/cartelera/seccion/resumen",
                 "/api/cartelera/apendice/cambios"):
        for params in ({"plaza": "nada"}, {"h0": 7}, {"h0": 18, "h1": 12}, {"d0": "2026-09-28", "d1": "2026-09-27"}):
            assert client.get(path, params=params).status_code == 422
    assert client.get("/api/cartelera/seccion/nada").status_code == 422
    assert client.get("/api/cartelera/apendice/historia").status_code == 422
    assert client.get("/api/cartelera/apendice/ocupacion").status_code == 422
    cines = client.get("/api/cartelera/cines").json()
    assert set(cines) == {"days", "min_shows", "max_km", "chains", "cinemas", "competitors", "rivals"}
    assert client.get("/api/cartelera/cines", params={"plaza": "nada"}).status_code == 422
    assert client.get("/api/cartelera/cambios", params={"kinds": ["availability"]}).status_code == 422
    assert client.get("/api/cartelera/historia", params={"chain": "cineteca"}).status_code == 422


PNG = "data:image/png;base64,iVBORw0KGgo="


def test_profile_changes_name_theme_and_avatar(client, viewer):
    _login(client, "viewer@example.test")
    me = client.get("/api/yo").json()
    assert (me["theme"], me["avatar"], me["logo"]) == ("system", None, None)
    res = client.post("/api/perfil", json={"name": "Otra", "theme": "dark", "avatar": PNG})
    assert res.status_code == 200 and (res.json()["name"], res.json()["theme"], res.json()["avatar"]) == ("Otra", "dark", PNG)
    for avatar in ("data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,no es base64"):
        res = client.post("/api/perfil", json={"name": "Otra", "theme": "dark", "avatar": avatar})
        assert res.status_code == 422 and res.json()["detail"] == AUTH_TEXT["InvalidImage"]
    assert client.post("/api/perfil", json={"name": "Otra", "theme": "rosa"}).status_code == 422
    assert client.post("/api/perfil", json={"name": "Otra", "theme": "light"}).json()["avatar"] is None


def test_email_change_needs_the_current_password(client, viewer, admin):
    _login(client, "viewer@example.test")
    res = client.post("/api/perfil/correo", json={"email": "nuevo@example.test", "password": "mala"})
    assert res.status_code == 403 and res.json()["detail"] == AUTH_TEXT["WrongPassword"]
    res = client.post("/api/perfil/correo", json={"email": "ADMIN@example.test", "password": PASSWORD})
    assert res.status_code == 409
    res = client.post("/api/perfil/correo", json={"email": "Nuevo@example.test", "password": PASSWORD})
    assert res.status_code == 200 and res.json()["email"] == "nuevo@example.test"
    assert _login(TestClient(internal.app), "nuevo@example.test").status_code == 200


def test_password_change_keeps_this_session_and_closes_the_others(client, viewer):
    other = TestClient(internal.app)
    _login(other, "viewer@example.test")
    _login(client, "viewer@example.test")
    body = {"current": PASSWORD, "new": "otra-contraseña-larga-456"}
    assert client.post("/api/perfil/contrasena", json={**body, "current": "mala"}).status_code == 403
    res = client.post("/api/perfil/contrasena", json={**body, "new": "corta"})
    assert res.status_code == 422 and res.json()["detail"] == AUTH_TEXT["password_short"]
    assert client.post("/api/perfil/contrasena", json=body).status_code == 204
    assert client.get("/api/yo").status_code == 200
    assert other.get("/api/yo").status_code == 401


def test_only_an_admin_sets_the_logo_and_everyone_sees_it(client, viewer, admin):
    _login(client, "viewer@example.test")
    assert client.post("/api/logo", json={"logo": PNG}).status_code == 403
    admin_client = TestClient(internal.app)
    _login(admin_client, "admin@example.test")
    assert admin_client.post("/api/logo", json={"logo": PNG}).json()["logo"] == PNG
    assert client.get("/api/yo").json()["logo"] == PNG
    assert admin_client.post("/api/logo", json={}).json()["logo"] is None


def test_an_old_app_db_gets_the_new_columns(tmp_path):
    path = tmp_path / "vieja.db"
    with sqlite3.connect(path) as old:
        old.execute("CREATE TABLE account (id INTEGER PRIMARY KEY, email TEXT, name TEXT, role TEXT)")
    c = db.connect(path)
    assert {"avatar", "theme"} <= {col["name"] for col in c.execute("PRAGMA table_info(account)")}
    c.close()


@pytest.fixture
def other_org(conn):
    """Una organización que solo contrató la Cartelera, con su admin y su consulta."""
    org = orgs.create(conn, "Otra", ["cartelera"])
    return {"id": org["id"], "admin": _account(conn, "admin@otra.test", "admin", org["id"]),
            "viewer": _account(conn, "viewer@otra.test", "viewer", org["id"])}


def test_profile_says_what_each_role_can_do(client, admin, viewer, staff, other_org):
    expected = {"admin@example.test": (["cartelera", "dulceria", "datos"], True, True),
                "viewer@example.test": (["cartelera", "dulceria", "datos"], False, False),
                "staff@example.test": (["cartelera", "dulceria", "datos"], True, True),
                "viewer@otra.test": (["cartelera"], False, False)}
    for email, (modules, can_manage, can_download) in expected.items():
        _login(client, email)
        me = client.get("/api/yo").json()
        assert (me["modules"], me["can_manage"], me["can_download"]) == (modules, can_manage, can_download)
    assert me["org"] == "Otra"


def test_a_module_the_org_lacks_is_403(client, conn, other_org, recorded):
    _login(client, "viewer@otra.test")
    for path in ("/api/dulceria", "/api/datos"):
        res = client.get(path)
        assert res.status_code == 403 and res.json()["detail"] == AUTH_TEXT["module_locked"]
    assert client.get("/api/plazas").status_code == 200
    assert client.get("/api/mapa").status_code == 200
    orgs.set_modules(conn, other_org["id"], [])
    assert client.get("/api/mapa").status_code == 403


def test_staff_sees_every_module_and_every_account(client, conn, staff, admin, other_org, recorded):
    orgs.set_modules(conn, other_org["id"], [])
    _login(client, "staff@example.test")
    assert client.get("/api/dulceria").status_code == 200
    assert {u["email"] for u in client.get("/api/usuarios").json()} >= {"admin@otra.test", "staff@example.test"}


def test_an_admin_only_sees_and_manages_its_org(client, conn, admin, staff, other_org):
    _login(client, "admin@otra.test")
    assert {u["email"] for u in client.get("/api/usuarios").json()} == {"admin@otra.test", "viewer@otra.test"}
    for target in (admin, staff):
        assert client.post(f"/api/usuarios/{target['id']}", json={"action": "deactivate"}).status_code == 404
    assert client.post(f"/api/usuarios/{other_org['viewer']['id']}",
                       json={"action": "set_role", "role": "analyst"}).status_code == 200
    assert client.post(f"/api/usuarios/{other_org['viewer']['id']}",
                       json={"action": "set_role", "role": "staff"}).status_code == 422
    assert client.post("/api/usuarios", json={"email": "x@example.test", "name": "X", "role": "staff"}).status_code == 422
    client.post("/api/usuarios", json={"email": "nueva@otra.test", "name": "Nueva"})
    new = db.one(conn, "SELECT role, org_id FROM account WHERE email = 'nueva@otra.test'")
    assert new == {"role": "viewer", "org_id": other_org["id"]}
    _login(client, "admin@example.test")
    assert "admin@otra.test" not in {u["email"] for u in client.get("/api/usuarios").json()}


def test_the_logo_belongs_to_the_org(client, admin, other_org):
    _login(client, "admin@otra.test")
    assert client.post("/api/logo", json={"logo": PNG}).json()["logo"] == PNG
    _login(client, "admin@example.test")
    assert client.get("/api/yo").json()["logo"] is None


def test_a_viewer_cannot_download_datos(client, viewer, admin, recorded):
    _login(client, "viewer@example.test")
    assert client.get("/api/datos", params={"limit": 100}).status_code == 200
    res = client.get("/api/datos", params={"limit": 5000})
    assert res.status_code == 403 and res.json()["detail"] == AUTH_TEXT["download_locked"]
    _login(client, "admin@example.test")
    assert client.get("/api/datos", params={"limit": 5000}).status_code == 200


def test_interest_is_audited_and_mailed_to_sales(client, conn, other_org, monkeypatch):
    monkeypatch.setattr(config, "SALES_EMAIL", "ventas@example.test")
    _login(client, "viewer@otra.test")
    assert client.post("/api/interes", json={"module": "dulceria"}).status_code == 204
    assert client.post("/api/interes", json={"module": "nada"}).status_code == 422
    assert client.post("/api/interes", json={}).status_code == 204
    rows = db.rows(conn, "SELECT actor_id, detail FROM audit WHERE action = 'upgrade_interest' ORDER BY id")
    assert rows == [{"actor_id": other_org["viewer"]["id"], "detail": '{"module": "dulceria"}'},
                    {"actor_id": other_org["viewer"]["id"], "detail": '{"module": null}'}]
    mailed = config.MAIL_LOG_PATH.read_text()
    assert "para: ventas@example.test | asunto: Otra pidió Dulcería" in mailed and "quiere hablar con Ventas" in mailed


def test_precalc_stores_the_keys_the_dashboard_asks_for_on_load(client, staff, recorded):
    _login(client, "staff@example.test")
    today = analytics.today()
    week_end = analytics.cinema_week(today)[1]
    with pages.recording() as asked:
        for url in ("/api/cartelera/cines?plaza=cdmx", "/api/cartelera/historia?plaza=cdmx", "/api/dulceria?plaza=cdmx",
                    "/api/mapa?plaza=cdmx", f"/api/independientes?plaza=cdmx&d0={today}&d1={week_end}"):
            assert client.get(url).status_code == 200, url
    with pages.recording() as stored:
        precalc.compute_extras("cdmx")
    assert set(stored) == set(asked)
