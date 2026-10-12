# Handoff: contenido y jerarquía del dashboard

Escrito el 2026-10-12, a partir de una revisión de diseño de información sobre capturas de escritorio (1440 px, CDMX,
base real del 2026-10-12). Lee antes `AGENTS.md` (§2 principios, §4 textos), `DESIGN.md` ("Pantallas de la Cartelera",
"Carga") y `.claude/rules/comments.md`.

## Objetivo

Que un directivo responda "qué pasó y qué hago" en 15 segundos por pantalla. Más texto no es más información: cada
elemento habilita una decisión o se colapsa.

Los cálculos no cambian. Este trabajo toca textos, orden, qué va abierto o colapsado y cómo se representa cada dato.
Si un cambio pide un cálculo nuevo, va en `analytics/` (regla de arquitectura), no en el componente.

## Dónde vive cada cosa

- **Textos y frases:** `analytics/labels.py` (etiquetas, títulos, pies) y `analytics/findings.py` (conclusiones y
  hallazgos). Después de editar, `make labels` regenera `dashboard/lib/labels.generated.ts`.
- **Componentes:** `dashboard/components/common.tsx` (`Seccion`, `Pregunta`, `Leerla`, `Apendice`, `Table`),
  `components/cartelera/*` (Hallazgos, Programación, Preventa, Precios, Cines), `components/dulceria/`, `mapa/`,
  `independientes/`, `movies-dumbbell.tsx`, `day-slot-heatmap.tsx`.
- **Endpoints:** `api/pages/<pagina>.py`. No deberían cambiar salvo por una llave nueva de `read()`.

## Reglas para todo el producto

1. **El título de cada sección es una conclusión** con cifra y referencia de la misma unidad. No "Franja · 10 AM – 12 PM",
   sino "Tenemos 3.7 pp más funciones de 10 AM a 12 PM".
2. **Una sola representación visible por dato.** Si hay gráfica, la tabla con los mismos renglones va colapsada
   (`Apendice`).
3. **Toda diferencia lleva signo, flecha y palabra:** "▼ 43.5 pp abajo", "▲ 3.7 pp arriba". El chip gris neutro no basta.
4. **La incertidumbre se dice en una línea:** "n = 30 funciones", "queda fuera ~20 % de las funciones". Lo que tiene poca
   muestra se atenúa.
5. **Un formato de hora y de número**, siempre con los helpers (`date_es`, `time_12`, `n`, `pp`). Los porcentajes llevan
   `%` y los precios `$`.
6. **Primera persona del plural** ("nuestro rival", "vamos atrás"). Nunca "Tu".
7. **Los títulos largos se recortan a la mitad** ("BTS … São Paulo"), no al final, cuando dos renglones empiezan igual.
8. **El recuadro de conclusión es solo para conclusiones.** Las instrucciones de uso van como texto de ayuda gris.

## Prioridad (impacto alto, esfuerzo bajo)

1. Resumen de 3 líneas arriba de Hallazgos y títulos de tarjeta como conclusiones (§1). **Hecho (2026-10-12):** el título de
   cada tarjeta es la conclusión y cada una trae su sugerencia (`action`). El resumen de arriba muestra las 3
   sugerencias de mayor impacto, no las conclusiones, para no repetir el título de las tarjetas (decisión de David).
   También quedaron el recorte a la mitad de los títulos, la flecha en la diferencia, "% del aforo por día" y la
   referencia de la preventa exclusiva en la misma unidad. Pendiente: "Tu Nombre" sigue sin año.
2. Colapsar por defecto las tablas duplicadas (§2, §4, §5, §10).
3. Arreglar los desbordes (lista en "Bugs de maquetación").
4. Corregir las comparaciones rotas (§1, §8, §9).
5. Cambiar los 4 enlaces por tarjeta por un menú ⋯ y unificar los formatos de hora (§1, §6).

## Bugs de maquetación (objetivos)

| Pantalla | Elemento | Qué pasa |
| --- | --- | --- |
| Programación | Tabla de películas | La columna "Δ pp" se corta a la derecha ("+2", "−4"); el título ocupa hasta 4 renglones |
| Programación | Gráfica de pesas | Las etiquetas "solo Cinépo" y "solo Cineme" se cortan |
| Preventa | Barras de exclusivas | La primera etiqueta se corta ("97 % · exclusiv") |
| Precios | Salas y butacas por complejo | La tabla derecha se corta ("Butacas por sal") |
| Hallazgos | Tarjetas de preventa | "BTS WORLD TOUR 'ARIRANG'…" dos veces: no se distinguen |

Arreglarlos con scroll horizontal propio de la tabla, o quitando columnas que no deciden nada. `make test-ui` revisa el
celular; estos desbordes son de escritorio y no los atrapa.

## Cambios por pantalla

### 1. Hallazgos (`/`)

- **Titular de página.** Arriba de las tarjetas, 3 líneas con los 3 hallazgos de mayor |pp|. Las frases salen de
  `findings.py`; falta una función que elija las tres y una llave en el endpoint.
  Ejemplo: "Vendemos 6.7 % de butacas contra 12 % de Cinépolis (−5.5 pp). Perdemos la preventa de BTS (−44 pp). A
  domicilio, Cinépolis cobra 52 % más que nosotros."
- **Títulos de tarjeta como conclusiones.** Hoy son "categoría · entidad".
  - "Demanda · Tu Nombre — 72 %" → "Tu Nombre vende 4× lo esperado en Cinépolis (72 % vs 18 %). No la tenemos."
  - "Preventa exclusiva de Cinépolis · Rammstein — 96 % frente a 6 títulos" → "Rammstein, solo en Cinépolis, ya vendió 96 %".
- **Comparaciones de unidades distintas.** "96 % Aforo vendido frente a 6 títulos" compara un porcentaje contra un
  conteo. En "Demanda", el KPI es ocupación pero la gráfica muestra share de parrilla (0.0 % vs 4.0 %). Cada tarjeta
  compara contra una referencia de su misma unidad.
- **Periodo.** El encabezado dice "lun 12 – mié 14 oct" y las tarjetas de ocupación usan "Últimos 7 días". Cada tarjeta
  dice su ventana en el pie.
- **Diferencia.** Chip con flecha y palabra (regla 3).
- **"2.7 pts/día"** → "+2.7 % del aforo por día" (`labels.py`).
- **"Tu Nombre"** parece un texto de plantilla. Agregar año o "(anime)" cuando un título choca con la interfaz; si no hay
  forma limpia, dejarlo y anotarlo.
- **Acciones.** Hoy cada tarjeta tiene "Descargar PNG", "Descargar CSV", "Ver datos" y "Ver la evidencia": 44 enlaces
  en la página. Dejar "Ver más" (antes "Ver la evidencia") visible y lo demás en un menú ⋯.
- **Formato.** Los dos donuts repiten el KPI. Basta con el número y la línea de subtituladas.

### 2. Programación semanal

- **Indicadores del periodo.** Hoy es una tabla de 11 filas, abierta, con un pie de 3 frases (define HHI y butacas
  ofertadas). Mostrar 3 KPI: funciones por cine y día (+18 %), títulos distintos (−12), share después de 6 PM
  (−2.4 pp). Colapsar la tabla completa. A las filas sin Δ (funciones publicadas, cines, butacas por función, HHI,
  títulos por complejo) les falta, o hay que justificar por qué no lo tienen.
- **Conclusión de reparto.** "0.72 funciones suyas por cada una nuestra" → "Publicamos 39 % más funciones que
  Cinépolis".
- **"Sobre-indexamos"** → "Damos más pantalla a…" (`findings.py`).
- **Mapa de calor.** "Ganamos de 10 AM a 12 PM" se apoya en +1.3 pp. Atenuar las celdas bajo el umbral de
  `findings.py` y que la frase solo nombre las que lo cruzan.
- **Cifras de Cinemex en rojo dentro de la tabla** [estilo]: se leen como alerta. Valorar tinta normal con un punto rojo
  en el encabezado de columna.

### 3. Preventa

- **Conclusión.** Hoy es una frase con 4 hechos. Cambiar a 3 KPI en fila: "Adelante en 2 de 6 compartidos",
  "Exclusivas 2 vs 6", "Mejor ritmo: El Cadáver de la Novia, +2.7 %/día". Frase sugerida: "Vamos atrás en 4 de 6
  preventas compartidas. Cinépolis tiene 6 exclusivas y Rammstein ya vendió 96 %."
- **Muestra.** "1 %" y "0 %" sin n. Agregar "n funciones" por barra o atenuar las de poca muestra.
- **Exclusivas.** "97 % · exclusiva" se repite 11 veces. Separar en dos bloques, "Solo nosotros" y "Solo Cinépolis", y
  quitar la palabra de cada barra.
- **Curva de venta.** El eje dice "28.0 27.0…": usar días enteros. Por defecto abre "En Escena: Macbeth | Met", sin
  referencia. Abrir el título compartido con más aforo, con las dos cadenas como líneas.

### 4. Precios y butacas

- **Falta pregunta y conclusión** (rompe el orden de `DESIGN.md`). Propuesta: "Somos 22–31 % más baratos en
  Premium/VIP; en los demás formatos estamos a ±5 %."
- **Tabla de 24 filas** (muestras, mínimo, máximo): colapsada.
- **Formato × día** [estilo]: un mapa de calor de 4 × 3 con el Δ en cada celda se lee más rápido que 12 filas.
- **Salas y butacas.** El pie de 3 renglones explica círculo contra cuadro: usar etiquetas directas. La tabla derecha se
  corta (ver bugs).
- **Segunda tabla** sin "$".

### 5. Cines

- **"7 / 51 cines que venden más que su rival"** es el mejor KPI del producto. Se queda.
- **Rivales.** La gráfica de 51 pares y la tabla de 51 filas muestran lo mismo. Colapsar la tabla. La página mide
  4,700 px.
- **"Tu rival número uno, cine por cine"** → "Nuestro rival, cine por cine" (`labels.py`, `findings.py`,
  `cinema_sales.py`).
- **"Nuestros cines a 3 km o menos"** lista hasta 4 cines con su %. Mostrar solo el más cercano.
- **Dispersión** [estilo]: marcar la mediana y poner ticks cada 10 (hoy van de 2 en 2 hasta 54).

### 6. Historial de funciones

- **Horas.** Hay 3 formatos en la pantalla: "lunes 12 de octubre de 2026, 11:20 A.M.", "6/10 08:30 AM" y
  "11/10 09:30 PM". "6/10" es ambiguo. En la tabla, "11:20 AM" (la fecha ya está en el filtro); en "Publicada" y
  "Detectado", "6 oct, 8:30 AM".
- **Cancelaciones.** "5,207 canceladas nuestras vs 726 de Cinépolis" está en un encabezado colapsable con 5 frases de
  glosario. Se queda como está (decisión 3).

### 7. Mapa

- **El recuadro de conclusión tiene instrucciones** ("Pasa el cursor sobre un punto…"). Moverlas a un texto de ayuda gris.
- **Destacados de la zona.** 3 de 6 columnas son casi todo "—" (WTC, Tonalá, Cinemanía) y "(87)" no explica qué cuenta.
  Dejar Cinemex y Cinépolis; los independientes tienen su página. Explicar el número: "de 87 cines".
- **Filtro de cadenas** truncado → "13 cadenas".
- Es de consulta (decisión 4).

### 8. Dulcería

- **Palomitas en sala.** Son 74 barras casi iguales ($86–$107) con el eje desde $0: la variación no se ve. Cambiar por
  una tabla o barra de los 7 niveles de precio con cuántos complejos tiene cada uno ("$107 · 20 VIP").
- **Números que no cuadran en la misma pantalla** (corregido, decisión 5). La tarjeta dice "de $71 a $107 en 10 niveles de precio"
  (`findings.py`) y el gráfico "de $86 a $107 … 7 precios distintos" (`delivery.py`). Si son productos distintos, el
  texto nombra cuál es cuál.
- **"nuestra lista llega con tus datos"** es ambiguo (`labels.py`). Decir qué dato falta y quién lo manda.
- **Salvedad en cursiva dentro de la conclusión.** Moverla a una línea de confianza aparte.

### 9. Distribuidoras

- **El titular contradice la gráfica.** Dice que la mayor separación es Universal (+3.0 pp), pero +QueCine marca
  −6.6 pp. Explicar la exclusión ("sin contar programas propios") u ordenar por |brecha|.
- **Tabla en formato largo.** 36 filas; Universal aparece 3 veces (Cinemex, Cinépolis, Sin conciliar). Cambiar a una fila
  por distribuidora con columnas Cinemex | Cinépolis | Δ, y "Sin conciliar" como una sola fila al final.
- **Exclusión sin proporción.** "3,646 funciones … quedan fuera de la brecha" → agregar el porcentaje del total
  ("~20 % de las funciones").
- **Porcentajes sin "%"** ("100.0", "21.7").

### 10. Independientes

- **Gráfica duplicada.** "Títulos con más funciones" y "Sus títulos … según si también los exhibimos" son iguales; la
  segunda solo cambia el color. Quedarse con la segunda.
- **Pendiente técnico.** "falta confirmar cómo marca el plano de asientos…" (3 frases, `labels.py`) → "Ocupación:
  pendiente. Se activa con 1–2 días de datos de venta." Igual el aviso "El hallazgo se enciende cuando…".
- **"Solo en la Cineteca: la oportunidad"** [estilo]: dice "oportunidad" sin dato de demanda → "Solo en la Cineteca".

¿A dónde ir? queda fuera: es la demo para el consumidor y no está en el menú.

## Decisiones (David, 2026-10-12)

1. **Las pantallas dan hechos y sugerencias.** Damos insights y sugerencias; el director o el gerente decide. Cada
   conclusión lleva el hecho y, cuando cruza su umbral, una acción sugerida en tono de sugerencia ("Conviene…",
   "Valora…"), nunca una orden.
2. **Las tarjetas de Hallazgos van por mayor impacto.** El titular de 3 líneas toma las tres primeras de ese mismo orden.
3. **Las 5,207 cancelaciones de Cinemex: sin dato para decidir.** No se mueven ni se destacan. Queda pendiente separar
   las cancelaciones reales de las funciones que Cinemex conserva al empezar.
4. **El Mapa es de consulta.** No responde una decisión: no lleva conclusión ni hallazgo, solo texto de ayuda gris. El
   tamaño del punto se queda como está.
5. **Palomitas: el mismo producto, otro alcance (verificado 2026-10-12).** La tarjeta y la conclusión de `findings.py`
   llamaban `concession_basket(conn)` sin `plaza` y mostraban todo el país (500 cines, $71–$107, 10 niveles). El
   gráfico sí usa la plaza (CDMX: 74 cines, $86–$107, 7 niveles). Ya corregido: `_concession_finding` y `conclusions`
   pasan `plaza`.

## Cómo verificar

- `make labels` y `make check` (labels generados al día, ruff, pytest).
- `pnpm run build` en `dashboard/` (tipos).
- Levantar la API con `make dashboard` y el frontend con `pnpm dev`, y mirar cada pantalla en CDMX y nacional. Un texto
  nuevo en `findings.py` se imprime una vez con datos reales antes de conectarlo.
- `make test-ui` para el celular (320–820 px).
- Las capturas de esta revisión salieron de un script con Playwright: el build estático y la API interna en el mismo
  puerto (como en `tests/test_mobile.py`), con la base real y una cuenta staff en un `app.db` temporal. Repetirlo
  después del cambio para comparar.
