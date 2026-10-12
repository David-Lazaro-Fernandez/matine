"""Ciclo de una cuenta sobre la base SQLite de `auth/` (un `app.db` temporal): invitar, fijar contraseña, entrar,
bloquear tras fallos, restablecer, desactivar, cerrar sesión y podar."""
import hashlib
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# El Python del sistema de macOS no lo trae; auth/ corre en el venv.
if not hasattr(hashlib, "scrypt"):
    pytest.skip("sin hashlib.scrypt", allow_module_level=True)
from auth import db, errors, flows, orgs, security, sessions, users  # noqa: E402

PASSWORD = "una-contraseña-larga-123"


@pytest.fixture
def conn(tmp_path):
    c = db.connect(tmp_path / "app.db")
    yield c
    c.close()


def _admin(conn):
    user, link = flows.invite(conn, None, "Admin@Test.mx", "Admin", "admin", send_mail=False)
    flows.redeem_token(conn, link.split("token=")[1], PASSWORD)
    return user


def test_invite_redeem_and_login(conn):
    user = _admin(conn)
    assert user["email"] == "admin@test.mx" and user["role"] == "admin"
    cookie, logged = flows.login(conn, "ADMIN@test.mx", PASSWORD, ip="1.2.3.4")
    assert logged["id"] == user["id"]
    assert sessions.current_session(conn, cookie)["email"] == "admin@test.mx"
    # Las fechas vuelven como datetime.
    assert isinstance(users.by_id(conn, user["id"])["last_login_at"], datetime)


def test_a_used_invite_cannot_be_redeemed_twice(conn):
    _, link = flows.invite(conn, None, "v@test.mx", "V", send_mail=False)
    raw = link.split("token=")[1]
    flows.redeem_token(conn, raw, PASSWORD)
    with pytest.raises(errors.TokenInvalid):
        flows.redeem_token(conn, raw, PASSWORD)


def test_lockout_after_max_fails(conn):
    _admin(conn)
    for _ in range(security.MAX_FAILS):
        with pytest.raises((errors.InvalidCredentials, errors.AccountLocked)):
            flows.login(conn, "admin@test.mx", "mala")
    with pytest.raises(errors.AccountLocked):
        # Ni con la buena.
        flows.login(conn, "admin@test.mx", PASSWORD)


def test_duplicate_email_and_last_admin(conn):
    admin = _admin(conn)
    with pytest.raises(errors.DuplicateEmail):
        users.create(conn, "ADMIN@test.mx", "Otra")
    viewer, _ = flows.invite(conn, admin["id"], "v@test.mx", "V", send_mail=False)
    with pytest.raises(errors.SelfChange):
        flows.set_role(conn, admin["id"], admin["id"], "viewer")
    flows.set_role(conn, admin["id"], viewer["id"], "admin")
    assert users.by_id(conn, viewer["id"])["role"] == "admin"


def test_deactivate_revokes_sessions_and_logout(conn):
    admin = _admin(conn)
    viewer, link = flows.invite(conn, admin["id"], "v@test.mx", "V", send_mail=False)
    flows.redeem_token(conn, link.split("token=")[1], PASSWORD)
    cookie, _ = flows.login(conn, "v@test.mx", PASSWORD)
    flows.deactivate(conn, admin["id"], viewer["id"])
    assert sessions.current_session(conn, cookie) is None
    with pytest.raises(errors.AccountInactive):
        flows.login(conn, "v@test.mx", PASSWORD)
    own, _ = flows.login(conn, "admin@test.mx", PASSWORD)
    flows.logout(conn, own)
    assert sessions.current_session(conn, own) is None


def test_prune_removes_only_old_closed_sessions(conn):
    admin = _admin(conn)
    old = datetime.now(timezone.utc) - timedelta(days=200)
    # Caducó hace más de 90 días.
    sessions.create(conn, admin["id"], now=old)
    # Vigente.
    sessions.create(conn, admin["id"])
    n_sessions, _ = sessions.prune(conn)
    assert n_sessions == 1
    assert db.one(conn, "SELECT count(*) AS n FROM session")["n"] == 1


def test_list_users_flags(conn):
    admin = _admin(conn)
    flows.invite(conn, admin["id"], "v@test.mx", "V", send_mail=False)
    out = {u["email"]: u for u in users.list_users(conn)}
    assert out["admin@test.mx"]["has_password"] is True and out["admin@test.mx"]["pending_invite"] is False
    assert out["v@test.mx"]["has_password"] is False and out["v@test.mx"]["pending_invite"] is True


def test_the_pilot_org_has_every_module_and_new_orgs_only_theirs(conn):
    assert orgs.list_orgs(conn) == [{"id": db.DEFAULT_ORG_ID, "name": "Cinemex", "modules": list(db.MODULES)}]
    org = orgs.create(conn, "Otra", ["datos", "cartelera"])
    assert org["modules"] == ["cartelera", "datos"]
    with pytest.raises(ValueError):
        orgs.set_modules(conn, org["id"], ["caviar"])
    user, _ = flows.invite(conn, None, "o@test.mx", "O", "analyst", send_mail=False, org_id=org["id"])
    assert flows.profile(conn, user["id"])["modules"] == ["cartelera", "datos"]
    staff, _ = flows.invite(conn, None, "s@test.mx", "S", "staff", send_mail=False, org_id=org["id"])
    assert flows.profile(conn, staff["id"])["modules"] == list(db.MODULES)


def test_an_invite_joins_the_org_of_who_invites(conn):
    org = orgs.create(conn, "Otra", ["cartelera"])
    boss, _ = flows.invite(conn, None, "jefe@test.mx", "Jefe", "admin", send_mail=False, org_id=org["id"])
    user, _ = flows.invite(conn, boss["id"], "v@test.mx", "V", send_mail=False)
    assert user["org_id"] == org["id"]


def test_last_admin_counts_per_org(conn):
    admin = _admin(conn)
    org = orgs.create(conn, "Otra", ["cartelera"])
    other, _ = flows.invite(conn, None, "otro@test.mx", "Otro", "admin", send_mail=False, org_id=org["id"])
    # Dos admins en total, pero cada uno es el último de su organización.
    with pytest.raises(errors.LastAdmin):
        flows.deactivate(conn, admin["id"], other["id"])
    with pytest.raises(errors.LastAdmin):
        flows.set_role(conn, None, admin["id"], "viewer")
    flows.set_role(conn, None, admin["id"], "staff")


def test_an_app_db_with_the_old_roles_keeps_its_rows(tmp_path):
    path = tmp_path / "vieja.db"
    old = sqlite3.connect(path)
    old.executescript(db.SCHEMA.replace("'staff', 'admin', 'analyst', 'viewer'", "'admin', 'viewer'"))
    old.execute("INSERT INTO account (email, name, role, created_at) VALUES ('a@test.mx', 'A', 'admin', '2026-09-10')")
    old.execute("INSERT INTO session VALUES ('h', 1, '2026-09-10', '2026-09-10', '2099-01-01', NULL, NULL, NULL)")
    old.execute("INSERT INTO setting VALUES ('logo', 'data:image/png;base64,AA==', '2026-09-10', 1)")
    old.commit()
    old.close()
    for _ in range(2):
        c = db.connect(path)
        assert db.one(c, "SELECT role, org_id FROM account") == {"role": "admin", "org_id": db.DEFAULT_ORG_ID}
        assert db.one(c, "SELECT logo FROM organization")["logo"] == "data:image/png;base64,AA=="
        assert db.one(c, "SELECT count(*) AS n FROM session")["n"] == 1
        assert c.execute("PRAGMA foreign_key_check").fetchall() == []
        c.close()
    # El CHECK nuevo ya acepta los roles nuevos.
    c = db.connect(path)
    c.execute("UPDATE account SET role = 'analyst'")
    c.close()
