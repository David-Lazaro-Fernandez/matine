# Plan · Dashboard de Streamlit a Next.js con Fluent UI

Escrito el 2026-10-10. Lee primero `AGENTS.md`. Las decisiones marcadas **[DECIDIR]** son del usuario.

## 1. Alcance

Solo cambia la presentación: `app.py` + `ui/` + `views/` (Streamlit) pasan a `dashboard/` (Next.js + React +
Fluent UI v9). Por qué: los clientes son corporativos y esperan una aplicación con aspecto empresarial.

No cambia:

- `scraper/`, `analytics/`, `auth/`, `jobs/`, el esquema de `snapshots.db` y de `app.db`.
- La infraestructura: el mismo servidor, Caddy, el mismo dominio del dashboard, la rama `stable` y `make deploy`.
- La API pública (`api/main.py`) y `marketing/`.
- La estructura de las páginas: es una migración 1:1, no un rediseño. Mismas páginas, mismas tres capas, mismos textos.

## 2. Arquitectura

```
navegador ──► Caddy (dominio del dashboard)
               ├─ /api/*  ──► uvicorn api.internal:app  127.0.0.1:8501   (servicio absolut-cinema-dashboard)
               └─ resto   ──► dashboard/out/  (archivos estáticos de `next build`, output: 'export')
```

- **Next.js en exportación estática**, igual que `marketing/`. No corre Node en el servidor. Todo componente de
  Fluent es de cliente (`'use client'`); los datos se piden a `/api` desde el navegador.
- **El servicio `absolut-cinema-dashboard` conserva su nombre y su puerto 8501**; cambia el `ExecStart` de Streamlit a
  `uvicorn api.internal:app`. Caddy, `make restart` y el calendario no cambian; `deploy/update.sh` solo cambia la URL de
  salud.
- **`api/internal.py` es una app aparte de `api/main.py`.** La pública es anónima y con CORS para Vercel; la interna exige
  sesión y no debe existir en `api.matinee.com`.
- **Un endpoint por página** (un módulo por página en `api/pages/`), no uno por función de `analytics/`: `GET /api/cartelera?plaza=&d0=&d1=&franja=`
  devuelve todo lo que la página pinta. Son ~55 funciones de `analytics/` agrupadas en ~10 endpoints. El caché de
  `load()` (`ttl=TTL`) pasa a un caché en memoria por llave en el endpoint, como `_read` de `api/main.py`.
- **Tipos generados**: `openapi-typescript` sobre el esquema de FastAPI escribe `dashboard/lib/api.generated.ts`.
  Un campo que cambia en Python rompe `next build`.
- **Mismo origen**: la cookie `ac_session` queda HttpOnly, Secure y SameSite=Strict. Sin CORS.

### Sesión

`ui/session.py` pasa a `api/session.py` y sigue siendo el único módulo que conoce la cookie. Ya no hace falta el iframe
con JavaScript: FastAPI escribe la cookie con `Set-Cookie`. Endpoints: `POST /api/login`, `POST /api/logout`,
`POST /api/olvide`, `POST /api/restablecer`, `GET /api/yo` (usuario y rol, arma la navegación) y los de usuarios (solo
admin). `auth/` no cambia. La IP de auditoría sale de `X-Forwarded-For` solo si la conexión viene de 127.0.0.1.

### Textos y colores

`analytics/labels.py` sigue siendo la única fuente. `scripts/export_labels.py` escribe
`dashboard/lib/labels.generated.ts` (textos, `CHAIN_COLOR`, `RED_RAMP`, `DIVERGING`…) y `make check` falla si no
coincide, igual que con `deploy/systemd/`. El tema de Fluent se arma con `createLightTheme` usando `RED_RAMP` como rampa
de marca; Cinépolis sigue en tinta. Ningún hex ni texto de usuario se escribe en `dashboard/`. Los helpers de formato
(`date_es`, `time_12`, `n`, `pp`) se portan a `dashboard/lib/format.ts`, con prueba de paridad contra los de Python.

## 3. Equivalencias de componentes

| Streamlit | Next + Fluent v9 |
| --- | --- |
| `st.navigation` arriba; abajo en celular | `NavDrawer` en escritorio; `TabList` fija abajo en celular |
| filtros de la barra lateral | `Dropdown`, `DatePicker`, `Field` en un panel de filtros |
| `st.info` / `st.warning` / `st.error` | `MessageBar` |
| Altair (~25 gráficos: 11 en cartelera) | Vega-Lite (`vega-embed`) con el mismo spec, en `components/vega-chart.tsx` y el estilo de `lib/vega-theme.ts` |
| `st.dataframe` / `table()` | `DataGrid`; el explorador de Datos probablemente necesita la versión virtualizada de `@fluentui-contrib` |
| pydeck (mapa) y folium (recomendador, clic) | `maplibre-gl`, ya usado en `marketing/` |
| `capa`, `seccion`, `pregunta`, `leerla`, `apendice`, `leyenda`, `hallazgo` | componentes React con el mismo nombre en `dashboard/components/` |

**Gráficos en Vega-Lite, no en Fluent Charts (decisión 2026-10-10, tras la fase 0).** Altair genera specs de Vega-Lite,
así que cada gráfico se traduce casi 1:1, con sus escalas, capas y anotaciones. Fluent Charts no tiene dumbbell ni eje de
categorías en `LineChart`, y su heatmap quita el signo de las etiquetas ("+0.8" sale "0.8"). Chart.js obliga a rediseñar
cada gráfico y pinta en canvas. El resto de la UI sí es Fluent. `vega-embed` se importa dentro de un efecto porque Vega
lee `document`; el contenedor reserva la altura para que la página no salte.

## 4. Fases

Streamlit sigue en producción hasta la fase 7. Mientras tanto, la app nueva corre en local y la API interna se prueba con
pytest.

| # | Fase | Entrega | Hecho cuando |
| --- | --- | --- | --- |
| 0 | Spike | `dashboard/` con Fluent v9 + Griffel en exportación estática, tema desde `labels.py`, el heatmap día×franja y el gráfico más difícil de cartelera | Los dos gráficos se ven igual que en Altair, o se elige el respaldo; se mide RAM de `next build` en el servidor (§5) |
| 1 | Lógica a `analytics/` | Los `groupby`/`apply` de `views/cartelera.py` (líneas 85–91, 197–210, 327–335, 481) pasan a funciones de `analytics/` con prueba | `views/cartelera.py` sin pandas de negocio; Streamlit sigue igual |
| 2 | API interna y sesión | `api/internal.py`, `api/session.py`, endpoints por página, tipos generados | Pruebas con `TestClient`: sin sesión 401, rol `viewer` no ve usuarios ni operaciones, cada endpoint responde con la captura grabada |
| 3 | Cascarón | Navegación por rol, entrar / olvidé / restablecer, selector de zona y periodo | Recorrido completo de acceso en navegador real (lo que AppTest no probaba: la cookie) |
| 4 | Páginas simples | Datos, Mapa, Usuarios, Operaciones | Paridad visual página por página |
| 5 | Páginas medias | Dulcería, Independientes, Recomendador | Ídem |
| 6 | Cartelera | Tres capas, 11 gráficos, apéndice | Ídem; hallazgos idénticos a los de Streamlit con la misma base |
| 7 | Corte | `ExecStart` a uvicorn, Caddy sirve `out/`, se borran `app.py`, `ui/`, `views/`, `test_views.py`, streamlit/altair/pydeck/folium/pandas de `requirements.txt` | `make deploy` sano en el servidor; docs actualizadas (§6) |

### Paralelismo

```
Ola 1:  [0 spike frontend]   [1 lógica a analytics/]   [2a sesión + esqueleto de api/internal.py]
Ola 2:  [3 cascarón + componentes de capa]   [2b endpoint por página, uno por rama]
Ola 3:  una rama por página: Datos · Mapa · Usuarios · Operaciones · Dulcería · Independientes · Recomendador · Cartelera
Ola 4:  [7 corte]
```

- La ola 1 no comparte archivos: 0 vive en `dashboard/`, 1 en `analytics/` + `views/cartelera.py`, 2a en `api/`.
- En la ola 3, cada página es su endpoint en `api/internal.py` + su página en `dashboard/app/`. Cartelera necesita la
  fase 1 terminada.
- Puntos de choque entre ramas: `analytics/labels.py`, `analytics/__init__.py`, `api/internal.py` y los archivos
  generados. Los endpoints van en un módulo por página (`api/pages/cartelera.py`) para que `api/internal.py` solo los
  registre. Los generados se regeneran después de cada merge, no se resuelven a mano.
- Los componentes compartidos (`capa`, `seccion`, `leyenda`, `DataGrid` tematizado) se cierran en la ola 2, antes de
  abrir las ramas por página. Si no, cada página inventa el suyo.

## 5. Decisiones abiertas

- **Decidido 2026-10-10: `next build` se hace en GitHub Actions.** El workflow construye `out/` y `deploy/update.sh` lo
  descarga como artefacto. El servidor tiene 2 GB y no tiene Node. Medido en la fase 0 (Mac arm64, dos gráficos):
  ~1.6 GB de pico con 4 workers.
- **[DECIDIR] Versión de Next.** Recomendación: la misma de `marketing/` (16.x, React 19.2.0 fijo por el problema de
  `scheduler`), para no mantener dos.
- **Decidido 2026-10-10: pruebas de frontend.** Unitarias con Mocha, Sinon para los stubs de `lib/api.ts` y React
  Testing Library para los componentes; Playwright para los recorridos en navegador. Por ahora no se escriben: la ola 3
  va rápido, sin pruebas ni build por página, y el usuario reporta los errores.

## 6. Reglas de `AGENTS.md` que cambian

Hay que reescribirlas en la fase 7, no antes:

- Tabla de capas: Presentación pasa a `dashboard/` (Node, exportación estática) + `api/internal.py` (`.venv`).
- Se borra "`app.py` vive en la raíz a propósito".
- "La presentación no lleva SQL ni lógica de negocio" se mantiene: aplica a `dashboard/` y a los endpoints de
  `api/internal.py`, que solo llaman a `analytics/` y `auth/`.
- "`ui/session.py` es el único módulo que conoce la cookie" pasa a `api/session.py`.
- §6 completo (Dashboard), §8 (`test_views.py`, AppTest) y `make dashboard`.
- `ARCHITECTURE.md` (servicio del dashboard), `DESIGN.md` (tema de Fluent, equivalencias), `deploy/README.md`,
  `deploy/Caddyfile`.

## 7. Cómo cambian el horizonte los hallazgos

| Hallazgo | Efecto |
| --- | --- |
| `analytics/` ya son funciones puras que devuelven dicts | Acorta: la API interna es envolver, no reescribir |
| La cartelera tiene lógica de pandas en la vista | Alarga: fase 1 nueva, antes de portar nada |
| ~25 gráficos de Altair, algunos con anotaciones | Acorta: Vega-Lite usa el mismo spec que Altair, se traducen casi 1:1 |
| `auth/` no conoce Streamlit | Acorta: la sesión se porta sin tocar cuentas ni `app.db` |
| El servidor no tiene Node y tiene 2 GB | Trabajo nuevo: decisión de build (§5) |
| `marketing/` ya usa Next 16 y maplibre | Acorta: misma versión y mismo mapa |

Orden de tamaño, de menor a mayor: fases 0, 1 y 3 chicas; 2, 4 y 5 medianas; 6 la más grande (la mitad del trabajo de
presentación está en `views/cartelera.py`).
