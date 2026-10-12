# AGENTS.md

Guía para agentes de código (Claude Code, Cursor, Copilot) y para cualquier persona que edite este
repo. Es la fuente de verdad de convenciones. Lo que **no** va aquí:

- `project.md` — cómo funcionan las APIs de ambas cadenas, modelo de datos, estado y decisiones.
- `ARCHITECTURE.md` — qué proceso toca qué dato, qué lo programa, catálogo de servicios.
- `DESIGN.md` — paleta, tipografía, componentes y reglas visuales del dashboard.
- `deploy/README.md` — operación del servidor.
- `make help` — comandos.

Antes de proponer un cambio, lee la sección que le toca. Si el cambio contradice algo de aquí,
dilo explícitamente en vez de hacerlo a medias.

## 1. Panorama

Inteligencia competitiva de cartelera para **Cinemex** (el cliente) frente a **Cinépolis** (el
competidor). La captura es **nacional** (desde el 2026-09-11); el dashboard compara dentro de una **plaza** (CDMX por
defecto, la del piloto) o a nivel nacional. Tres capas, sin mezclarse:

| Capa | Carpeta | Dependencias | Escribe |
| --- | --- | --- | --- |
| Captura | `scraper/` | **solo stdlib**, `/usr/bin/python3` | `data/snapshots.db`, `data/raw/`, `data/logs/` |
| Negocio | `analytics/` | **solo stdlib** | nada (abre la base en `mode=ro`) |
| Presentación | `dashboard/` (Next.js estático) + `api/internal.py` y `api/pages/` | `dashboard/`: Node/pnpm solo para el build; API: `.venv` (fastapi, uvicorn) | nada |
| Acceso | `auth/` | `.venv` (`hashlib.scrypt`; boto3 solo para SES) | `data/app.db` (cuentas, perfil, sesiones, enlaces, auditoría, logo), **nada más** |
| Programación | `jobs/` | **solo stdlib**, `/usr/bin/python3` | `data/logs/jobs.jsonl`, `data/locks/`; genera `deploy/systemd/` |
| API pública | `api/` | `.venv` (fastapi, uvicorn) | nada (lee `snapshots.db` con `analytics.connect()`, `mode=ro`) |
| Sitio público | `marketing/` | Node/Next.js, **proyecto independiente** (su propio `package.json`) | nada (sitio estático, `output: 'export'`) |

### Reglas de arquitectura (no negociables sin discutirlo)

- **El scraper no tiene dependencias externas.** Corre con el Python del sistema en un servidor
  pelado. Si necesitas algo que no está en la stdlib, la respuesta por defecto es implementarlo en
  `scraper/http.py` o replantear el cambio. Igual para `analytics/`: sin `pandas` ni nada más.
- **`analytics/` no importa FastAPI ni pandas** y no sabe que existe un dashboard. Son funciones
  puras: reciben `conn` y parámetros, devuelven listas de dicts. Están escritas así para envolverlas
  después en un API (FastAPI) sin reescribir nada.
- **La presentación no lleva SQL ni lógica de negocio.** `dashboard/` pinta lo que devuelve la API interna, y cada
  módulo de `api/pages/` (uno por página) solo llama a `analytics/` y `auth/` y devuelve sus filas tal cual. Si para una
  vista nueva hace falta un cálculo, va en `analytics/`, no en el endpoint ni en el frontend.
- **Un solo escritor** sobre `snapshots.db`. Todo lo que escribe corre en serie desde el mismo trabajo
  o en minutos distintos (`:07`). No añadas un proceso escritor sin ubicarlo en ese calendario.
- **La comparación es de dos cadenas; la captura, de las que haya.** Cinemex y Cinépolis son las comparables
  (`US`/`THEM`, shares head-to-head en `analytics/queries.py`). La **Cineteca Nacional** (`chain="cineteca"`, cine
  independiente de CDMX) se captura en el mismo esquema (`scraper/cineteca.py`, plano de Vista en `sample.py`) pero **no
  entra a los shares** (cine de autor, un precio, pocas funciones: engañaría). Lo que compara dos cadenas —
  `analytics/plaza.py`, `analytics/queries.py`, `api/pages/cartelera.py` — se queda en Cinemex↔Cinépolis: `_window`,
  `plaza_where` y `plaza_cinema_where` reciben `chains=COMPARED` (`analytics/labels.py`) por defecto, también con zona
  nacional, y lo que pide una cadena explícita (`chain="cineteca"`) pasa `chains=(chain,)`. La Cineteca tiene su propia
  vista (`dashboard/app/independientes/`, `analytics/independents.py`). Un cine independiente nuevo sigue este patrón:
  captura aditiva, `chains=` explícito, presentación aparte.
- **El calendario tiene una sola fuente: `jobs/registry.py`.** Cada trabajo programado tiene una llave en `jobs/keys.py`
  (con su área, la capa dueña) y una entrada en el registro: pasos, horario, tope, reintentos y dónde corre. De ahí se
  generan las unidades de systemd (`deploy/systemd/`, `make units`), los agentes de launchd (`make launchd-load`), las
  capturas que espera `scraper.health` y la tabla de `ARCHITECTURE.md`; `make check` falla si lo generado no coincide.
  El registro nombra el código de cada paso por módulo y lo lanza como subproceso con su intérprete (`python`, `venv`,
  `bash`): `jobs/` no importa ninguna capa salvo `scraper.config`, y cualquiera puede importar `jobs.keys` y
  `jobs.registry` para nombrar un trabajo.
- **Solo SQLite, un escritor por archivo** (decisión 2026-09-25: sin Postgres ni RDS, por costo y por los 2 GB del
  servidor; el código anterior vive en el tag `pre-sqlite-only`). `data/snapshots.db` la escribe solo la captura
  (`scraper/`); `data/app.db` la escribe solo `auth/`; `data/precalc.db` la escribe solo `api.precalc` (decisión
  2026-10-11), que guarda las respuestas por defecto de la Cartelera al final de los trabajos `snapshot` y `seats`. Esa
  es una caché que se puede borrar: sin ella, la API calcula en vivo. No agregues otro escritor a ninguna sin ubicarlo
  aquí.
- **El dashboard nunca escribe datos.** `analytics.connect()` abre `snapshots.db` en `mode=ro`, a propósito. Lo único
  que escribe desde el dashboard es `auth/`, y solo en `app.db` (cuentas y su perfil, sesiones, enlaces de acceso, auditoría, logo); las
  endpoints no lo llaman directo, pasan por `api/session.py`, el único módulo que conoce la cookie de sesión.
  `scraper/` y `analytics/` jamás importan `auth/`, y `auth/` no importa FastAPI.
- Las reglas de "qué cuenta como cambio" y "cómo se cierra una función" viven en `scraper/diff.py` (`changed_fields`,
  `closing_kind`) y `scraper/normalize.py` (`TRACKED_FIELDS`); scraper y dashboard las comparten y no se duplican. El
  crudo (`data/raw/`) es la fuente para reconstruir cualquier historia con esas mismas reglas.
- **El estado de un cine sale de `scraper/states.py`** (clave de INEGI, `state_code`, común a ambas cadenas), calculado
  por coordenadas con `scripts/cinema_states.py` y versionado en `scraper/cinema_states.csv`. No lo derives de la API:
  la "ciudad" `cdmx` de Cinépolis y el "estado 8" de Cinemex cruzan la frontera con el Estado de México.
- **Qué películas son la misma en ambas cadenas lo decide `scraper/titles.py`** (`title_key`, reglas explícitas más la
  tabla versionada `scraper/title_pairs.csv`). Toda comparación de películas entre cadenas agrupa por
  `title_key(title_norm)`, registrada en SQLite por `analytics.connect()`; no compares `title_norm` entre cadenas. Un par
  dudoso se decide con `scripts/title_pairs.py`, nunca por parecido automático.
- **La geografía tiene una sola fuente: `scraper/plazas.py`.** Qué ciudades de Cinépolis y qué áreas de Cinemex forman
  una plaza se define ahí (stdlib) y lo comparten el muestreo de planos (`config.SEATS_PLAZAS`) y el filtro de plaza de
  `analytics/` (`analytics/plaza.py`). Los planos de asientos **no se censan a nivel nacional**: solo entran las plazas
  de `AC_SEATS_PLAZAS` (decisión 2026-09-11); precios y dulcería sí van sobre todos los cines capturados. La excepción es
  el aforo por sala, que se midió una vez para todo el país a mano (`make capacity PLAZAS=all`, 2026-09-12) porque casi
  no cambia; `--plazas` solo altera esa corrida, nunca un timer. Cada función
  lleva `datetime_utc`: "ya empezó" (`from_now`, `closing_kind`) se decide con esa hora, no con la de CDMX, porque
  México tiene siete zonas horarias.
- **El dashboard es un sitio estático.** `next build` (exportación estática) corre en GitHub Actions y `dashboard/out/`
  viaja dentro de la rama `stable`; el servidor no tiene Node. Caddy sirve `out/` y pasa `/api/*` a la API interna
  (`absolut-cinema-dashboard.service`, 127.0.0.1:8501). Todo componente de Fluent es de cliente y pide sus datos a `/api`.
- **`marketing/` es un proyecto aparte** con su propio `package.json`: ninguna capa de Python lo importa y él no importa
  nada del repo. La única conexión es HTTP: la demo `/a-donde-ir/` consulta la API pública (`api/main.py`, sobre
  `analytics/recommender.py`) en `NEXT_PUBLIC_API_URL`, y nunca recibe el catálogo completo. Su identidad visual sí se hereda a mano de `DESIGN.md` y `analytics/labels.py` (ver
  `marketing/design.md`), pero eso es documentación, no código compartido.

## 2. Principios de producto

Estos mandan sobre cualquier preferencia técnica.

1. **Datos reales siempre.** Lo que no existe no se muestra con cifras. Sin placeholders, sin datos
   de ejemplo, sin "aproximadamente". Si un panel depende de historia o de una integración que no
   está, se declara como pendiente en su sección y se dice qué desbloquea.
2. **Umbral antes de afirmación.** Un hallazgo solo se muestra si cruza su umbral
   (`analytics/findings.py`). Si ninguna diferencia lo cruza, la pantalla lo dice y no inventa.
3. **Shares, no absolutos.** Toda medida comparable entre cadenas es % de la programación de cada
   cadena. Cinemex y Cinépolis tienen distinto número de cines y salas; un absoluto engaña.
   Denominador actual: funciones. Cuando haya aforo completo pasará a butacas ofertadas.
4. **Comparación justa del día en curso.** Cinépolis borra cada función al empezar y Cinemex la
   conserva unas horas. Cualquier consulta que incluya hoy usa `from_now=True` (por defecto), y el corte se hace en UTC
   (`datetime_utc`), así una función de Tijuana no se da por empezada dos horas antes.
7. **Se compara dentro del mismo alcance.** Una plaza (`plaza="cdmx"`, la del piloto y la del dashboard por defecto) o
   todo el país (`plaza=None`); nunca una cadena en una plaza contra la otra en otra.
5. **La semana de cine es jueves a miércoles.** Es lo que ambas cadenas publican completo. Usa
   `analytics.cinema_week()`, no `isocalendar()`.
6. **Hablamos como Cinemex, en primera persona.** `US`/`THEM` en `analytics/labels.py`.

## 3. Python

- Versiones: el scraper y `analytics/` deben correr en `/usr/bin/python3` (3.9+); el dashboard usa
  el venv (3.12).
- PEP 8 y el Zen de Python. Código elegante y legible antes que ingenioso.
- **Evita la herencia** (prefiere composición) y **evita las clases** salvo para excepciones. Este
  repo son funciones y módulos; que siga así.
- Nombra funciones y variables de forma que no haga falta un comentario para entenderlas.
- Archivos y carpetas en `snake_case`.
- **Importa módulos, no funciones sueltas**, cuando el módulo aporta contexto:
  `from scraper import config` → `config.DB_PATH`. Para constantes y helpers de un mismo paquete,
  el import directo está bien (`from .labels import SLOTS`).
- **Todo lo privado de un módulo lleva `_`** (`_window`, `_FORMAT_CASE`). Si no lleva `_`, es API
  del módulo y alguien puede depender de ello.
- **Argumentos**: posicionales solo los que enmarcan la función (`conn`, `d0`, `d1`). Todo lo que
  matiza va con nombre y con default que sirva para el 80% de los casos (`from_now=True`,
  `limit=60`, `chain="cinepolis"`).
- Comentarios: mayúscula inicial, gramática y puntuación correctas, en español. Un comentario
  describe **el comportamiento actual o el por qué**, nunca cómo era antes ni el historial.
  Los porqués valiosos son los de las APIs ajenas (por qué hay una pausa, por qué un lote es de 30). Frases cortas en
  Español Técnico Simplificado y nunca al final de una línea de código; el detalle está en `.claude/rules/comments.md`.
- Docstrings: para quien **usa** la función, no para quien la va a editar. Si le quieres hablar al
  siguiente que edite, usa un comentario. Todo módulo lleva docstring de nivel superior con qué
  hace y qué supuestos tiene.

### Vocabulario estándar

Los mismos nombres en todo el repo. Esto es sagrado; renombrar rompe la lectura cruzada de SQL,
`analytics/`, `api/pages/` y `dashboard/`.

| Nombre | Significado |
| --- | --- |
| `chain` | `"cinemex"` \| `"cinepolis"` \| `"cineteca"` (Cineteca Nacional, CDMX) \| `"cineteca_gdl"` (Cineteca FICG y Cineforo, Guadalajara) \| `"cineteca_mty"` (Cineteca Nuevo León, Monterrey) \| `"wtc"` (Cinemas WTC, CDMX) \| `"tonala"` (Cine Tonalá, CDMX) \| `"cinemania"` (Cinemanía, CDMX) \| `"papalote_mty"` (Megapantalla IMAX de Papalote, Monterrey) \| `"epic"` (Epic Cinemas, Monterrey) \| `"raly"` (Cinemas Raly, Monterrey) \| `"cinery"` (Cinery, Guadalajara) \| `"cabanas"` (Cine Cabañas, Guadalajara); las cinetecas y los independientes se capturan aparte y no entran al head-to-head |
| `conn` | conexión SQLite de solo lectura, siempre primer argumento en `analytics/` |
| `d0`, `d1` | rango de fechas ISO inclusivo, en hora local de la plaza |
| `from_now` | recorta el día en curso para comparar justo |
| `show_id` | función; Cinemex id nacional, Cinépolis `slug-del-cine:sessionId` |
| `cinema_id` | Cinépolis por `slug`, Cinemex por id numérico |
| `screen` | sala; la llave de aforo es `(chain, cinema_id, screen)` |
| `minutes_to_start` | ≥ 0 preventa (T−60), < 0 asistencia (post-inicio) |
| `pp` | puntos porcentuales (diferencias entre shares) |
| `plaza` | zona metropolitana comparable, clave de `scraper/plazas.py` (`cdmx`, `gdl`, `mty`); `None` = nacional |
| `city_id` | llave geográfica más fina de cada API: Cinépolis slug de ciudad (`cdmx`), Cinemex id de área (`"15"`) |
| `state_id` | estado de la API de Cinemex (`"8"`, "CDMX y Área Metropolitana"); NULL en Cinépolis |
| `state_code` | estado de INEGI del cine (`"09"` CDMX, `"15"` Estado de México), ambas cadenas; `scraper/states.py` |
| `title_key` | llave de título común a ambas cadenas (`scraper/titles.py`); las funciones de `analytics/` la devuelven como `title_norm` |
| `datetime_utc` | la hora de la función en UTC (ISO con `+00:00`); `datetime_local` sigue siendo la que publica la cadena |

### Consistencia de la API de `analytics/`

Cada función nueva se parece a las que ya existen: `fn(conn, d0=None, d1=None, from_now=True, hours=None, plaza=None)`,
devuelve lista de dicts con claves en `snake_case` en inglés, y ordena de forma determinista
(`ORDER BY` explícito siempre; sin `ORDER BY` el mismo dato puede pintar distinto entre recargas).
Exporta en `analytics/__init__.py` y añádela a `__all__`. Antes de inventar una función nueva,
mira si extender una existente con un parámetro con nombre cubre el caso.

**Toda consulta nueva se revisa con `EXPLAIN QUERY PLAN` contra la base real.** `snapshots.db` pesa más de 2 GB y
`event` pasa del millón y medio de renglones. Un `SCAN` sobre una tabla grande que el filtro debería acotar es un índice
que falta: va en `scraper/store.py` (`CREATE INDEX IF NOT EXISTS`, aditivo; `analytics/` abre en solo lectura), con un
comentario de qué consulta lo usa. Si el filtro siempre lleva la misma condición, el índice puede ser parcial
(`idx_event_closed ... WHERE kind IN ('removed', 'expired')`). Mide la consulta dos veces, en frío y en caliente; en frío
pesa la lectura del disco. Lo que no cambia entre peticiones no se recalcula en cada una: un total que no depende de la
página va en su propia llave de `read()` (`api/pages/datos.py`). Lo descubrió el explorador de Datos (2026-10-11): cada
página leía `event` completa y volvía a contar todo, 1.2 s en caliente y hasta 4.5 s en frío; con el índice parcial y el
total aparte, 0.3 s.

## 4. Textos, colores y etiquetas

- **Ningún nombre interno llega al usuario.** `chain`, `kind`, claves de franja y de cubeta se
  traducen en `analytics/labels.py`. Si un texto aparece en pantalla, sale de `labels.py` (etiquetas)
  o de `findings.py` (frases), nunca escrito en `dashboard/` ni en `api/`. `dashboard/` los lee de
  `lib/labels.generated.ts` (`make labels`).
- **Sin texto repetido ni de relleno.** No agregues una etiqueta, nota, descripción o pie que repita lo que la pantalla ya
  muestra (el valor de un filtro, el título, un total que ya está en otro lado) o que solo describa la pantalla
  ("Las tablas del archivo histórico, para…"). Cada texto da un dato o una advertencia que no está en otra parte; ante la
  duda, no se escribe. La atribución que pide una licencia (© OpenStreetMap en los mapas) sí se queda.
- **Ningún hex se escribe en la presentación (`dashboard/`).** En `dashboard/` la interfaz
  usa `tokens.*` de Fluent. Los colores viven en `analytics/labels.py` (`RED`, `INK`,
  `GRAY`, `LINE`, `CHAIN_COLOR`, `RED_RAMP`, `DIVERGING`…). Para un color nuevo: agrégalo a
  `labels.py` y documéntalo en `DESIGN.md` **antes** de usarlo.
- **Rojo = Cinemex, solo en los datos. Cinépolis = tinta (`#191A1E`).** En `dashboard/` la interfaz (botones,
  navegación, foco, enlaces) usa los tokens de Fluent con su marca azul (decisión 2026-10-10, `DESIGN.md`); el rojo no se
  usa para acciones, alertas ni valores negativos. La excepción es el tema oscuro: su marca es la rampa roja clara
  `DARK_BRAND` (decisión 2026-10-11). Cinemex siempre primero en las escalas; las series no se ciclan.
- Formato para directivos: horas en 12 h, fechas en español, números tabulares. Usa los helpers
  (`date_es`, `range_es`, `time_12`, `n`, `pp`), no `f"{x:.1f}"` a mano.

## 5. Captura (`scraper/`)

- **Todo lo configurable pasa por `scraper/config.py`** y admite sobreescritura por variable de
  entorno (`AC_DATA_DIR`, `CINEPOLIS_API_KEY`, `CINEMEX_BASE_URL`, `AC_EGRESS_PROXY`…). Nada de URLs, claves, ids de
  área o rutas escritos dentro de un módulo.
- **Excepciones**: usa las de `scraper/http.py` en vez de levantar `ValueError`/`RuntimeError`
  genéricos. `AuthError` (401, o 403 con JSON) significa casi siempre que la clave embebida rotó y hay que
  actualizar `config.py` y `project.md`; `Blocked` (403 con página HTML) que el WAF del borde rechaza la IP de
  salida y la clave está bien; `RateLimited` (429) que hay que bajar el ritmo; `ApiError` el resto. Un error nuevo con causa distinta merece su subclase, no un mensaje suelto.
- **Guarda el crudo.** Cada snapshot deja su `raw/{chain}/{fecha}/*.json.gz`. Es lo que permite
  recalcular sin volver a pedir. No añadas un flujo que descarte la respuesta original.
- **Los cambios de esquema van en `store.py`** con `CREATE TABLE IF NOT EXISTS` y son aditivos: la
  base de producción tiene historia desde el 2026-09-07 y no se recrea. Una columna nueva se agrega,
  no se renombra.
- Un fallo de una cadena no debe tumbar la corrida de la otra; el snapshot se registra con `ok=0` y
  `error`, y `scraper.health` lo reporta.
- **Dentro de una cadena, la captura va por unidades** (`scraper/units.py`): Cinemex por estado de su API, Cinépolis por
  lotes de hasta 30 cines agrupados por estado de INEGI. Una unidad que falla no tumba a las demás y **conserva el
  estado anterior de sus cines**: ni eventos ni cierres (`diff.carry_over`, `diff.failed_cinemas`). Nunca escribas una unidad a medias: si una llamada de la unidad falla, se descarta la unidad entera. Los
  errores del sistema (`AuthError`, `Blocked`, `RateLimited`) detienen la cadena. Cada unidad queda en `snapshot_unit`.
- `current_showtime` se escribe por diferencia (`store.apply_current`): altas, cambios y cierres, no la tabla entera.

### Registro (logs)

Los timers y los agentes solo ven la consola y `data/logs/`. Registra lo que un humano o un agente
necesita para diagnosticar: fallos de API, huecos de captura, respuestas degradadas, fallbacks
inesperados. **No sobre-registres**: el ruido esconde los problemas reales. Un caso raro que se
puede resolver sin que importe se maneja en silencio.

`scraper.health` es el que decide si la captura está sana y **sale con 1 si hay problemas** para que
el timer lo note. Si añades un flujo de captura, añade su cobertura ahí y su entrada en `jobs/registry.py`.

## 6. Dashboard (`dashboard/`, `api/internal.py`)

- Una página por módulo en `dashboard/app/` y un endpoint por página en `api/pages/<pagina>.py`, con un `router` de
  FastAPI, `TypedDict` de respuesta, `Literal` para las llaves y `read(key, compute)` (`api/pages/__init__.py`: abre
  `snapshots.db` en solo lectura, cierra la conexión y guarda el resultado 60 s). `api/internal.py` solo los registra.
  Páginas: Cartelera (cinco pantallas, una pregunta cada una, en `components/cartelera/cartelera-page.tsx`: Hallazgos en
  `/`, Programación semanal, Preventa, Precios y butacas, Cines (en `app/cines/`, sin periodo), Historial de funciones; zona, periodo y franja en la barra), Mapa, ¿A dónde ir?
  (recomendador), Dulcería, Independientes, Datos (explorador de `snapshots.db`, `analytics/datasets.py`) y, solo para
  admin, Usuarios y Operaciones. Un módulo que responde una pregunta propia del cliente y no depende del periodo va en
  su página; lo demás, en la cartelera. **Excepción:** Independientes sí depende del periodo y aun así va aparte, para
  que la Cineteca nunca se mezcle con los shares Cinemex↔Cinépolis.
- **Los filtros viven en la URL** (`components/filters.tsx`: `plaza`, `d0`, `d1`, `h0`, `h1`) y viajan como parámetros
  de cada endpoint. Nacional es la ausencia de `plaza`. El menú los lleva entre las pantallas de Cartelera y Dulcería
  (`components/shell.tsx`, `FILTER_KEYS`).
- **Operaciones es la excepción documentada** a "ningún nombre interno llega al usuario": su público es quien opera la
  plataforma, así que muestra nombres de tablas, logs y módulos tal cual, y usa los colores de estado `OK` y `WARN` de
  `labels.py`. Su lógica vive en `scraper/health.py`; su endpoint (`api/pages/operaciones.py`) exige admin. Nada de esa
  página escribe ni ejecuta acciones.
- **Acceso.** Sin sesión solo existen `/entrar`, `/olvide` y `/restablecer` (`lib/api.ts`, `PUBLIC_PATHS`); un 401 de la
  API manda a entrar. Lo que solo puede ver un admin lo decide la API (`session.require_admin`), no el menú.
- Una pregunta por pantalla, sin rótulos de capa (`DESIGN.md`, "Pantallas de la Cartelera"). Una sección de evidencia va
  siempre en el mismo orden: pregunta, conclusión, leyenda, gráfico, controles, "Cómo leerla". Reutiliza los componentes
  de `components/common.tsx` (`Seccion`, `Pregunta`, `Leerla`, `Apendice`, `Leyenda`, `Table`, los esqueletos y
  `Diferido`), no repliques el marcado.
- **Una página larga pide sus datos por partes** (`useApi`, `Diferido`; `DESIGN.md`, "Carga"): lo de arriba al entrar y
  cada sección cuando se acerca a la pantalla, con su propio endpoint.
- **Paneles dependientes de historia**: si un panel necesita más días de los que hay desde `FIRST_SNAPSHOT`, se muestra
  como pendiente con lo que desbloquea, no con una serie de un punto.
- El cálculo va en `analytics/`. Si te encuentras escribiendo lógica de negocio en un componente o en un endpoint, es
  señal de que falta una función en `analytics/`.

## 7. Shell y despliegue

- **Toda variable entre comillas** (`"$BACKUP_BUCKET"`, `"$(dirname "$0")"`). Una ruta o un nombre
  sin comillar se rompe con un espacio.
- `deploy/*.sh` son bash con `set -euo pipefail`: instalar o respaldar a medias es peor que fallar.
- Los pasos de un trabajo del registro corren todos aunque uno falle (`jobs.run`, igual que `make -k`): cada paso escribe
  su log y una captura que falla no debe cancelar las siguientes del mismo tick. El trabajo sí sale con error.
- **Node se maneja con `pnpm`, nunca con `npm`** (`pnpm install`, `pnpm run build`, `pnpm dlx` en vez de `npx`). El
  lockfile versionado es `pnpm-lock.yaml`; no se commitea un `package-lock.json`.
- **El registro es siempre el público, `https://registry.npmjs.org/`, nunca Shadowbox.** El servidor, Vercel y CI no
  ven el registro privado. Un lockfile que apunta a Shadowbox rompe la instalación fuera de esta máquina.
- Nada de secretos en el repo. Van en `deploy/absolut-cinema.env` (con `.example` versionado).
- **Un trabajo programado nuevo es una llave en `jobs/keys.py` y una entrada en `jobs/registry.py`**, seguido de
  `make units`. No se escriben unidades de systemd ni plists a mano: cada una ejecuta `make job KEY=llave`, así
  cualquier cosa que corre en automático se reproduce a mano igual. Los únicos servicios escritos a mano son el dashboard
  (`deploy/absolut-cinema-dashboard.service`) y la API pública (`deploy/absolut-cinema-api.service`), porque son
  permanentes, no programados.
- Los servicios de escritura diarios corren en `:07`, las capturas de cartelera en `:30` y el pase de butacas en `:50`,
  para no chocar entre sí.

## 8. Verificar un cambio

`make check` es la compuerta: `ruff` (reglas en `pyproject.toml`), la comprobación de que `scraper/`, `analytics/` y `jobs/`
compilan e importan con el Python del sistema, y `pytest`. Lo corre el hook `pre-push` (`.githooks/`, se activa una
vez por clon con `make hooks`) y el workflow de GitHub que mueve la rama `stable`; si falla en local no hay push, y si
falla en CI no hay despliegue. `ruff` no bloquea por largo de línea ni por los `;` que agrupan pasos cortos (el repo los
usa a propósito); sí por imports sin usar, nombres sin definir, orden de imports y llaves repetidas en un dict.

La verificación principal es correr el flujo de verdad contra la base. Hay además pruebas unitarias en
`tests/` (pytest, `requirements-dev.txt`, solo en el venv): lógica pura que no toca red (diff de snapshots,
parsers, cuentas sobre un `app.db` temporal, conjuntos del explorador) y los endpoints de la API interna con
`TestClient` (`tests/test_internal_api.py`: acceso y cada página, por rol, sobre la captura grabada). El frontend no tiene
pruebas unitarias; `pnpm run build` en `dashboard/` revisa los tipos y corre en CI. El dashboard en celular se prueba en
Chromium con Playwright (`tests/test_mobile.py`, `make test-ui`): cada página a 320, 360, 390 y 820 px, con títulos,
nombres de cine y correo alargados, no debe salirse de la pantalla ni encimar texto, y la barra de módulos debe mostrar
lo de cada rol. Necesita el build, así que solo corre con `AC_UI=1`: en CI va después del build.
La captura se prueba de punta a punta contra respuestas reales grabadas de ambas APIs (`tests/test_capture_replay.py`,
`tests/fixtures/capture/`, `scripts/capture_fixtures.py`): Cinemex estado 18 y Cinépolis `hermosillo` pasan por
`snapshot()`, `normalize` y `store`, y el resultado debe ser idéntico al esperado grabado y cumplir las reglas de
`capture_fixtures.problems()` (columnas siempre llenas, fecha y UTC coherentes, cines con estado). Si cambias algo que
pide o transforma el dato (`cinemex.py`, `cinepolis.py`, `normalize.py`, `store.py`, `units.py`) y la prueba falla, no la
ajustes: lee la diferencia que imprime; si el cambio era a propósito, regenera el esperado con `make fixtures EXPECTED=1`
y di en el commit qué dato cambió. `make fixtures` vuelve a grabar de las APIs (cuando cambie su forma) y
`make test-live` aplica las mismas reglas a una captura en vivo; ninguna de las dos corre en CI (red, y el WAF de
Cinépolis bloquea IPs de nube).

Corre `.venv/bin/python -m pytest -q tests/` si tocas `scraper/diff.py`,
un endpoint o añades lógica pura; añade una prueba cuando el caso quepa en memoria y, si es un endpoint, en `test_internal_api.py`. Antes de dar por bueno un cambio:

```sh
make help                                  # los targets son lo que corren los timers
/usr/bin/python3 -m scraper.run            # snapshot completo de ambas cadenas (~5 min)
/usr/bin/python3 -m scraper.health         # sale 1 si hay huecos o fallos
make dashboard                             # API interna en :8501; el frontend con `pnpm dev` en dashboard/
sqlite3 data/snapshots.db "SELECT * FROM snapshot ORDER BY id DESC LIMIT 4;"
```

- **Ejecuta el módulo que tocaste**, no solo el que te queda a mano. Un cambio en `normalize.py` o
  `store.py` se verifica con un `scraper.run` real; uno en `analytics/` levantando el dashboard (`make dashboard` y
  `pnpm dev`) y mirando el panel; uno en `sample.py` con el flag correspondiente y `--limit` bajo.
- **Verifica con el scraper del sistema, no con el venv**, para que un import accidental de una
  dependencia externa falle aquí y no en el servidor:
  `/usr/bin/python3 -c "import analytics, scraper.run, scraper.sample"`.
- Ningún flujo abre órdenes de checkout: desde el 2026-09-25 el plano de Cinemex se lee del `GET sessions/{id}`
  público. Si alguna vez hiciera falta un `POST` del checkout (`buy/*`), va **a mano y con tope**, nunca en un
  automatismo, y se pide antes.
- Si añades una función a `analytics/`, imprímela una vez con datos reales antes de conectarla al
  dashboard; es más rápido que depurar en el navegador.
- Acceso: `data/app.db` se crea sola al primer uso; `make user-create EMAIL=… NAME=… ROLE=admin` imprime el enlace de invitación (con `AC_MAIL_BACKEND=console` también
  queda en `data/logs/mail.log`). Los endpoints se prueban sin navegador con el `TestClient` de FastAPI; lo que solo un
  navegador prueba es la cookie (entrar, refrescar, salir).

## 9. Al terminar

- **Revisa cada comentario que agregaste o tocaste.** Preferimos código que se explica solo, con buenos nombres, a
  comentarios que repiten lo que ya se lee en el código. Un comentario no explica de más y va en ASD-STE100 (inglés) o
  en Español Técnico Simplificado. **Nunca escribas un comentario a la derecha de una línea de código.** Detalle en
  `.claude/rules/comments.md`.
- **Pasa el linter sobre todo lo que agregaste o cambiaste**: `make lint` (ruff) para Python y `pnpm run build` (que
  revisa los tipos) para `dashboard/` y `marketing/`.
- Sigue los patrones de los archivos vecinos antes que cualquier preferencia general.
- Actualiza la documentación que el cambio invalide, en el archivo que le toca: `project.md`
  (APIs, modelo de datos, decisiones), `ARCHITECTURE.md` (flujo, servicios, cadencias), `DESIGN.md`
  (color, tipografía, componentes), `deploy/README.md` (operación), `README.md` (entrada).
- Un servicio nuevo entra en el catálogo de `ARCHITECTURE.md` y un target nuevo en `make help`; si es programado, entra en
  `jobs/registry.py` y la tabla de `ARCHITECTURE.md` se regenera con `make units`.
- Documenta con fecha lo que se verificó contra la API ajena (`verificado 2026-09-08`); estas APIs
  no tienen contrato y lo que hoy responde puede cambiar.
- `data/` está fuera de git. No versiones la base, el crudo ni los logs.
- La descripción de un PR sigue `.claude/rules/pull-requests.md`: Summary (Problem, Solution y pocos puntos) y Test Plan,
  en ASD-STE100.
- La rama principal es `main`. No hagas commit ni push salvo que se te pida. La rama `stable` la mueve GitHub Actions
  (`.github/workflows/tests.yml`) cuando las pruebas pasan en `main`, y es lo que el servidor despliega
  (`make deploy`, cada 15 min): no la muevas a mano. Si un commit rompe las pruebas, `stable` se queda atrás hasta que se
  arregle; por eso una prueba que falla en CI bloquea el despliegue de todo lo posterior.
