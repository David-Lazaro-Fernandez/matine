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
from api import internal, pages, session  # noqa: E402
from api.pages import recomendador  # noqa: E402
from auth import db, flows  # noqa: E402
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


def _account(conn, email, role):
    user, link = flows.invite(conn, None, email, role.title(), role, send_mail=False)
    flows.redeem_token(conn, link.split("token=")[1], PASSWORD)
    return user


@pytest.fixture
def admin(conn):
    return _account(conn, "admin@example.test", "admin")


@pytest.fixture
def viewer(conn):
    return _account(conn, "viewer@example.test", "viewer")


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
    assert body["dataset"] == "cinemas" and body["rows"] and not body["truncated"]
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
    body = client.get("/api/dulceria", params={"plaza": "cdmx", "platform": "rappi", "chain": "cinepolis"}).json()
    assert (body["plaza"], body["platform"], body["chain"]) == ("cdmx", "rappi", "cinepolis")
    assert isinstance(body["conclusion"], str) and all(f["topic"] == "dulceria" for f in body["findings"])
    for key in ("basket", "product_by_cinema", "by_cinema", "delivery_compare", "delivery_products", "delivery_stores"):
        assert isinstance(body[key], list)
    assert client.get("/api/dulceria", params={"product": "Caviar"}).status_code == 422


def test_operaciones_is_admin_only(client, viewer, admin, recorded):
    _login(client, "viewer@example.test")
    assert client.get("/api/operaciones").status_code == 403
    _login(client, "admin@example.test")
    body = client.get("/api/operaciones", params={"log": "health", "lines": 20}).json()
    assert set(body["report"]["chains"]) >= {"cinemex", "cinepolis"} and body["report"]["hours"] == 24
    # Corridas y unidades cuentan días desde la hora real: la captura grabada envejece.
    assert isinstance(body["runs"], list) and isinstance(body["units"], list) and body["coverage"]
    assert body["jobs"] and body["log"]["name"] == "health" and "db_bytes" in body["storage"]
    assert client.get("/api/operaciones", params={"lines": 0}).status_code == 422


def test_operaciones_without_database_still_shows_the_server(client, admin, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DB_PATH", tmp_path / "no-existe.db")
    _login(client, "admin@example.test")
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
    assert client.get("/api/cartelera/cambios", params={"kinds": ["availability"]}).status_code == 422
    assert client.get("/api/cartelera/historia", params={"chain": "cineteca"}).status_code == 422
