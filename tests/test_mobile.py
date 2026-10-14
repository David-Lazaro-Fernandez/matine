"""El dashboard en celular, en un navegador real (Playwright): ninguna página se sale de la pantalla, la barra de
módulos no tapa el contenido y la navegación de celular muestra lo que toca a cada rol.

Sirve el build estático (`dashboard/out/`) y la API interna en el mismo puerto, como Caddy, sobre la captura grabada
de Cinemex, Cinépolis y la Cineteca, con hoy fijo en 2026-09-26. Para romper el diseño a propósito, la cuenta tiene un
correo y un nombre largos, y cada título y nombre de cine que manda la API llega alargado con una palabra sin espacios.

Necesita el build y Chromium, así que solo corre con `AC_UI=1` (`make test-ui`, que hace el build antes). Las capturas
de pantalla de cada página quedan en el directorio que imprime la falla.
"""
import os
import re
import socket
import sqlite3
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(os.environ.get("AC_UI") != "1", reason="necesita el build y Chromium; AC_UI=1")
sync_api = pytest.importorskip("playwright.sync_api")
uvicorn = pytest.importorskip("uvicorn")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from starlette.staticfiles import StaticFiles  # noqa: E402

import analytics  # noqa: E402
from analytics.labels import MODULE_LABEL, NAV_LABEL, ROLE_LABEL, UPGRADE_TEXT  # noqa: E402
from api import internal, pages  # noqa: E402
from auth import db as auth_db  # noqa: E402
from auth import flows, orgs  # noqa: E402
from scraper import config, run, store  # noqa: E402
from scripts import capture_fixtures as fixtures  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "dashboard" / "out"
PASSWORD = "contraseña-de-pruebas-123"
TODAY = "2026-09-26"
# Mediodía en CDMX: el periodo por defecto del navegador cae en la semana de la captura.
BROWSER_NOW = datetime(2026, 9, 26, 18, 0, tzinfo=timezone.utc)

# Un correo de 64 letras antes de la arroba y un nombre de cinco palabras: lo más largo que una cuenta real tendría.
ADMIN_EMAIL = "maria.fernanda.de.los.angeles.gutierrez-villasenor.inteligencia@direccion-comercial-y-programacion.cinemex.example.test"
ADMIN_NAME = "María Fernanda de los Ángeles Gutiérrez Villaseñor de la Concepción"
VIEWER_EMAIL = "viewer@example.test"
# Una cuenta de una organización que solo contrató la Cartelera.
CARTELERA_EMAIL = "cartelera@example.test"
# Una palabra sin espacios no se puede partir en renglones: es lo que más rompe un diseño angosto.
LONG_WORD = "Supercalifragilisticoexpialidoso"
STRETCHED_KEYS = {"title", "title_norm", "cinema_name", "sample_cinema", "cinema"}

PHONES = {"320": (320, 640), "360": (360, 740), "390": (390, 844)}
# Arriba de 768 px el dashboard cambia al marco de escritorio; un iPad vertical ya cae ahí.
TABLET = {"820": (820, 1180)}

VIEWER_PAGES = ["/?plaza=nacional", "/programacion/?plaza=nacional", "/preventa/?plaza=nacional",
                "/precios/?plaza=nacional", "/cines/?plaza=nacional", "/historial/?plaza=nacional", "/mapa/", "/recomendador/", "/independientes/?plaza=cdmx", "/dulceria/",
                "/dulceria/domicilio/", "/datos/", "/configuracion/"]
ADMIN_PAGES = ["/configuracion/personas/", "/operaciones/"]
PUBLIC_PAGES = ["/entrar/", "/olvide/", "/restablecer/?token=no-existe"]


def _stretch(value, key=None):
    if isinstance(value, dict):
        return {k: _stretch(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [_stretch(v, key) for v in value]
    if isinstance(value, str) and key in STRETCHED_KEYS and value:
        return f"{value} · edición especial del director remasterizada {LONG_WORD}"
    return value


def _recorded_db(path):
    with sqlite3.connect(path) as conn:
        conn.executescript(store.SCHEMA)
        for chain in ("cinemex", "cinepolis", "cineteca"):
            taken_at = fixtures.load(chain, "responses")["recorded_at"]
            snapshot = store.begin_snapshot(conn, chain, taken_at)
            assert run.commit(conn, chain, snapshot, taken_at, fixtures.replay(chain), 0, save_raw=False)


def _account(email, name, role, org_id=None):
    with auth_db.connect() as conn:
        _, link = flows.invite(conn, None, email, name, role, send_mail=False, org_id=org_id)
        flows.redeem_token(conn, link.split("token=")[1], PASSWORD)


def _free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def server(tmp_path_factory):
    """URL de un servidor con `dashboard/out/` y `/api` en el mismo origen, como Caddy en producción."""
    if not (OUT / "index.html").exists():
        pytest.skip("sin dashboard/out/; corre `make test-ui`")
    tmp = tmp_path_factory.mktemp("ui")
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(config, "LOG_DIR", tmp)
        mp.setattr(config, "APP_DB_PATH", tmp / "app.db")
        mp.setattr(config, "PRECALC_DB_PATH", tmp / "precalc.db")
        mp.setattr(config, "MAIL_BACKEND", "console")
        mp.setattr(config, "MAIL_LOG_PATH", tmp / "mail.log")
        mp.setattr(config, "DB_PATH", tmp / "snapshots.db")
        mp.setattr(analytics, "today", lambda: TODAY)
        _recorded_db(config.DB_PATH)
        # Staff ve las dos páginas de administración, también Operaciones.
        _account(ADMIN_EMAIL, ADMIN_NAME, "staff")
        _account(VIEWER_EMAIL, "Viewer", "viewer")
        with auth_db.connect() as conn:
            org = orgs.create(conn, "Solo cartelera", ["cartelera"])
        _account(CARTELERA_EMAIL, "Cartelera", "viewer", org["id"])
        pages._cache.clear()

        static = StaticFiles(directory=OUT, html=True)

        async def app(scope, receive, send):
            api = scope["type"] != "http" or scope["path"].startswith("/api")
            await (internal.app if api else static)(scope, receive, send)

        port = _free_port()
        uv = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning"))
        thread = threading.Thread(target=uv.run, daemon=True)
        thread.start()
        while not uv.started:
            time.sleep(0.05)
        yield f"http://127.0.0.1:{port}"
        uv.should_exit = True
        thread.join()


@pytest.fixture(scope="module")
def browser():
    with sync_api.sync_playwright() as p:
        try:
            chromium = p.chromium.launch()
        except sync_api.Error as e:
            pytest.skip(f"sin Chromium de Playwright (`.venv/bin/python -m playwright install chromium`): {e}")
        yield chromium
        chromium.close()


@pytest.fixture(scope="module")
def shots(tmp_path_factory):
    return tmp_path_factory.mktemp("capturas")


def _stretch_api(route):
    response = route.fetch()
    if response.status == 204 or "json" not in response.headers.get("content-type", ""):
        return route.fulfill(response=response)
    route.fulfill(status=response.status, json=_stretch(response.json()))


def _open(browser, server, size, email=None):
    width, height = size
    context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=2,
                                  is_mobile=width <= 768, has_touch=width <= 768, locale="es-MX",
                                  timezone_id="America/Mexico_City")
    # Los mosaicos del mapa y lo demás de fuera: la prueba no depende de la red.
    context.route(re.compile(r"^(?!http://127\.0\.0\.1:)"), lambda route: route.abort())
    context.route("**/api/**", _stretch_api)
    if email:
        assert context.request.post(f"{server}/api/login", data={"email": email, "password": PASSWORD}).ok
    page = context.new_page()
    page.clock.set_fixed_time(BROWSER_NOW)
    return page


def _settle(page):
    """Baja hasta el final, para que pida cada sección diferida, y espera a que la red quede quieta."""
    page.wait_for_load_state("networkidle")
    last = -1
    for _ in range(20):
        height = page.evaluate("document.documentElement.scrollHeight")
        if height == last:
            break
        last = height
        page.mouse.wheel(0, height)
        page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(150)


# Tres problemas. Un elemento visible pasa del borde de la pantalla y no está en una caja con scroll o recorte propio.
# Un texto más ancho que su caja se encima sobre lo de al lado. Un texto recortado no muestra "…".
_LAYOUT_PROBLEMS = """
() => {
  const vw = document.documentElement.clientWidth;
  const name = (el) => {
    const text = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${text ? ' "' + text + '"' : ''}`;
  };
  const visible = (el, r) => {
    if (r.width < 2 || r.height < 2) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.opacity !== '0' && st.clipPath === 'none' && st.clip === 'auto';
  };
  const clipper = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== 'visible') return p;
    }
    return null;
  };
  const overflowing = [], clipped = [], spilled = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) continue;
    if ((r.right > vw + 1 || r.left < -1) && !clipper(el)) overflowing.push(el);
    const st = getComputedStyle(el);
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!ownText || !(el instanceof HTMLElement) || st.display === 'inline' || el.scrollWidth <= el.clientWidth + 1) continue;
    if (st.overflowX === 'visible') spilled.push(`${name(el)} [${el.scrollWidth} en ${el.clientWidth}]`);
    else if (st.textOverflow !== 'ellipsis') clipped.push(`${name(el)} [${el.scrollWidth} en ${el.clientWidth}]`);
  }
  // Solo el elemento más interno de cada cadena: el padre se sale porque el hijo lo empuja.
  const overflow = overflowing.filter((a) => !overflowing.some((b) => b !== a && a.contains(b))).map((el) => {
    const r = el.getBoundingClientRect();
    return `${name(el)} [${Math.round(r.left)}–${Math.round(r.right)} de ${vw}]`;
  });
  return {scrollWidth: document.documentElement.scrollWidth, vw, overflow, clipped, spilled};
}
"""


def _layout_problems(page):
    found = page.evaluate(_LAYOUT_PROBLEMS)
    problems = []
    if found["scrollWidth"] > found["vw"]:
        problems.append(f"la página se desplaza de lado: {found['scrollWidth']} px en {found['vw']} px")
    problems += [f"se sale de la pantalla: {p}" for p in found["overflow"]]
    problems += [f"texto cortado sin …: {p}" for p in found["clipped"]]
    problems += [f"texto que se encima fuera de su caja: {p}" for p in found["spilled"]]
    return problems


def _module_bar(page):
    return page.locator("[role=tablist]").filter(has=page.get_by_role("tab", name=MODULE_LABEL["datos"]))


def _covered_by_module_bar(page):
    """Lo último de la página, ya hasta abajo, debe quedar arriba de la barra de módulos fija."""
    bar = _module_bar(page)
    if not bar.is_visible():
        return None
    page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    bar_top = bar.bounding_box()["y"]
    lowest = page.evaluate("""() => {
      const main = document.querySelector('main');
      const scrolled = (el) => {
        for (let p = el.parentElement; p && p !== main; p = p.parentElement) {
          if (getComputedStyle(p).overflowY !== 'visible') return true;
        }
        return false;
      };
      let bottom = 0, name = '';
      for (const el of main.querySelectorAll('*')) {
        const r = el.getBoundingClientRect(), st = getComputedStyle(el);
        if (r.height < 2 || st.visibility === 'hidden' || st.position === 'fixed' || scrolled(el)) continue;
        if (r.bottom > bottom) { bottom = r.bottom; name = `${el.tagName.toLowerCase()} "${(el.innerText || '').trim().slice(0, 40)}"`; }
      }
      return {bottom, name};
    }""")
    content_bottom = lowest["bottom"]
    return None if content_bottom <= bar_top + 1 else f"la barra de módulos tapa {content_bottom - bar_top:.0f} px de {lowest['name']}"


def _check(page, server, path, shots, label):
    page.goto(server + path)
    _settle(page)
    problems = _layout_problems(page)
    # Si la página ya se sale de lado, el celular la aleja y la barra de módulos ya no mide lo mismo.
    covered = not problems and _covered_by_module_bar(page)
    if covered:
        problems.append(covered)
    shot = shots / f"{label}{re.sub(r'[^a-z0-9]+', '_', path)}.png"
    page.screenshot(path=shot, full_page=True)
    assert problems == [], f"{path} en {label}, captura en {shot}:\n" + "\n".join(problems)


def _sizes(*groups):
    return [pytest.param(size, id=key) for group in groups for key, size in group.items()]


@pytest.mark.parametrize("size", _sizes(PHONES, TABLET))
@pytest.mark.parametrize("path", VIEWER_PAGES + ADMIN_PAGES)
def test_signed_in_pages_fit_the_screen(browser, server, shots, path, size):
    page = _open(browser, server, size, ADMIN_EMAIL)
    _check(page, server, path, shots, f"{size[0]}px")
    page.context.close()


@pytest.mark.parametrize("size", _sizes(PHONES))
@pytest.mark.parametrize("path", PUBLIC_PAGES)
def test_public_pages_fit_the_screen(browser, server, shots, path, size):
    page = _open(browser, server, size)
    page.goto(server + path)
    page.wait_for_load_state("networkidle")
    email = page.get_by_role("textbox").first
    if path == "/entrar/" or path == "/olvide/":
        email.fill(ADMIN_EMAIL)
    _check(page, server, path, shots, f"{size[0]}px")
    page.context.close()


@pytest.mark.parametrize("email, modules", [
    (ADMIN_EMAIL, ["cartelera", "dulceria", "datos", "admin"]),
    (VIEWER_EMAIL, ["cartelera", "dulceria", "datos"]),
], ids=["admin", "viewer"])
def test_the_phone_navigation_shows_the_modules_of_the_role(browser, server, email, modules):
    page = _open(browser, server, PHONES["360"], email)
    page.goto(server + "/")
    bar = _module_bar(page)
    sync_api.expect(bar).to_be_visible()
    tabs = bar.get_by_role("tab")
    sync_api.expect(tabs).to_have_count(len(modules))
    for m in modules:
        sync_api.expect(bar.get_by_role("tab", name=MODULE_LABEL[m], exact=True)).to_be_visible()
    for tab in tabs.all():
        box = tab.bounding_box()
        assert box["x"] >= -1 and box["x"] + box["width"] <= 360 + 1, f"{tab.inner_text()} se sale de la barra: {box}"
        assert box["height"] >= 44 and box["width"] >= 44, f"{tab.inner_text()} mide {box['width']}×{box['height']}"
    # El riel y el panel de escritorio no se ven en celular.
    sync_api.expect(page.get_by_role("button", name=MODULE_LABEL["datos"], exact=True)).to_be_hidden()
    sync_api.expect(page.get_by_role("link", name=NAV_LABEL["mapa"], exact=True)).to_be_hidden()
    # El correo y el rol de la cuenta están en el menú del avatar de la barra superior.
    page.get_by_role("banner").get_by_role("button").last.click()
    sync_api.expect(page.get_by_text(email)).to_be_visible()
    role = "staff" if email == ADMIN_EMAIL else "viewer"
    sync_api.expect(page.get_by_text(ROLE_LABEL[role], exact=True)).to_be_visible()
    page.context.close()


def test_the_phone_navigation_goes_to_each_page(browser, server):
    page = _open(browser, server, PHONES["360"], ADMIN_EMAIL)
    page.goto(server + "/")
    pages_bar = page.get_by_role("tablist").filter(has=page.get_by_role("tab", name=NAV_LABEL["mapa"]))
    for key, path in [("programacion", "/programacion/"), ("preventa", "/preventa/"), ("precios", "/precios/"),
                      ("cines", "/cines/"), ("historial", "/historial/"), ("mapa", "/mapa/"),
                      ("independientes", "/independientes/"), ("cartelera", "/")]:
        pages_bar.get_by_role("tab", name=NAV_LABEL[key]).click()
        page.wait_for_url(re.compile(re.escape(path) + r"(\?|$)"))
        tab = pages_bar.get_by_role("tab", name=NAV_LABEL[key])
        sync_api.expect(tab).to_have_attribute("aria-selected", "true")
        sync_api.expect(tab).to_be_in_viewport()
    for module, path in [("dulceria", "/dulceria/"), ("datos", "/datos/"), ("admin", "/operaciones/"),
                         ("cartelera", "/")]:
        _module_bar(page).get_by_role("tab", name=MODULE_LABEL[module]).click()
        page.wait_for_url(re.compile(re.escape(path) + r"(\?|$)"))
    # Operaciones pide su detalle al abrirse; cerrar el contexto a media petición rompe la ruta simulada.
    page.wait_for_load_state("networkidle")
    page.context.close()


def test_a_module_not_contracted_shows_a_lock_and_the_upgrade_dialog(browser, server):
    page = _open(browser, server, PHONES["360"], CARTELERA_EMAIL)
    page.goto(server + "/")
    _module_bar(page).get_by_role("tab", name=MODULE_LABEL["dulceria"]).click()
    dialog = page.get_by_role("dialog")
    sync_api.expect(dialog).to_contain_text(MODULE_LABEL["dulceria"])
    dialog.get_by_role("button", name=UPGRADE_TEXT["cta"]).click()
    sync_api.expect(dialog.get_by_text(UPGRADE_TEXT["sent"])).to_be_visible()
    assert "/dulceria" not in page.url
    page.goto(server + "/datos/")
    sync_api.expect(page.get_by_role("button", name=UPGRADE_TEXT["cta"])).to_be_visible()
    page.context.close()


def test_logout_is_reachable_on_the_phone(browser, server):
    page = _open(browser, server, PHONES["320"], VIEWER_EMAIL)
    page.goto(server + "/")
    page.get_by_role("banner").get_by_role("button").last.click()
    logout = page.get_by_role("menuitem", name=re.compile("Salir|Cerrar sesión", re.I))
    sync_api.expect(logout).to_be_in_viewport()
    logout.click()
    page.wait_for_url(re.compile(r"/entrar/"))
    page.context.close()
