# Guía de Diseño

Referencia visual para todo lo que se presente al cliente (Cinemex): el dashboard de `dashboard/` (Next.js + Fluent UI
v9), sus gráficas de Vega-Lite, reportes y capturas. Desde el 2026-10-10 el dashboard tiene aspecto de aplicación
empresarial: **la interfaz es Fluent tal cual** (marca azul, neutros, Segoe) y **el color de las cadenas vive solo en los
datos**. Cinemex va en rojo y Cinépolis en tinta, en gráficas, tablas y hallazgos; nunca en botones ni en la navegación.
La estructura de cada página sigue siendo la jerarquía en tres capas del mockup del 2026-09-08.

Streamlit (`app.py`, `ui/`, `views/`) conserva su aspecto editorial anterior hasta el corte de la migración; esta guía
describe el de `dashboard/`.

## Paleta de colores

Hay dos familias que no se mezclan:

1. **Interfaz: los tokens de Fluent** (`webLightTheme`, `lib/theme.ts`). Fondos, bordes, texto, botones, foco,
   selección y enlaces usan `tokens.*` de `@fluentui/react-components`, nunca un hex. La marca es el azul de Fluent
   (`colorBrandBackground`, `#0F6CBD`).
2. **Datos: las constantes de `analytics/labels.py`.** Series, celdas y cifras de cada cadena.

### Tokens de interfaz (Fluent)

| Uso | Token |
|---|---|
| Fondo del contenido y de tarjetas | `colorNeutralBackground1` (blanco) |
| Fondo de página detrás de las tarjetas, bloque de conclusión | `colorNeutralBackground2` |
| Panel de navegación del módulo | `colorNeutralBackground3` |
| Bordes de tarjetas, divisores de tabla, borde del riel | `colorNeutralStroke2` |
| Texto principal / secundario / terciario | `colorNeutralForeground1` / `2` / `3` |
| Acción: botón primario, enlace, foco, selección, módulo activo | `colorBrandBackground`, `colorBrandForeground1`, `colorBrandBackground2` |
| Avisos | `MessageBar` con su `intent` (`info`, `warning`, `error`, `success`) |

### Colores de datos (`analytics/labels.py`)

| Token | Hex | Uso |
|---|---|---|
| `RED` | `#E31837` | Cinemex: serie en gráficas, cifras de Cinemex en tablas y hallazgos, borde de la tarjeta de hallazgo |
| `RED_SOFT` | `#FDEDF0` | Fondo del chip "Decisión" del hallazgo |
| `RED_DARK` | `#9E0F26` | Primer tono de la rampa ordinal (Premium / VIP) |
| `INK` | `#191A1E` | Cinépolis en gráficas |
| `INDEP` | `#8C8E95` | La Cineteca y los independientes. Solo en Independientes, Mapa, Recomendador y las listas de varias cadenas |
| `GRAY`, `GRID`, `LINE`, `PAPER` | | Ejes, rejilla, bordes y fondo **dentro de las gráficas** de Vega-Lite (`lib/vega-theme.ts`) |
| `OK` | `#2F6F4E` | Estado sano. **Solo en Operaciones** |
| `WARN` | `#B45309` | Estado con problema. **Solo en Operaciones** |

### Reglas de uso

- **Rojo solo para Cinemex, y solo en los datos.** Un rojo en pantalla significa "Cinemex". No se usa para acciones,
  alertas ni valores negativos. Las acciones van en el azul de Fluent.
- **Cinépolis en tinta.** En comparativas, Cinépolis va en `INK` y sus cifras en negrita; las de Cinemex en rojo.
  Cinemex siempre primero en las escalas; las series no se ciclan.
- **La Cineteca en gris medio.** No compite con ninguna de las dos cadenas.
- **Rampa ordinal** (cubetas ordenadas de formato) a partir del rojo: `#9E0F26`, `#E31837`, `#F08497`, `#F7CDD5`.
  El texto sobre los dos tonos claros es `#7A2233` (`RED_RAMP_TEXT`).
- **Divergente** (mapa de calor de Δ pp): lado Cinemex en rojo (`#F6B7C2` → `#E31837`), lado Cinépolis en tinta
  (`#8C8E95` → `#191A1E`), centro `#EFEFEF`. Texto blanco cuando la celda es oscura o saturada.
- Para un color de datos nuevo: agrégalo a `analytics/labels.py` y documéntalo aquí antes de usarlo. Para la interfaz,
  usa un token de Fluent; si ninguno sirve, se discute antes.

## Tipografía

La de Fluent: Segoe UI con sus respaldos del sistema (`tokens.fontFamilyBase`), y la rampa tipográfica de Fluent
(`Title2`, `Subtitle1`, `Body1`, `Caption1` o `tokens.fontSize*`). Sin fuentes externas ni anchuras condensadas.

| Elemento | Componente o token |
|---|---|
| Título de página | `Title3` (28 px, semibold) |
| Título de capa | `Subtitle1` (20 px, semibold) |
| Pregunta de sección | `Subtitle2` (16 px, semibold) |
| Titular de hallazgo | `fontSizeBase500`, semibold |
| Cuerpo | `Body1` (14 px) |
| Notas, soporte, tablas | `Caption1` / `fontSizeBase200`, números tabulares |

## Jerarquía en tres capas

La página se lee de arriba abajo con costo de atención decreciente:

1. **Capa 1, "Lo que importa hoy".** Hasta tres hallazgos redactados como decisión (titular, una línea de contexto,
   chip "Decisión: …") con cuatro a seis números de soporte a la derecha. Vienen de `analytics.findings`: entran los
   tres más fuertes (brecha entre umbral), no los tres primeros, así la capa cambia cuando cambia el mercado; si ninguna
   diferencia cruza su umbral, la capa lo dice y no inventa.
2. **Capa 2, "Evidencia por pregunta".** Una sección blanca por pregunta de negocio: la pregunta, la conclusión en un
   bloque con borde izquierdo de tinta, el gráfico como prueba y la guía "Cómo leerla" colapsada.
3. **Capa 3, "Detalle y apéndice".** Todo colapsado con una línea de resumen en gris al lado del título; un panel
   pendiente lo dice dentro de su propio apéndice. Cierra con el pie de fuentes.

## Navegación y marco

Como la consola de una aplicación de Microsoft (`components/shell.tsx`):

- **Riel de módulos** a la izquierda, 56 px, fondo blanco y borde derecho: un icono por módulo (`@fluentui/react-icons`,
  relleno cuando está activo, con fondo `colorBrandBackground2`) y un `Tooltip` con su nombre. Abajo, el `Avatar` de la
  cuenta abre un `Popover` con nombre, correo, rol y "Cerrar sesión".
- **Panel del módulo**, 220 px, fondo `colorNeutralBackground3`: el nombre del módulo y sus páginas (`NavItem` con
  icono). Los nombres salen de `MODULE_LABEL` y `NAV_LABEL`.
- **Módulos.** Cada uno corresponde a un plan que se contrata aparte; por ahora toda cuenta ve todos:
  - **Cartelera** (películas y funciones): Resumen (`/`), Mapa, ¿A dónde ir?, Independientes.
  - **Dulcería**: En sala (`/dulceria/`), A domicilio (`/dulceria/domicilio/`).
  - **Datos**: el explorador.
  - **Administración** (solo admin): Usuarios, Operaciones.
- **Contenido** a la derecha: una superficie blanca con elevación de Fluent depth 16 (`tokens.shadow16`) sobre el
  fondo `colorNeutralBackground3`, y adentro el ancho de lectura de 1120 px. En celular va sin sombra.
- **Celular (≤ 768 px):** riel y panel se ocultan. Los módulos van en una `TabList` fija abajo, al alcance del pulgar, y
  las páginas del módulo en una `TabList` arriba del contenido.
- Sin sesión no hay riel ni panel: solo la tarjeta de acceso.

## Componentes

Los de Fluent v9 antes que uno propio. Los compartidos viven en `components/common.tsx`.

### Encabezado de página

Título (`Title3`), una fila de metadatos en `colorNeutralForeground3` (zona, periodo, cines, funciones, última captura)
y, debajo, la barra de filtros. Sin palabras en rojo ni borde grueso.

### Barra de filtros

Una fila con `flexWrap` bajo el encabezado: `Field` con `Dropdown`, `Combobox`, `Input` o `DatePicker`. Los controles
que solo afectan una sección van dentro de esa sección. El estado vive en la URL.

### Rótulos de capa

Etiqueta "CAPA N" como `Badge` (`appearance="tint"`, color de marca), título de capa a su derecha y una línea de
descripción en `colorNeutralForeground3` de hasta 640 px.

### Tarjeta de hallazgo

`Card` blanca con borde `colorNeutralStroke2`, borde izquierdo de 4 px en `RED` (es un dato de Cinemex), radio
`borderRadiusMedium`. Dos columnas: texto y columna de soporte (240 px) con pares etiqueta / valor; valores de Cinemex en
rojo. Chip "Decisión" con fondo `RED_SOFT`. En pantallas angostas la columna pasa abajo.

### Sección de evidencia

`Card` blanca con borde, radio `borderRadiusMedium`, sin sombra. Orden fijo: pregunta, conclusión (fondo
`colorNeutralBackground2`, borde izquierdo de 3 px `colorNeutralStroke1`), leyenda, gráfico, controles, "Cómo leerla".

### Apéndice

`Accordion` dentro de una tarjeta con borde. La etiqueta lleva el título y, en `colorNeutralForeground3`, una línea de
resumen con las cifras clave.

### Botones y controles

Los de Fluent: `appearance="primary"` (azul) para la acción principal de un formulario, `secondary` para el resto,
`subtle` en la navegación. Nunca un botón rojo.

### Tarjeta de acceso

Entrar, olvidé y restablecer: una `Card` centrada de 420 px sobre `colorNeutralBackground2`, con el nombre del producto,
un encabezado corto, una línea de contexto y el botón primario. Los errores van en `MessageBar` con los textos de
`AUTH_TEXT`; nunca se revela si un correo existe.

### Tablas

`DataGrid` compacto: cabecera en `colorNeutralForeground3` semibold, filas separadas por `colorNeutralStroke2`, números
tabulares a la derecha, la columna de Cinemex en rojo y la de Cinépolis en negrita.

### Gráficas (Vega-Lite)

- Serie Cinemex `RED`, serie Cinépolis `INK`; la barra del dumbbell en `NEUTRAL`.
- Fuente de Fluent, ejes y leyendas en `GRAY`, rejilla `GRID`, sin marco ni ticks (`lib/vega-theme.ts`).
- Mapa de calor: celdas con radio 4 px separadas por 4 px de blanco, sin leyenda de color (el número va en la celda).
- Barras apiladas al 100 %: rampa ordinal roja, etiqueta de la cadena coloreada.

## Carga

Ninguna pantalla se queda en blanco ni con un `Spinner` suelto. Mientras un endpoint no responde, la página pinta
`Skeleton` de Fluent con la forma de lo que viene (`components/common.tsx`): `SkeletonCapas` en las páginas de tres
capas, `SkeletonSeccion`, `SkeletonTable`, `SkeletonApendice`, `SkeletonHallazgo` y `SkeletonLines`. `VegaChart` y
`CinemaMap` muestran su propio bloque hasta que la gráfica o el mapa terminan de cargar, y el marco pinta riel y panel
mientras se valida la sesión. Una página nueva arma su esqueleto con estas piezas.

Una página larga pide sus datos por partes. Lo de arriba se pide al entrar (`useApi`); cada sección o apéndice va dentro
de `Diferido`, que pide su endpoint cuando el bloque está a 600 px de la pantalla y pinta su esqueleto mientras llega.
Si un bloque falla, el error se muestra en ese bloque y el resto de la página sigue. La Cartelera lo usa así: encabezado
y hallazgos al entrar, cada sección de la Capa 2 y cada apéndice de la Capa 3 al acercarse. Los apéndices se piden al
acercarse y no al abrirse porque su resumen va en el encabezado cerrado.

## Movimiento

Las animaciones de Fluent, no unas propias. Los componentes de Fluent ya traen las suyas (`NavDrawer`, `Accordion`,
`Popover`, `Dialog`, `Tooltip`, `Spinner`). Lo que aparece al llegar los datos (secciones, hallazgos, apéndices y la
tarjeta de acceso) entra con `Entrada` de `components/common.tsx`: sube 8 px y se aclara, con
`motionTokens.durationNormal` y `curveDecelerateMid`. Fluent la acorta cuando el sistema pide menos movimiento.

## Estilo visual

- **Aplicación empresarial, no editorial.** Mucho blanco, jerarquía con la rampa tipográfica de Fluent.
- **El color es información.** La interfaz es neutra y azul; el rojo y la tinta solo aparecen donde hay datos de una
  cadena.
- **Espaciado** con `tokens.spacing*`; 32 px entre capas, 16 px entre tarjetas.
- **Bordes** de 1 px `colorNeutralStroke2` y radio `borderRadiusMedium`. La única elevación propia es la superficie del
  contenido (`shadow16`); las tarjetas van sin sombra. Fluent pone las suyas en `Popover`, `Dialog` y `Tooltip`.

## Aplicación en este repo

Esta sección describe Streamlit, que se borra en el corte. En `dashboard/` el tema es `lib/theme.ts` (`webLightTheme`)
y los colores de datos llegan por `lib/labels.generated.ts` (`make labels`).

- **Tema Streamlit.** El bloque `[theme]` de `.streamlit/config.toml` fija colores, radios, la familia Archivo y los
  pesos de encabezado. Fondo de página `#F6F6F4`, fondo secundario blanco (tarjetas, barra lateral).
- **Constantes de color.** Viven en `analytics/labels.py`: `RED`, `RED_DARK`, `RED_SOFT`, `INK`, `GRAY`, `GRAY_DARK`,
  `GRAY_LIGHT`, `LINE`, `PAPER`, `NEUTRAL`, `GRID`, `INDEP`, `CHAIN_COLOR`, `RED_RAMP`, `RED_RAMP_TEXT`, `DIVERGING`, y los de estado `OK` y `WARN`
  (solo Operaciones). Ningún hex se escribe
  directo en la presentación.
- **CSS complementario.** `ui/common.py` (`inject_css`, llamado desde `app.py`) inyecta la fuente variable Archivo desde Google Fonts, el ancho de lectura
  (1120 px) y los componentes del mockup: `.enc`, `.capa-tag`, `.hallazgo`, `.pregunta`, `.conclusion`, `table.mk`,
  `.marca`, `.acceso-h`, `.acceso-lead`, `.cuenta`; y estiliza los expanders según su contenedor
  (`st-key-apendice-*`, `st-key-leerla-*`), las secciones (`st-key-sec-*`) y la tarjeta de acceso (`st-key-acceso`).
- **Textos.** Los hallazgos y las conclusiones salen de `analytics/findings.py`; las etiquetas de `analytics/labels.py`.

Para un color nuevo, agregarlo a `analytics/labels.py` y documentarlo aquí antes de usarlo.

### Página Operaciones (solo admin)

Tablero de lectura para ingeniería, no para el cliente: reutiliza las secciones (`st-key-sec-*`), `table.mk`, el bloque
oscuro de pendientes y la cola de logs en `st.code`. Es la única página con nombres internos a la vista (tablas, logs) y
con los colores de estado `OK`/`WARN` (chip `.estado`, celdas `td.mal`). La gráfica de corridas mantiene las cadenas en
sus colores y marca las fallidas con una cruz ámbar.

### Página Mapa

Mapa de cines (`views/mapa.py`) con pydeck sobre el mapa base claro *Positron* de OpenFreeMap (`BASEMAP_STYLE` en `ui/common.py`,
vectorial, sin clave, datos de OpenStreetMap; el
crédito va en el pie de la página). Cada cine es un punto en su color de cadena (los de un mismo edificio se abren en círculo y comparten tooltip y ficha) (`CHAIN_COLOR`, convertido con
`rgb()` de `ui/common.py`), con borde papel; el tamaño (en píxeles, 5–22, no crece con el zoom) sigue la métrica elegida
en la barra lateral y un cine sin ese dato queda chico y tenue (alfa 70). Ficha al pasar el cursor (fondo papel, texto tinta) y ficha fija al hacer clic.
Encima, la tabla de destacados por cadena; debajo, la tabla completa en un apéndice.

### Página ¿A dónde ir? (recomendador)

`views/recomendador.py`: arriba el formulario "Tu plan" (dirección con botón Buscar, "Usar mi ubicación", grupo por
tipo de boleto, presupuesto, dulcería y día) y "Más filtros" en un expander; luego el mapa Leaflet (`streamlit-folium`, el mismo mapa base de la página Mapa, dibujado con
MapLibre dentro de Leaflet por `vector_basemap()`) porque el
clic en un punto vacío tiene que devolver su coordenada, y pydeck solo avisa de clics sobre un objeto. El punto de
partida es un círculo papel con borde tinta; el radio, una línea gris; los cines con funciones que caben, puntos en su
color de cadena. Resultados en `table.mk` (boletos, dulcería y total), con Cinemex en rojo; las funciones sin precio de
dulcería en su propia sección y las sin precio de boletos en un apéndice.

### Página Independientes

La oferta de la Cineteca Nacional (`views/independientes.py`) con la misma estructura de tres capas que la cartelera y
la dulcería: la serie de la Cineteca en `INDEP` y, cuando se compara con nosotros (solape de títulos, franjas), Cinemex
primero y en rojo. Cinépolis no aparece: la Cineteca no entra al head-to-head. Los paneles de ocupación se muestran como
pendientes (`st.info`) mientras la lectura de sus planos no esté confirmada.

### Navegación entre páginas (Streamlit)

`st.navigation(position="top")`: pestañas "Cartelera", "Mapa", "¿A dónde ir?", "Dulcería", "Independientes", "Datos" y, para el rol admin, "Usuarios" y "Operaciones" en la barra
superior en escritorio. Sin sesión la navegación va oculta (`position="hidden"`) y solo existen las páginas de acceso. En pantallas de
768 px o menos, una regla `@media` fija la barra al pie de la pantalla (fondo papel, borde superior, sombra suave) y
deja 84 px de aire al final del contenido, para que quede al alcance del pulgar. No probado en dispositivo real
(Streamlit colapsa los enlaces en un desplegable si no caben).
