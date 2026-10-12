# Handoff: cinetecas de CDMX, Guadalajara y Monterrey

Preparado el 2026-09-30 para continuar en otra sesión. Lee antes `AGENTS.md` (reglas del repo) y la sección de la
Cineteca en `project.md`.

## Objetivo

Tratar como cines independientes a tres cinetecas, con el mismo patrón que ya sigue la Cineteca Nacional:

1. **Cineteca Nacional (CDMX):** ya se captura. Falta su **precio de boletos** para que entre al recomendador
   (¿A dónde ir?).
2. **Cineteca FICG (Guadalajara):** captura nueva.
3. **Cineteca "Alejandra Rangel Hinojosa", CONARTE (Monterrey):** captura nueva.

Resultado esperado: su cartelera en `snapshots.db`, su página en el dashboard (`views/independientes.py`) y sus
funciones en el recomendador y en la API pública (plazas `cdmx`, `gdl`, `mty`), con precio cuando se conozca.

## Lo que ya existe (Cineteca Nacional)

- `scraper/cineteca.py`: cartelera de un JSON público (`obtener_cartelera.php?fecha=…`), una llamada por día, tres
  sedes en `SEDES` (`cinema_id` = código de sede de Vista), `chain="cineteca"`, una sola unidad de captura.
- `scraper/config.py`: `CINETECA_CARTELERA_URL`, `CINETECA_VISTA_BASE_URL`, `CINETECA_CONNECT_TOKEN`,
  `CINETECA_DAYS_AHEAD`.
- `jobs/registry.py`: va en el trabajo de captura de cartelera, con Cinemex y Cinépolis, y tiene su pase de planos
  (`scraper.sample --post-start --chain cineteca`).
- `analytics/independents.py` y `views/independientes.py`: página propia, fuera de los shares Cinemex↔Cinépolis.
  `OCCUPANCY_CONFIRMED = False` apaga la ocupación hasta verificar el plano de Vista.
- `analytics/recommender.py`: la Cineteca está en `MAP_CHAINS`, pero todas sus funciones salen como
  `status="unpriced"` porque no hay lectura de precio (`price_sample`).
- `docs/plan-fase2-cineteca-dashboard.md`: el plan con el que se construyó la fase 2.

Regla de `AGENTS.md` §1: un cine independiente nuevo sigue este patrón. La captura es aditiva, con `chains=` explícito, y
la presentación va aparte. Nunca entra a los shares.

## Hallazgos del 2026-09-30

Las dos URLs que aparecen en la pestaña de red **no son la cartelera**:
- `cinetecaficg.com/cdn-cgi/rum?` es la medición de rendimiento de Cloudflare (Real User Monitoring).
- `csp.secureserver.net/eventbus/web?clientid=…` es la analítica del hosting de GoDaddy.

No hay que usar ninguna de las dos.

### Guadalajara: Cineteca FICG (`cinetecaficg.com`)

- **La cartelera viene en el HTML del servidor.** No usa una API JSON.
  - `/cartelera?page=1..4`: la lista paginada. Por película trae título, sinopsis, director, país, año, duración,
    género, fecha y hora por sala ("martes, 15 de diciembre · 03:00 pm · Sala 1").
  - Filtros: `?category=82` (ciclos) y `?soon=true` (próximos estrenos).
  - `/movie/{id}`: la ficha de cada película.
- **Venta en Veezi:** los botones de compra van a
  `https://ticketing.useast.veezi.com/purchase/{sesión}?siteToken=rj5c6tj546eqfqz3qz8raafy3w`. El `{sesión}` es el id
  de la función en Veezi. Por investigar: Veezi tiene una API de sesiones por `siteToken`, que daría la cartelera
  estructurada y quizá precios y plano.
- **Precio (FAQ, `/faq`):** Cineteca FICG $60 general y $40 especial (estudiantes, docentes, adultos mayores,
  egresados UdeG), solo en taquilla con credencial. El **Cineforo** (otra sala de la UdeG, `/cineforo`) cuesta $50 y
  $35. Hay que decidir si el Cineforo entra como segunda sede.
- Faltan por verificar: la dirección y las coordenadas de cada sala, su `state_code` (Jalisco, `14`) y si hay
  funciones gratuitas ("Función gratuita", "Cinema Libre").

### Monterrey: Cineteca de CONARTE (`conarte.org.mx/cineteca/`)

- **WordPress 6.8** con un tipo de contenido `cineteca`: `GET /wp-json/wp/v2/cineteca` responde (4,201 entradas,
  `X-WP-Total`), pero `acf` llega vacío. **Las funciones no vienen en la API**, solo en el HTML.
- **Ficha de película** (`/cineteca/{slug}/`): trae año, país, director, género, duración y clasificación, y la
  sección "Próximas funciones". Cada función trae su inicio y fin en formato máquina ("2026-09-30 21:00:00",
  "2026-09-30 23:00:00", "America/Mexico_City", del widget addtocalendar) y el lugar ("Cineteca "Alejandra Rangel
  Hinojosa" - Centro de las Artes | CONARTE").
- **Lista:** `/cineteca/` enlaza las películas vigentes. Plan probable: leer la lista y luego cada ficha. La API de WP
  (`?per_page=100&orderby=modified`) puede servir para descubrir las fichas recientes sin raspar la lista.
- **Venta:** hay enlaces a `tiendaconarte.org.mx/eventos`. Por investigar: si ahí está el precio o la compra por
  función. No se encontró precio en la página de la cineteca.
- Faltan por verificar: las coordenadas del Centro de las Artes (Parque Fundidora) y su `state_code` (Nuevo León, `19`).

### CDMX: precio de la Cineteca Nacional (hecho 2026-09-30)

- Tarifa pública de `ubicacion.php` en `analytics/recommender.py` (`_CINETECA_PRICES`). La captura guarda el ciclo en
  `current_showtime.program` para la excepción del martes y el miércoles. Detalle en `project.md`.
- Esto responde la decisión 3: vale una tarifa fija con fuente y fecha. Guadalajara puede seguir el mismo patrón.
- `BUY_URL` de la Cineteca abre `visSelectTickets.aspx` de la función.

### Guadalajara (hecho 2026-09-30)

- `chain="cineteca_gdl"` con dos sedes: Cineteca FICG (`ficg`) y Cineforo (`cineforo`). Captura de la página de
  horarios de Veezi, tarifa fija del FAQ, enlace de compra a Veezi. Detalle en `project.md`.
- Pendiente: la página del dashboard (decisión 4); `views/independientes.py` solo muestra la Cineteca Nacional.

### Monterrey (hecho 2026-09-30)

- `chain="cineteca_mty"`, una sede (`centro-artes`). Captura de `conarte.org.mx/cineteca/?fecha=…`, una página por
  día. Detalle en `project.md`.
- Precio: $80 general y $50 estudiantes, maestros e INAPAM, confirmado por David (CONARTE no lo publica).

## Decisiones abiertas (pregúntale a David)

1. **Valores de `chain`.** Opciones: `cineteca_gdl` y `cineteca_mty`, o dejar `chain="cineteca"` y separar por sede.
   Afecta `analytics/labels.py` (etiquetas y colores), el vocabulario de `AGENTS.md` y cada `chains=` explícito. Con
   cadenas separadas cada fuente falla por su cuenta (`AGENTS.md` §1 y §5).
2. **Cineforo de la UdeG:** ¿entra como sede de Guadalajara?
3. **Precio fijo de un FAQ.** Si no hay precio por función, ¿vale un precio fijado a mano con fecha de verificación?
   Sería una tabla versionada, como `analytics/loop_combos.csv`. "Datos reales siempre" lo permite si se documenta la
   fuente y la fecha.
4. **Página del dashboard:** ¿una página "Independientes" con selector de cineteca, o una por ciudad?

## Plan sugerido

1. **Investigar las fuentes** (lectura, sin escribir código):
   - la API de Veezi para el `siteToken` de Guadalajara;
   - el HTML de las fichas de Monterrey y `tiendaconarte.org.mx`;
   - los tipos de boleto de Vista en CDMX.

   Documenta en `project.md` lo verificado, con fecha.
2. **Captura** (`scraper/`, solo stdlib):
   - un módulo por fuente (p. ej. `scraper/cineteca_gdl.py` y `scraper/cineteca_mty.py`) que devuelva el mismo formato
     que `scraper/cineteca.py`, con su unidad en `scraper/units.py`, el crudo en `data/raw/{chain}/`, las URLs en
     `config.py` y las excepciones de `scraper/http.py`;
   - para leer HTML usa `html.parser` de la stdlib.
3. **Geografía:** sedes con coordenadas, `scraper/cinema_states.csv` (`scripts/cinema_states.py`) y la plaza correcta en
   `scraper/plazas.py`.
4. **Calendario:** agrégalas al trabajo de captura en `jobs/registry.py` y corre `make units`. Agrega su cobertura a
   `scraper.health`.
5. **Pruebas:** graba respuestas reales (`scripts/capture_fixtures.py`, `tests/fixtures/capture/`) y extiende
   `tests/test_capture_replay.py`.
6. **Presentación:** `analytics/independents.py`, `views/independientes.py` y el recomendador (`MAP_CHAINS`, precio,
   `BUY_URL`: Veezi en Guadalajara, la ficha de CONARTE en Monterrey).
7. **Docs:** actualiza `project.md`, `ARCHITECTURE.md` (catálogo y calendario), `DESIGN.md` si hay color nuevo, y
   `marketing/design.md` si cambia la demo pública.

## Cómo verificar

```sh
/usr/bin/python3 -c "import scraper.run, analytics"      # sin dependencias externas
/usr/bin/python3 -m scraper.run                            # captura real
/usr/bin/python3 -m scraper.health                         # sale 1 si hay huecos
make check                                                 # ruff, imports con el Python del sistema y pytest
AC_DATA_DIR=$(mktemp -d) make check                        # igual que CI, con la captura grabada
make dashboard                                             # revisa Independientes y ¿A dónde ir? en gdl y mty
```

Ojo con las fechas en las pruebas: `recorded_db` (`tests/test_views.py`) mueve la cartelera grabada a mañana, y un
filtro por semana de cine (jueves a miércoles) la deja fuera los miércoles.
