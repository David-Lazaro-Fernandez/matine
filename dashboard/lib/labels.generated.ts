// Generado por `make labels` (scripts/export_labels.py) desde analytics/labels.py; no se edita a mano.

export const US = "cinemex" as const;

export const THEM = "cinepolis" as const;

export const COMPARED = [
  "cinemex",
  "cinepolis"
] as const;

export const CHAIN_LABEL = {
  "cinemex": "Cinemex",
  "cinepolis": "Cinépolis",
  "cineteca": "Cineteca Nacional",
  "cineteca_gdl": "Cineteca FICG",
  "cineteca_mty": "Cineteca Nuevo León",
  "wtc": "Cinemas WTC",
  "tonala": "Cine Tonalá",
  "cinemania": "Cinemanía",
  "papalote_mty": "Papalote IMAX",
  "cinery": "Cinery",
  "epic": "Epic Cinemas",
  "raly": "Cinemas Raly",
  "cabanas": "Cine Cabañas"
} as const;

export const RED = "#E31837" as const;

export const RED_DARK = "#9E0F26" as const;

export const RED_SOFT = "#FDEDF0" as const;

export const INK = "#191A1E" as const;

export const GRAY_DARK = "#3A3C42" as const;

export const GRAY = "#5C6068" as const;

export const GRAY_LIGHT = "#F6F6F4" as const;

export const LINE = "#E4E5E9" as const;

export const PAPER = "#FFFFFF" as const;

export const INDEP = "#8C8E95" as const;

export const CHAIN_COLOR = {
  "cinemex": "#E31837",
  "cinepolis": "#191A1E",
  "cineteca": "#8C8E95",
  "cineteca_gdl": "#8C8E95",
  "cineteca_mty": "#8C8E95",
  "wtc": "#8C8E95",
  "tonala": "#8C8E95",
  "cinemania": "#8C8E95",
  "papalote_mty": "#8C8E95",
  "cinery": "#8C8E95",
  "epic": "#8C8E95",
  "raly": "#8C8E95",
  "cabanas": "#8C8E95"
} as const;

export const NEUTRAL = "#C9CBD0" as const;

export const GRID = "#ECEDEF" as const;

export const RED_RAMP = [
  "#9E0F26",
  "#E31837",
  "#EC6B82",
  "#F08FA0"
] as const;

export const RED_RAMP_TEXT = "#4D0F1E" as const;

export const DIVERGING = [
  "#191A1E",
  "#8C8E95",
  "#EFEFEF",
  "#F6B7C2",
  "#E31837"
] as const;

export const WARN = "#B45309" as const;

export const OK = "#2F6F4E" as const;

export const DARK_BRAND = [
  "#1A0508",
  "#2E0910",
  "#470D18",
  "#5E1020",
  "#771228",
  "#901530",
  "#B0173A",
  "#C9223F",
  "#E0364F",
  "#F06A7C",
  "#F68A99",
  "#F9A6B2",
  "#FBC0C8",
  "#FDD6DC",
  "#FEE8EB",
  "#FFF5F6"
] as const;

export const DARK_NAV_ITEM = "#141414" as const;

export const DARK_DATA_COLOR = {
  "#E31837": "#FF5468",
  "#191A1E": "#EDEDED",
  "#E4E5E9": "#3D3F45",
  "#FDEDF0": "#5A2430",
  "#3A3C42": "#C9CBD0"
} as const;

export const SLOTS = [
  [
    "antes_10",
    0,
    10,
    "Antes de 10:00 A.M."
  ],
  [
    "de_10_a_12",
    10,
    12,
    "10:00 A.M. a 12:00 P.M."
  ],
  [
    "de_12_a_15",
    12,
    15,
    "12:00 P.M. a 3:00 P.M."
  ],
  [
    "de_15_a_18",
    15,
    18,
    "3:00 P.M. a 6:00 P.M."
  ],
  [
    "de_18_a_21",
    18,
    21,
    "6:00 P.M. a 9:00 P.M."
  ],
  [
    "despues_21",
    21,
    24,
    "Después de 9:00 P.M."
  ]
] as const;

export const SLOT_LABEL = {
  "antes_10": "Antes de 10:00 A.M.",
  "de_10_a_12": "10:00 A.M. a 12:00 P.M.",
  "de_12_a_15": "12:00 P.M. a 3:00 P.M.",
  "de_15_a_18": "3:00 P.M. a 6:00 P.M.",
  "de_18_a_21": "6:00 P.M. a 9:00 P.M.",
  "despues_21": "Después de 9:00 P.M."
} as const;

export const SLOT_SHORT = {
  "antes_10": "Antes de 10 A.M.",
  "de_10_a_12": "10 A.M. – 12 P.M.",
  "de_12_a_15": "12 – 3 P.M.",
  "de_15_a_18": "3 – 6 P.M.",
  "de_18_a_21": "6 – 9 P.M.",
  "despues_21": "Después de 9 P.M."
} as const;

export const PRIME_START_HOUR = 18 as const;

export const HOUR_MARKS = [
  0,
  10,
  12,
  15,
  18,
  21,
  24
] as const;

export const FULL_DAY = [
  0,
  24
] as const;

export const HOUR_PRESETS = {
  "Todo el día": [
    0,
    24
  ],
  "Después de las 6 PM": [
    18,
    24
  ],
  "Matiné, antes de las 12 PM": [
    0,
    12
  ]
} as const;

export const PRIME_LABEL = "viernes a domingo, de 6:00 P.M. en adelante" as const;

export const WEEKDAY_LABEL = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo"
] as const;

export const FORMAT_BUCKETS = [
  "premium",
  "large",
  "3d4d",
  "traditional"
] as const;

export const FORMAT_LABEL = {
  "premium": "Premium / VIP",
  "large": "Gran formato",
  "3d4d": "3D o 4D",
  "traditional": "Tradicional"
} as const;

export const LANGUAGE_LABEL = {
  "spanish": "Español",
  "subtitled": "Subtitulada",
  "original": "Español",
  "other": "Otro"
} as const;

export const PLATFORM_LABEL = {
  "rappi": "Rappi",
  "didi": "DiDi Food"
} as const;

export const CINEMA_TYPE_LABEL = {
  "vip": "VIP",
  "traditional": "Tradicional"
} as const;

export const CONCESSION_CHART_TEXT = {
  "price_axis": "Pesos",
  "product": "Producto",
  "chain": "Cadena",
  "median": "Mediana",
  "delta_pct": "Δ Cinépolis vs Cinemex %",
  "cinema": "Complejo",
  "price": "Precio",
  "cinema_type": "Tipo",
  "vip_cinema": "{name} VIP"
} as const;

export const DULCERIA_TEXT = {
  "title": "Dulcería: <span>Cinemex</span> frente a Cinépolis",
  "no_db": "Aún no hay datos: la base no existe todavía. Ver la página de cartelera.",
  "no_findings": "La brecha de dulcería no cruza el umbral de relevancia.",
  "question": "¿Cómo compite nuestra dulcería con la de Cinépolis?",
  "question_note": "En sala solo tenemos el menú de Cinépolis; nuestra lista llega con tus datos. La comparación directa es a domicilio, plataforma contra plataforma.",
  "empty": "Aún no hay lecturas de dulcería.",
  "delivery_title": "A domicilio: precio mediano por tipo de producto",
  "platform": "Plataforma",
  "both": "Ambas",
  "delivery_empty": "Sin lecturas de dulcería a domicilio.",
  "compare_headers": [
    "Producto comparable",
    "Cinemex",
    "Nuestro producto",
    "Cinépolis",
    "Su producto",
    "Δ Cinépolis vs Cinemex"
  ],
  "room_title": "En sala: {chain} fija el precio por complejo",
  "product": "Producto",
  "room_note": "{product}: de ${min} a ${max} en {cinemas} complejos, {prices} precios distintos; la línea punteada es la mediana (${median}).",
  "detail": "Detalle: canasta de Cinépolis por complejo, catálogo a domicilio y tiendas",
  "basket_headers": [
    "Producto",
    "Complejos",
    "Mediana",
    "Mínimo",
    "Máximo",
    "Máx. vs mín.",
    "Precios distintos"
  ],
  "summary_headers": [
    "Plataforma",
    "Cadena",
    "Tiendas",
    "Productos",
    "% con precio único",
    "Última lectura"
  ],
  "chain": "Cadena",
  "leer": "A domicilio se compara la mediana entre tiendas de cada cadena en la misma plataforma (Rappi, DiDi Food), agrupando productos por tipo porque cada cadena los nombra distinto; es el catálogo para llevar (Mega Palomitas de 230 g, refresco en lata), no el tablero de sala, y las porciones difieren: nuestro combo básico lleva dos latas y el de Cinépolis un refresco. En sala solo existe el menú en línea de Cinépolis, por complejo; palomitas y refresco van por tamaño y se muestra el tamaño base. Cinemex tiene apagada la venta de dulcería en línea, así que nuestro tablero de sala llega con tus datos. Uber Eats no se lee porque sus términos prohíben la extracción.",
  "back": "Volver a la cartelera",
  "footer": "Fuentes: menú de dulcería en línea de Cinépolis por complejo; catálogo de dulcería a domicilio de ambas cadenas en Rappi y DiDi Food, renovado cada semana. Cinemex tiene apagada la venta de dulcería en línea. Historia desde el {date}."
} as const;

export const PLAZA_LABEL = {
  "cdmx": "CDMX",
  "gdl": "Guadalajara",
  "mty": "Monterrey"
} as const;

export const NATIONAL_LABEL = "Nacional" as const;

export const ZONE_TEXT = {
  "header": "Zona",
  "page_title": "Cartelera · Cinemex frente a Cinépolis"
} as const;

export const FILTER_TEXT = {
  "clear": "Quitar filtro",
  "search": "Buscar",
  "no_matches": "Ningún resultado",
  "hide_fields": "Ocultar campos",
  "hidden_one": "1 campo oculto",
  "hidden_many": "{n} campos ocultos",
  "find_field": "Encontrar un campo",
  "hide_all": "Ocultar todos",
  "show_all": "Mostrar todo",
  "sort": "Clasificar",
  "sort_by": "Ordenar por",
  "sorted_by": "Ordenado por {field}",
  "ascending": "Ascendente",
  "descending": "Descendente",
  "clear_sort": "Quitar orden"
} as const;

export const PERIOD_TEXT = {
  "header": "Periodo",
  "today": "Hoy",
  "tomorrow": "Mañana",
  "week": "Resto de la semana de cine (hasta el {d1})",
  "next_week": "Semana de cine siguiente ({d0} a {d1}){state}",
  "week_short": "Resto de la semana",
  "next_week_short": "Semana siguiente",
  "custom": "Elegir fechas",
  "from": "Del",
  "to": "Al"
} as const;

export const LANGUAGE_BUCKETS = [
  "spanish",
  "subtitled"
] as const;

export const KIND_LABEL = {
  "added": "Función nueva",
  "removed": "Función cancelada",
  "expired": "Función concluida",
  "moved": "Cambio de horario o sala",
  "changed": "Cambio de idioma o formato",
  "availability": "Cambio de ocupación",
  "first_seen": "Publicada"
} as const;

export const KIND_PLURAL = {
  "added": "funciones nuevas",
  "removed": "funciones canceladas",
  "expired": "funciones concluidas",
  "moved": "cambios de horario o sala",
  "changed": "cambios de idioma o formato",
  "availability": "cambios de ocupación"
} as const;

export const FIELD_LABEL = {
  "datetime_local": "Hora",
  "screen": "Sala",
  "language": "Idioma",
  "format": "Formato",
  "experience": "Experiencia",
  "premium_tier": "Tipo de sala",
  "movie_id": "Película",
  "availability": "Ocupación"
} as const;

export const STATUS_LABEL = {
  "current": "Vigente",
  "removed": "Cancelada",
  "expired": "Concluida"
} as const;

export const VS_NOW_LABEL = {
  "same": "Igual que hoy",
  "changed": "Cambió después",
  "gone": "Ya no está publicada"
} as const;

export const EXCLUSIVE_LABEL = {
  "cinemex": "solo Cinemex",
  "cinepolis": "solo Cinépolis"
} as const;

export const PUBLICATION_LABEL = {
  "partial": " · publicada parcialmente",
  "published": " · publicada"
} as const;

export const PRESALE_OTHER_LABEL = {
  "presale": "también en preventa",
  "absent": "{other} no lo exhibe",
  "shown": "{other} lo exhibe, fuera de su preventa"
} as const;

export const PRESALE_TAG = {
  "absent": "exclusiva",
  "shown": "la otra lo exhibe"
} as const;

export const CARTELERA_CHART_TEXT = {
  "chain": "Cadena",
  "group": "Grupo",
  "mix_share": "% de su programación",
  "mix_shows": "Funciones",
  "percent": "{value} %",
  "presale_title": "Título",
  "presale_release": "Estreno",
  "presale_no_release": "—",
  "presale_shows": "Funciones leídas",
  "presale_seats": "Butacas vendidas",
  "presale_seats_value": "{sold} de {seats}",
  "presale_sold": "% del aforo vendido",
  "presale_pace": "Ritmo",
  "presale_pace_value": "{pace} puntos del aforo al día",
  "presale_pace_pending": "se mide desde la segunda lectura",
  "presale_other": "En la otra cadena",
  "presale_tagged": "{sold} · {tag}",
  "presale_axis": "% de las butacas del panel ya vendidas",
  "curve_x": "Días antes de la función",
  "curve_y": "% de las butacas vendidas",
  "curve_days": "Días antes",
  "curve_readings": "Lecturas",
  "curve_sold": "% vendido"
} as const;

export const KIND_HELP = {
  "added": "Apareció una función que no estaba en la cartelera publicada.",
  "removed": "Una función publicada desapareció cuando faltaban más de 30 minutos para empezar.",
  "expired": "La función empezó y salió de la cartelera publicada; se guarda solo para reconstruir la historia.",
  "moved": "La misma función cambió de hora o de sala.",
  "changed": "La misma función cambió de idioma (doblada/subtitulada), formato o experiencia.",
  "availability": "Cambió el nivel de ocupación reportado por la cadena."
} as const;

export const COLUMN_LABEL = {
  "status": "Estado",
  "first_seen": "Publicada",
  "vs_now": "Frente a hoy",
  "changes": "Cambios",
  "detected_at": "Detectado",
  "platform": "Plataforma",
  "store_name": "Tienda",
  "stores": "Tiendas",
  "address": "Dirección",
  "description": "Descripción",
  "pct_single_price": "% productos con precio único",
  "last_sampled": "Última lectura",
  "product_name": "Producto",
  "category": "Categoría",
  "products": "Productos",
  "listings": "Referencias",
  "avg_price": "Precio promedio",
  "spread_pct": "Máx. vs mín. %",
  "distinct_prices": "Precios distintos",
  "price": "Precio",
  "categories": "Categorías",
  "chain": "Cadena",
  "cinemas": "Cines",
  "shows": "Funciones",
  "movies": "Películas",
  "pct_subtitled": "% subtituladas",
  "shows_per_cinema": "Funciones por cine",
  "pct_prime": "% en horario prime",
  "pct_evening": "% de 6:00 P.M. en adelante",
  "total": "Total",
  "title": "Película",
  "title_norm": "Película",
  "title_cinemex": "Título en Cinemex",
  "title_cinepolis": "Título en Cinépolis",
  "shows_cinemex": "Funciones Cinemex",
  "shows_cinepolis": "Funciones Cinépolis",
  "cinemas_cinemex": "Cines Cinemex",
  "cinemas_cinepolis": "Cines Cinépolis",
  "per_cinema_cinemex": "Por cine Cinemex",
  "per_cinema_cinepolis": "Por cine Cinépolis",
  "share_cinemex": "% programación Cinemex",
  "share_cinepolis": "% programación Cinépolis",
  "gap_pp": "Diferencia (puntos)",
  "shows_total": "Funciones totales",
  "kind": "Tipo de cambio",
  "movie_title": "Película",
  "cinema_id": "Cine",
  "cinema_name": "Cine",
  "date": "Fecha",
  "datetime_local": "Función",
  "show_id": "Id",
  "n": "Cambios",
  "hhi": "Índice de concentración (HHI)",
  "top3_pct": "Peso del Top 3",
  "titles_per_cinema": "Títulos por complejo",
  "titles": "Títulos distintos",
  "screens": "Salas",
  "seats": "Butacas",
  "avg_seats": "Butacas por sala",
  "min_seats": "Sala más chica",
  "max_seats": "Sala más grande",
  "seats_offered": "Butacas ofertadas",
  "pct_known": "% funciones con aforo",
  "share_shows": "% de funciones",
  "share_seats": "% de butacas",
  "avg_seats_per_show": "Butacas por función",
  "samples": "Muestras",
  "avg_sold_pct": "% vendido (promedio)",
  "min_sold_pct": "Mínimo",
  "max_sold_pct": "Máximo",
  "sold": "Vendidos",
  "sold_pct": "% vendido",
  "minutes_to_start": "Minutos antes",
  "sampled_at": "Muestreado",
  "availability": "Semáforo",
  "format_bucket": "Formato",
  "day_type": "Tipo de día",
  "median_price": "Precio general (mediana)",
  "min_price": "Mínimo",
  "max_price": "Máximo",
  "screen": "Sala",
  "city_id": "Ciudad / área",
  "state_id": "Estado",
  "plaza": "Plaza",
  "sample_cinema": "Cine de muestra",
  "timezone": "Zona horaria",
  "lat": "Latitud",
  "lng": "Longitud",
  "last_seen": "Última vez vista",
  "first_seen_at": "Publicada",
  "broken": "Fuera de servicio",
  "show_date": "Fecha",
  "starts_at": "Inicio",
  "language": "Idioma",
  "format": "Formato",
  "experience": "Experiencia",
  "premium_tier": "Nivel premium",
  "closed_at": "Cerrada",
  "closed_kind": "Cierre",
  "general_price": "Precio general",
  "fee_price": "Cargo por servicio",
  "sub_category": "Subcategoría",
  "promotion_type": "Promoción",
  "active": "Activa",
  "in_stock": "En existencia",
  "store_slug": "Tienda (clave)",
  "email": "Correo",
  "name": "Nombre",
  "role": "Rol",
  "last_login_at": "Último acceso",
  "created_at": "Creada",
  "pending_invite": "Invitación pendiente",
  "has_password": "Con contraseña",
  "id": "Id",
  "shows_indep": "Funciones Cineteca",
  "share_indep": "% programación Cineteca",
  "shows_vs": "Funciones Cinemex CDMX",
  "cinemas_vs": "Cines Cinemex CDMX",
  "subtitled": "Subtituladas",
  "spanish": "En español",
  "other": "Lengua original",
  "first_date": "Desde",
  "last_date": "Hasta",
  "slot": "Franja",
  "days": "Días",
  "share": "% de funciones",
  "ticket_price": "Boleto tradicional vie–dom",
  "ticket_sampled_at": "Boleto leído",
  "ticket_max": "Boleto más caro",
  "ticket_max_format": "Formato del más caro",
  "ticket_max_sampled_at": "Más caro leído",
  "popcorn_price": "Palomitas en sala",
  "occupancy_samples": "Funciones medidas",
  "taken_at": "Inicio",
  "finished_at": "Fin",
  "ok": "OK",
  "n_shows": "Funciones",
  "n_cinemas": "Cines",
  "n_events": "Eventos",
  "calls": "Llamadas",
  "duration_s": "Duración (s)",
  "error": "Error",
  "table_name": "Tabla",
  "size_bytes": "Tamaño",
  "key": "Trabajo",
  "area": "Área",
  "schedule": "Horario",
  "timeout_min": "Tope (min)",
  "last_started_at": "Última corrida",
  "last_status": "Resultado",
  "last_duration_s": "Duración (s)",
  "last_max_rss_mb": "Memoria (MB)",
  "runs": "Corridas",
  "failures": "Fallidas",
  "peak_rss_mb": "Memoria pico (MB)",
  "unit": "Unidad",
  "label": "Alcance",
  "last_at": "Última captura",
  "last_ok": "OK",
  "last_error": "Último error",
  "avg_calls": "Llamadas (media)",
  "avg_duration_s": "Duración media (s)",
  "avg_shows": "Funciones (media)",
  "day": "Día",
  "slot_label": "Franja",
  "dimension": "Dimensión",
  "bucket": "Categoría",
  "chain_label": "Cadena",
  "status_label": "Estado",
  "value": "Valor"
} as const;

export const DAY_TYPE_LABEL = {
  "weekday": "Lunes y jueves",
  "promo": "Martes y miércoles",
  "weekend": "Viernes a domingo"
} as const;

export const AVAILABILITY_LABEL = {
  "#FFBE06": "Amarillo",
  "#FF804A": "Naranja",
  "#A2ACBA": "Gris",
  "(sin color)": "Sin color",
  "high": "Alta disponibilidad",
  "mid": "Media",
  "low": "Baja"
} as const;

export const SEATS_CHART_TEXT = {
  "title": "Funciones frente a butacas por película ({chain})",
  "axis": "% del total de {chain} en el periodo",
  "measure": "Medida",
  "share": "%"
} as const;

export const CARTELERA_TEXT = {
  "no_db": "Aún no hay datos: la base {path} no existe. La cartelera se captura a las {times}; la siguiente captura es a las {next} y tarda de 15 a 30 minutos. Para no esperar: `make snapshot` (o `systemctl start absolut-cinema-snapshot.service` en el servidor), o copia `data/` desde la máquina donde ya corre. Esta página se refresca sola.",
  "no_db_web": "Aún no hay datos: la base de la cartelera no existe todavía. La primera captura tarda de 15 a 30 minutos. Para no esperar: `make snapshot` (o `systemctl start absolut-cinema-snapshot.service` en el servidor).",
  "no_shows": "La base existe pero todavía no tiene funciones capturadas. Revisa `data/logs/run.log`.",
  "no_board": "No hay cartelera publicada de ambas cadenas para {range}.",
  "meta_period": "Periodo:",
  "stale_none": "No hay ninguna captura buena de {name}.",
  "stale_error": "La última captura de {name} falló y el dato vigente tiene {age} minutos. Detalle técnico: {error}",
  "stale_old": "El dato de {name} tiene {age} minutos sin actualizarse; el scraper puede estar detenido.",
  "hours_header": "Franja horaria",
  "hours_free": "Rango libre",
  "hours_from": "Desde",
  "hours_to": "Hasta",
  "suggestions": "Qué sugerimos",
  "no_findings": "Ninguna diferencia cruza el umbral de relevancia en este periodo. La evidencia completa está en la Capa 2.",
  "empty_period": "Sin funciones en el periodo.",
  "q_resumen": "¿Cómo se reparte la programación de la semana?",
  "resumen_headers": [
    "",
    "Película",
    "Cines Cinemex",
    "Funciones",
    "% cadena",
    "Cines Cinépolis",
    "Funciones",
    "% cadena",
    "Δ funciones",
    "Δ pp",
    "Cinépolis / Cinemex"
  ],
  "resumen_rest": "Resto",
  "resumen_total": "Total de programación",
  "leer_resumen": "Es la tabla del reporte diario, calculada para la Ciudad de México y la semana de cine (jueves a miércoles) del periodo elegido; el reporte del cliente es nacional y por semana calendario, así que las cifras no coinciden. Por cadena: cines que exhiben la película, funciones y qué parte de la programación de esa cadena representan. Δ funciones es Cinemex menos Cinépolis; Δ pp, la diferencia entre participaciones; la última columna, cuántas funciones pone Cinépolis por cada una nuestra. \"Resto\" agrupa las demás películas (sus cines no se suman porque se repiten). La pestaña de las 6 PM cuenta solo funciones que empiezan de 6:00 P.M. en adelante y no depende del filtro de franja de la barra lateral. Con el día en curso solo cuentan funciones que no han empezado.",
  "q_peliculas": "¿A qué películas les damos más pantalla que Cinépolis?",
  "peliculas_axis": "% de las funciones del periodo",
  "peliculas_all": "Ver las {n} películas",
  "peliculas_tooltip": "{title} · {chain}: {share} % de su programación · {shows} funciones · {cinemas} cines",
  "leer_peliculas": "Cada fila es una película; los puntos son el porcentaje de la programación que le dedica cada cadena y la línea entre ellos, la diferencia (rojo: Cinemex apuesta más). Un solo punto es una exclusiva. Se ordenan por tamaño de la diferencia entre las {total} películas con más funciones del periodo. Los títulos se emparejan aunque cada cadena los escriba distinto (reestrenos, aniversarios, eventos en vivo, variantes de formato como Infinity Vision), con reglas explícitas y una tabla de equivalencias revisada a mano.",
  "q_horarios": "¿Estamos en el horario donde vive la taquilla?",
  "horarios_tooltip": "{day} · {slot} · % parrilla Cinemex {share_cinemex} · % parrilla Cinépolis {share_cinepolis} · Δ pp {gap} · Funciones Cinemex {shows_cinemex} · Funciones Cinépolis {shows_cinepolis}",
  "leer_horarios": "Cada celda es la diferencia, en puntos porcentuales, entre la parte de parrilla que Cinemex pone en esa franja y la que pone Cinépolis. Rojo: ponemos más; oscuro: pone más Cinépolis. Solo aparecen los días del periodo elegido; la semana se completa cuando ambas cadenas la publican (miércoles o jueves). La ocupación real por franja se añadirá con el muestreo de asientos.",
  "q_formatos": "¿Con qué formatos e idiomas competimos?",
  "leer_formatos": "Cada barra es el 100 % de las funciones de una cadena en el periodo. Premium / VIP agrupa Premium, Platino, VIP y Confort; Gran formato agrupa IMAX, XE, ScreenX, Dolby Atmos y Jumbo. “Español” incluye doblada y en español original.",
  "q_preventa": "¿Qué preventa se está vendiendo?",
  "preventa_empty": "Aún no hay lecturas de preventa en esta zona. El pase corre a diario sobre los títulos en preventa de ambas cadenas, en las plazas donde se leen planos.",
  "preventa_both": "<b>En preventa en ambas cadenas</b>: la comparación directa.",
  "preventa_single": "<b>En preventa en una sola cadena</b>: “exclusiva” si la otra no lo tiene en su cartelera; “la otra lo exhibe” si lo programa sin anunciarlo como preventa.",
  "curve_pick": "Curva de venta de",
  "curve_pending": "La curva aparece cuando el título tiene lecturas a distintas distancias de su función.",
  "leer_preventa": "Son los títulos en preventa de cada cadena: la página de preventas de Cinemex y la de \"Próximamente\" de Cinépolis, hasta su estreno (en un evento de una noche, hasta que empieza). Arriba, los títulos que las dos cadenas tienen en preventa; abajo, los de una sola, marcados como exclusiva cuando la otra cadena no los tiene en su cartelera de la zona. Por cadena, cada título tiene un panel fijo de hasta 30 funciones repartidas entre cines y cada día se lee su plano de asientos. La barra es el % de las butacas de ese panel que ya se vendieron, así una sala IMAX no pesa más que una tradicional y las dos cadenas se comparan aunque tengan salas de distinto tamaño. Desde la segunda lectura se mide el ritmo: cuántos puntos de su aforo vende cada día (en el detalle al pasar el cursor). La curva junta todas las lecturas del título según cuántos días faltaban para la función. Las funciones de Cinépolis cuyo plano responde \"ya no está disponible\" antes de empezar no entran: coinciden con funciones casi agotadas, así que su % vendido real puede ser algo mayor.",
  "kpis_title": "Indicadores del periodo",
  "kpis_summary": "{us} vs {them} funciones por cine y día",
  "kpis_summary_seats": " · {us} vs {them} butacas ofertadas",
  "kpis_headers": [
    "Indicador",
    "Cinemex",
    "Cinépolis",
    "Δ"
  ],
  "kpi": {
    "shows_per_cinema": "Funciones por cine y día",
    "shows": "Funciones publicadas",
    "cinemas": "Cines con cartelera",
    "prime": "Share de horario prime (vie–dom desde 6 PM)",
    "evening": "Share de 6 PM en adelante",
    "subtitled": "Share de funciones subtituladas",
    "movies": "Títulos distintos en cartelera",
    "seats_offered": "Butacas ofertadas",
    "seats_per_show": "Butacas por función",
    "top3": "Peso de las 3 películas más programadas",
    "hhi": "Índice de concentración (HHI)",
    "titles_per_cinema": "Títulos distintos por complejo"
  },
  "kpis_note": "Las diferencias entre porcentajes van en puntos porcentuales; las de cantidades, en % relativo. Butacas ofertadas = aforo de la sala por cada función del periodo (máximo de boletos vendibles), no butacas físicas. HHI: suma de los cuadrados del share de cada título; por debajo de 1,500 la parrilla está repartida, por encima de 2,500 concentrada.",
  "cambios_title": "¿Cómo ha movido Cinépolis su cartelera esta semana?",
  "cambios_summary": "7 días: {us_removed} canceladas nuestras vs {them_removed} de Cinépolis · {us_moved} vs {them_moved} cambios de horario o sala",
  "cambios_none": "Sin cambios en los últimos 7 días",
  "cambios_headers": [
    "Cadena",
    "Nuevas",
    "Canceladas",
    "Horario/sala",
    "Idioma/formato"
  ],
  "cambios_note_lead": "Últimos 7 días.",
  "cambios_note_tail": "Cuando una cadena publica la semana siguiente (miércoles o jueves) aparecen miles de funciones nuevas de golpe; eso es publicación, no cambios sobre lo ya anunciado. Se lee como comportamiento semanal del competidor (cuánto cancela, de qué títulos, cuándo publica), no como alerta: la programación se decide por semana de cine.",
  "cambios_log": "Registro por función",
  "cambios_empty": "Sin cambios de ese tipo.",
  "precios_title": "Precio del boleto por formato y tipo de día",
  "precios_pair": "{format} {day}: ${us} vs ${them}",
  "precios_markup": "Cinépolis cobra {min}–{max} % más en tradicional, premium y gran formato",
  "precios_headers": [
    "Formato",
    "Tipo de día",
    "Cinemex",
    "Cinépolis",
    "Δ Cinépolis vs Cinemex"
  ],
  "precios_cinemas": "{chain}: {n} cines",
  "precios_note": "Mediana del boleto de adulto regular entre los cines muestreados ({cinemas}). Una función por cine, formato y tipo de día, renovada cada semana. Martes y miércoles son los días de precio reducido en ambas cadenas. Precios en pesos, sin cargo por servicio. Se excluyen eventos y matinés.",
  "butacas_title": "Salas y butacas por complejo",
  "butacas_summary": "{chain}: {screens} salas, {seats} butacas, sala típica de {avg}",
  "butacas_headers": [
    "Cadena",
    "Complejos",
    "Salas",
    "Butacas",
    "Sala típica",
    "Más chica",
    "Más grande",
    "Salas < 80 (VIP)"
  ],
  "butacas_note": "Aforo medido una vez por sala en el plano de asientos de la función más próxima (se excluyen asientos fuera de servicio). Butacas físicas, no ofertadas.",
  "chain": "Cadena",
  "butacas_empty": "Sin funciones con aforo conocido en el periodo.",
  "butacas_chart_note": "El círculo claro es la parte de las funciones de la cadena que ocupa la película; el cuadro, la parte de sus butacas ofertadas. Cuando el cuadro queda a la derecha, la película va en salas más grandes que el promedio.",
  "historia_title": "Historial de una función y cartelera tal como estaba",
  "historia_summary": "elige cine, fecha y sala · historia desde el {date}",
  "historia_lead": "Qué le pasó a cada función (cuándo se publicó, cambios de hora, sala, idioma o formato, cancelación) y cómo estaba la cartelera de esa sala en cualquier captura anterior. La reconstrucción es exacta desde el 9 de septiembre de 2026; antes, las funciones ya concluidas no dejaban rastro.",
  "cinema": "Cine",
  "date": "Fecha",
  "screen": "Sala",
  "all_screens": "Todas",
  "no_functions": "Sin funciones conocidas para ese cine y fecha.",
  "functions_count": "Funciones conocidas · {n}",
  "functions_status": "({current} vigentes, {removed} canceladas, {expired} concluidas)",
  "function": "Función",
  "function_option": "{time} · sala {screen} · {title}",
  "timeline": "Línea de tiempo de la función",
  "timeline_empty": "Sin eventos registrados para esta función.",
  "timeline_headers": [
    "Cuándo",
    "Qué pasó",
    "Detalle"
  ],
  "timeline_change": "{field}: {before} → {after}",
  "board_title": "Cartelera de la sala tal como estaba en una captura",
  "board_few": "Hace falta más de una captura desde que se publicó la función para reconstruir la cartelera.",
  "board_capture": "Captura",
  "board_empty": "En esa captura no había funciones publicadas para esta sala y fecha.",
  "board_note": "\"Frente a hoy\" compara cada función con la cartelera vigente: igual, cambió después (y en qué) o ya no está publicada. Mueve el control para ver la cartelera en capturas anteriores."
} as const;

export const DATE_TEXT = {
  "weekdays": [
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
    "domingo"
  ],
  "months": [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre"
  ],
  "am": "A.M.",
  "pm": "P.M.",
  "date": "{weekday} {day} de {month}",
  "with_year": "{date} de {year}",
  "range": "del {d0} al {d1}",
  "weekdays_short": [
    "lun",
    "mar",
    "mié",
    "jue",
    "vie",
    "sáb",
    "dom"
  ],
  "months_short": [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic"
  ]
} as const;

export const HOURS_TEXT = {
  "opening": "apertura",
  "midnight": "medianoche",
  "full_day": "Todo el día",
  "from": "de {h0} en adelante",
  "until": "antes de {h1}",
  "range": "de {h0} a {h1}"
} as const;

export const ROLE_LABEL = {
  "staff": "Equipo de la plataforma",
  "admin": "Administrador",
  "analyst": "Analista",
  "viewer": "Consulta"
} as const;

export const ROLE_HELP = {
  "staff": "Ve todos los módulos, todas las cuentas y Operaciones.",
  "admin": "Gestiona las cuentas y el logo de la organización, y descarga.",
  "analyst": "Ve, filtra, descarga CSV y PNG e imprime.",
  "viewer": "Ve y filtra, sin descargar ni imprimir."
} as const;

export const AUTH_TEXT = {
  "app_name": "Absolut Cinema",
  "login_title": "Entrar",
  "login_lead": "Inteligencia de cartelera de Cinemex frente a Cinépolis.",
  "email": "Correo",
  "password": "Contraseña",
  "password_confirm": "Confirma la contraseña",
  "enter": "Entrar",
  "forgot": "¿Olvidaste tu contraseña?",
  "back_to_login": "Volver a entrar",
  "logout": "Cerrar sesión",
  "forgot_title": "Restablecer contraseña",
  "forgot_lead": "Escribe tu correo y te enviaremos un enlace para elegir una contraseña nueva.",
  "send_link": "Enviar enlace",
  "forgot_done": "Si el correo está registrado, en unos minutos recibirás un enlace. Revisa también la carpeta de spam.",
  "reset_title": "Elige tu contraseña nueva",
  "invite_title": "Bienvenido: elige tu contraseña",
  "reset_lead": "Para la cuenta {email}. Mínimo 12 caracteres.",
  "save_password": "Guardar contraseña",
  "reset_done": "Contraseña guardada. Ya puedes entrar con ella.",
  "password_mismatch": "Las contraseñas no coinciden.",
  "password_short": "La contraseña debe tener al menos 12 caracteres.",
  "password_is_email": "La contraseña no puede ser tu correo.",
  "token_missing": "Este enlace no es válido. Pide uno nuevo desde “¿Olvidaste tu contraseña?”.",
  "signed_in_as": "Sesión de",
  "continue": "Si la página no se recarga sola, continúa aquí.",
  "db_unavailable": "El acceso no está disponible en este momento. Inténtalo en unos minutos.",
  "InvalidCredentials": "Correo o contraseña incorrectos.",
  "AccountInactive": "Correo o contraseña incorrectos.",
  "AccountLocked": "Demasiados intentos. Vuelve a intentarlo en {minutes} minutos.",
  "TokenInvalid": "Este enlace ya no sirve: caducó o ya se usó. Pide uno nuevo desde “¿Olvidaste tu contraseña?”.",
  "WeakPassword": "La contraseña no cumple la regla mínima.",
  "DuplicateEmail": "Ya existe una cuenta con ese correo.",
  "LastAdmin": "No puedes dejar la organización sin administradores.",
  "SelfChange": "No puedes cambiar tu propia cuenta desde aquí.",
  "WrongPassword": "La contraseña actual no es correcta.",
  "InvalidImage": "La imagen debe ser PNG, JPEG o WebP.",
  "users_title": "Usuarios",
  "new_account": "Nueva cuenta",
  "name": "Nombre",
  "role": "Rol",
  "create_and_invite": "Crear y enviar invitación",
  "invite_sent": "Invitación enviada a {email}.",
  "invite_link_console": "Correo en modo consola: comparte este enlace con la persona.",
  "manage_account": "Administrar una cuenta",
  "pick_account": "Cuenta",
  "deactivate": "Desactivar",
  "activate": "Reactivar",
  "resend_link": "Reenviar enlace",
  "change_role": "Cambiar rol",
  "done": "Listo.",
  "mail_failed": "La cuenta quedó creada pero el correo no salió: {error}. Usa “Reenviar enlace” más tarde.",
  "session_expired": "Tu sesión terminó. Vuelve a entrar.",
  "admin_only": "Solo los administradores pueden ver esta página.",
  "staff_only": "Solo el equipo de la plataforma puede ver esta página.",
  "module_locked": "Tu organización no tiene este módulo.",
  "download_locked": "Tu rol no permite descargar.",
  "deactivate_confirm": "{name} ya no podrá entrar hasta que reactives su cuenta.",
  "cancel": "Cancelar",
  "settings_title": "Configuración",
  "profile": "Perfil",
  "avatar": "Foto de perfil",
  "upload_image": "Subir imagen",
  "remove_image": "Quitar",
  "theme": "Tema",
  "save": "Guardar",
  "saved": "Cambios guardados.",
  "change_email": "Cambiar correo",
  "new_email": "Correo nuevo",
  "current_password": "Contraseña actual",
  "change_password": "Cambiar contraseña",
  "new_password": "Contraseña nueva",
  "password_changed": "Contraseña cambiada. Las demás sesiones se cerraron.",
  "logo": "Logo de la empresa",
  "logo_help": "Aparece en la navegación de todas las cuentas."
} as const;

export const THEME_LABEL = {
  "system": "Como el sistema",
  "light": "Claro",
  "dark": "Oscuro"
} as const;

export const MAIL_INVITE = {
  "subject": "Tu acceso a Absolut Cinema",
  "text": "Hola {name}:\n\nTe creamos una cuenta en Absolut Cinema, el tablero de cartelera de Cinemex frente a Cinépolis. Elige tu contraseña en este enlace (vale {hours} horas):\n\n{link}\n\nSi no esperabas este correo, ignóralo.\n",
  "html": "<p>Hola {name}:</p><p>Te creamos una cuenta en <b>Absolut Cinema</b>, el tablero de cartelera de Cinemex frente a Cinépolis. Elige tu contraseña en este enlace (vale {hours} horas):</p><p><a href=\"{link}\">{link}</a></p><p>Si no esperabas este correo, ignóralo.</p>"
} as const;

export const MAIL_RESET = {
  "subject": "Restablecer tu contraseña de Absolut Cinema",
  "text": "Hola {name}:\n\nPediste restablecer tu contraseña. Elige una nueva en este enlace (vale {minutes} minutos y solo una vez):\n\n{link}\n\nSi no fuiste tú, ignora este correo: tu contraseña no cambia.\n",
  "html": "<p>Hola {name}:</p><p>Pediste restablecer tu contraseña. Elige una nueva en este enlace (vale {minutes} minutos y solo una vez):</p><p><a href=\"{link}\">{link}</a></p><p>Si no fuiste tú, ignora este correo: tu contraseña no cambia.</p>"
} as const;

export const MAIL_INTEREST = {
  "module": {
    "subject": "{org} pidió {module}",
    "text": "{name} ({email}), de {org}, quiere conocer el módulo {module} de Absolut Cinema.\n"
  },
  "sales": {
    "subject": "{org} quiere hablar con Ventas",
    "text": "{name} ({email}), de {org}, pidió que Ventas le escriba.\n"
  }
} as const;

export const DATASET_LABEL = {
  "cinemas": "Cines y salas",
  "auditoriums": "Salas y aforo",
  "week_showtimes": "Funciones de la semana",
  "ticket_prices": "Precio del boleto",
  "concession_prices": "Dulcería en sala (Cinépolis)",
  "delivery_prices": "Dulcería a domicilio"
} as const;

export const DATA_TEXT = {
  "title": "Datos",
  "dataset": "Tabla",
  "chain": "Cadena",
  "cinemas": "Cines",
  "dates": "Fechas",
  "platform": "Plataforma",
  "category": "Categoría",
  "all": "Todas",
  "search": "Buscar",
  "search_help": "Parte del nombre, sin distinguir mayúsculas ni acentos. En funciones, de la película o del cine.",
  "only_open": "Solo funciones vigentes",
  "latest_only": "Solo la última lectura de cada producto",
  "format": "Formato",
  "day_type": "Tipo de día",
  "page": "{first}–{last} de {total}",
  "previous": "Página anterior",
  "next": "Página siguiente",
  "page_size": "Renglones por página",
  "page_size_value": "{n} por página",
  "download": "Descargar CSV",
  "empty": "No hay renglones con esos filtros.",
  "no_history": "El archivo histórico aún no tiene esta tabla poblada.",
  "money": "${v}",
  "cinema_option": "{chain} · {cinema}"
} as const;

export const INDEP_TEXT = {
  "nav": "Independientes",
  "title": "Oferta independiente: la <span>Cineteca Nacional</span>",
  "meta_period": "Periodo",
  "meta_note": "Fuera de los shares frente a Cinépolis: cine de autor, un solo precio",
  "no_db": "Aún no hay datos: la base no existe todavía. Ver la página de cartelera.",
  "no_plaza": "La Cineteca solo tiene sedes en CDMX. Elige CDMX o Nacional en la zona para ver su oferta.",
  "no_data": "No hay cartelera de la Cineteca publicada para {period}. Se captura con la cartelera, tres veces al día.",
  "period_header": "Periodo",
  "period_today": "Hoy",
  "period_tomorrow": "Mañana",
  "period_week": "Resto de la semana de cine (hasta el {d1})",
  "period_pick": "Elegir fechas",
  "period_range": "Del … al …",
  "period_caption": "La Cineteca publica su cartelera hasta el miércoles de la semana en curso.",
  "layer1_none": "Ningún título de la Cineteca cruza el umbral: llenar {pct} % de sus butacas en al menos {n} funciones medidas sin que lo exhibamos en CDMX.",
  "layer1_pending": "El hallazgo se enciende cuando esté confirmada la lectura de las ventas en los planos de la Cineteca.",
  "q_programa": "¿Qué programa la Cineteca en este periodo?",
  "q_ocupacion": "¿Cuánto se llena?",
  "q_solape": "¿Compite con nuestra cartelera?",
  "q_franjas": "¿A qué horas programa?",
  "programa_chart": "Títulos con más funciones, en % de su programación",
  "programa_note": "Cada sede cuenta sus funciones; el título agrupa las versiones doblada y subtitulada.",
  "ocupacion_pending": "Pendiente: falta confirmar cómo marca el plano de asientos de la Cineteca una butaca vendida. Las butacas no vendibles ya se leen bien; se desbloquea con uno o dos días de planos de funciones con venta. Cada función medida guarda sus vendidas y sus no vendibles, así que se recalcula sin volver a pedir el plano.",
  "ocupacion_few": "Pendiente: hay {n} funciones medidas de la Cineteca en la última semana; hacen falta {min} para leer su ocupación.",
  "ocupacion_chart": "% de butacas vendidas por sede y franja, última semana",
  "ocupacion_titles": "Títulos con más ocupación",
  "solape_chart": "Sus títulos con más funciones, según si también los exhibimos en CDMX",
  "solape_only": "Solo en la Cineteca: la oportunidad",
  "franjas_chart": "% de la programación de cada cadena por franja",
  "status": {
    "shared": "También en Cinemex",
    "indep_only": "Solo en la Cineteca"
  },
  "leer_programa": "Cada barra es la parte de las funciones de la Cineteca en el periodo que se lleva un título, sumando sus tres sedes (Chapultepec, de las Artes y México). La Cineteca marca el idioma en el título (DOB, SUB); aquí se agrupan las versiones de una misma película. \"Lengua original\" son las funciones sin marca de idioma, lo normal en su cartelera. Para hoy solo se cuentan funciones que aún no empiezan.",
  "leer_ocupacion": "La ocupación se lee del plano de asientos de cada función entre 15 y 75 minutos después de empezar: la asistencia final. Se pondera por butacas, así una sala grande pesa más. La sala sale del plano, no de la cartelera, que no la publica.",
  "leer_solape": "Una película de la Cineteca cuenta como \"También en Cinemex\" si en el mismo periodo tenemos al menos una función de ella en algún cine de CDMX. Las películas se emparejan por título con las mismas reglas que Cinemex y Cinépolis. Mucho cine de autor no tiene pareja en nuestra cartelera: es el dato, no un error.",
  "leer_franjas": "Cada barra es la parte de la programación de cada cadena que empieza en esa franja, en % de sus propias funciones del periodo: la Cineteca contra Cinemex en CDMX. No se compara con Cinépolis ni entra a los shares de la cartelera.",
  "app_board": "Cartelera completa del periodo",
  "app_board_summary": "{titles} títulos · {shows} funciones",
  "app_capacity": "Aforo por sala",
  "app_capacity_summary": "{screens} salas medidas en {cinemas} sedes",
  "app_capacity_empty": "Aún no hay salas medidas: el aforo sale del plano de las funciones que ya empezaron.",
  "app_pending": "Pendientes",
  "app_pending_summary": "precio del boleto y sala en la cartelera",
  "pending_items": [
    "**Precio del boleto.** No se captura todavía. El boleto general está en la página de compra de la Cineteca, que pide una cookie de sesión; se desbloquea al darle manejo de cookies a la captura o al verificar el servicio de boletos de su taquilla en línea. Sin cifra hasta capturarlo.",
    "**Sala en la cartelera.** La cartelera pública no dice en qué sala es cada función; la sala solo llega del plano de asientos, así que el aforo ofertado por título no se puede calcular como en las cadenas."
  ],
  "back": "Volver a la cartelera",
  "footer": "Fuentes: cartelera pública de la Cineteca Nacional (sedes Chapultepec, de las Artes y México), capturada con la cartelera de las cadenas tres veces al día; ocupación leída del plano de asientos de cada función después de empezar. Historia desde el {first}."
} as const;

export const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron" as const;

export const MAP_ATTRIBUTION = "© <a href=\"https://openfreemap.org\">OpenFreeMap</a> © <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>" as const;

export const MAP_METRIC = {
  "shows": [
    "Funciones",
    "{:,.0f}",
    "Más funciones"
  ],
  "screens": [
    "Salas",
    "{:,.0f}",
    "Más salas"
  ],
  "seats": [
    "Butacas",
    "{:,.0f}",
    "Más butacas"
  ],
  "ticket_price": [
    "Boleto tradicional, vie–dom",
    "${:,.0f}",
    "Boleto más barato"
  ],
  "ticket_max": [
    "Boleto más caro",
    "${:,.0f}",
    "Boleto más caro"
  ],
  "popcorn_price": [
    "Palomitas en sala",
    "${:,.0f}",
    "Palomitas más baratas"
  ],
  "sold_pct": [
    "% de butacas vendidas",
    "{:.1f} %",
    "Más lleno"
  ]
} as const;

export const MAP_TEXT = {
  "nav": "Mapa",
  "title": "Mapa de cines: <span>Cinemex</span>, Cinépolis y la Cineteca",
  "meta_period": "Funciones",
  "no_db": "Aún no hay datos: la base no existe todavía. Ver la página de cartelera.",
  "empty": "No hay cines con coordenadas en esta zona.",
  "size_by": "Tamaño del punto",
  "size_help": "El tamaño del punto sigue la métrica elegida; un cine sin ese dato queda como punto chico y tenue.",
  "chains": "Cadenas",
  "no_chains": "Elige al menos una cadena en la barra lateral.",
  "cinemas": "Cines",
  "cinemas_help": "Escribe parte del nombre para buscar; puedes elegir varios. Vacío muestra todos.",
  "filtered": "{n} de {total} cines",
  "highlights": "Destacados de la zona",
  "highlights_desc": "El cine que destaca en cada métrica, dentro de su cadena; entre paréntesis, cuántos cines tienen el dato.",
  "map": "Los cines en el mapa",
  "map_desc": "Pasa el cursor sobre un punto para ver su ficha; haz clic para fijarla abajo. Cuando una plaza tiene varios cines de la misma cadena (el complejo y su sala Platino o VIP), sus puntos se abren alrededor del edificio y comparten ficha, para compararlos lado a lado.",
  "detail": "Ficha del cine",
  "site_count": "{n} cines en esta plaza",
  "detail_hint": "Haz clic en un cine del mapa para ver su ficha.",
  "table": "Todos los cines de la zona",
  "no_value": "sin dato",
  "sampled": "leído el {date}",
  "popcorn_note": "Cinemex cobra la misma dulcería en todos sus cines, así que las palomitas por complejo solo existen en Cinépolis.",
  "leer": "Cada punto es un complejo, en su color de cadena: Cinemex en rojo, Cinépolis en tinta y la Cineteca en gris. Las funciones son las publicadas de hoy al miércoles (semana de cine), sin las que ya empezaron. Salas y butacas salen del plano de asientos, medido una vez por sala. El boleto es el general de formato tradicional de viernes a domingo, la lectura más reciente de cada cine (sin eventos ni matinés), para que dos cines sean comparables. El boleto más caro es el general más alto del cine en cualquier formato (VIP, gran formato, 3D o 4D) y cualquier día, con su formato entre paréntesis. La ocupación es el % de butacas vendidas en las funciones medidas después de empezar en los últimos 7 días, solo en cines con al menos 10 funciones medidas. El tamaño del punto es la métrica elegida, relativa al cine con el valor más alto de los que se ven; no cambia con el zoom. Los cines que comparten edificio se dibujan un poco separados de su ubicación real para que se vean todos.",
  "footer": "Fuentes: cartelera pública de Cinemex, Cinépolis y la Cineteca Nacional; planos de asientos; precios de lista muestreados por cine; menú de dulcería en línea de Cinépolis. Mapa base © OpenFreeMap y OpenStreetMap."
} as const;

export const RECOMMEND_SORT = {
  "distance": "Más cerca",
  "price": "Más barato",
  "time": "Más pronto"
} as const;

export const SNACK_LABEL = {
  "none": "Sin dulcería",
  "best": "Lo más barato para el grupo",
  "popcorn": "Palomitas y refresco por persona",
  "combo_1": "Un combo por persona",
  "combo_2": "Un combo cada dos",
  "combo_3": "Un combo cada tres",
  "combo_4": "Un combo cada cuatro"
} as const;

export const SNACK_SINGLE = "Palomitas y refresco" as const;

export const PROMO = {
  "cmx_lunes": [
    "Combo Lunes",
    "combo",
    "2 boletos 2D, palomitas grandes y 2 refrescos grandes",
    "loop",
    "Uno por cuenta."
  ],
  "cmx_individual_lunes": [
    "Combo Individual Lunes",
    "combo",
    "1 boleto 2D, palomitas medianas, refresco mediano y nachos con queso",
    "loop",
    "Uno por cuenta."
  ],
  "cmx_martes_2x1": [
    "Martes 2x1",
    "2x1",
    "Un boleto gratis por cada boleto igual que compras",
    "loop",
    "Hasta 3 por cuenta. Sin 3D, IMAX, 4D ni Atmos."
  ],
  "cmx_martes_pareja": [
    "Combo Martes Pareja",
    "combo",
    "2 boletos 2D, palomitas grandes, 2 refrescos medianos y un Snickers",
    "loop",
    "Uno por cuenta."
  ],
  "cmx_martes_individual": [
    "Combo Martes Individual",
    "combo",
    "1 boleto 2D, palomitas medianas, refresco mediano y un hot dog",
    "loop",
    "Uno por cuenta."
  ],
  "cmx_miercoles": [
    "Combo Miércoles",
    "combo",
    "2 boletos 2D, palomitas grandes y 2 refrescos grandes",
    "loop",
    "Uno por cuenta."
  ],
  "cmx_individual_miercoles": [
    "Combo Individual Miércoles",
    "combo",
    "1 boleto 2D, palomitas medianas, refresco mediano y nachos con queso",
    "loop",
    "Uno por cuenta."
  ],
  "cmx_jueves": [
    "Combo Jueves de Estreno",
    "combo",
    "2 boletos 2D, palomitas grandes y 2 refrescos grandes",
    "loop",
    "Uno por cuenta."
  ],
  "cmx_viernes": [
    "Combo Viernes",
    "combo",
    "2 boletos 2D, palomitas jumbo, 2 refrescos grandes y un Snickers",
    "loop",
    "Uno por cuenta."
  ],
  "cp_lunes": [
    "Combo Lunes",
    "combo",
    "2 boletos, palomitas jumbo y 2 refrescos jumbo",
    "club",
    "Uno por cuenta al día; se compra el mismo lunes."
  ],
  "cp_martes_2x1": [
    "Martes 2x1",
    "2x1",
    "2 boletos al precio de adulto más alto de la semana",
    "club",
    "Se compra el mismo martes."
  ],
  "cp_miercoles_2x1": [
    "Miércoles 2x1",
    "2x1",
    "2 boletos al precio de adulto más alto de la semana",
    null,
    "Solo en la app o la web de Cinépolis, el mismo miércoles."
  ]
} as const;

export const PROMO_PROGRAM = {
  "loop": [
    "Loop",
    "Cinemex Loop es el programa de lealtad de Cinemex. El nivel One es gratis y tiene los mismos combos y precios que los de pago."
  ],
  "club": [
    "Club Cinépolis",
    "Club Cinépolis es el programa de lealtad de Cinépolis. Registrarse es gratis."
  ]
} as const;

export const GROUP_LABEL = {
  "adults": [
    "adulto",
    "adultos"
  ],
  "children": [
    "niño",
    "niños"
  ],
  "seniors": [
    "adulto mayor",
    "adultos mayores"
  ]
} as const;

export const RECOMMEND_TEXT = {
  "nav": "¿A dónde ir?",
  "title": "¿A dónde ir? <span>Funciones</span> para tu grupo y tu presupuesto",
  "no_db": "Aún no hay datos: la base no existe todavía. Ver la página de cartelera.",
  "plan": "Tu plan",
  "plan_desc": "Dinos desde dónde sales, quiénes van y cuánto quieren gastar en total.",
  "address": "Dirección o lugar",
  "address_placeholder": "Ej. Av. Insurgentes Sur 3500, Coyoacán",
  "search": "Buscar",
  "locate": "Usar mi ubicación",
  "locating": "Pidiendo tu ubicación al navegador…",
  "locate_denied": "El navegador no compartió tu ubicación. Escribe una dirección o haz clic en el mapa.",
  "locate_https": "La ubicación del navegador solo funciona con HTTPS o en esta computadora (localhost).",
  "not_found": "No encontramos esa dirección. Prueba con calle y colonia, o haz clic en el mapa.",
  "geocoder_down": "El buscador de direcciones no respondió. Haz clic en el mapa para marcar tu punto.",
  "found": "Punto de partida: {label}",
  "from_click": "Punto de partida: el que marcaste en el mapa.",
  "from_device": "Punto de partida: tu ubicación actual.",
  "adults": "Adultos",
  "children": "Niños",
  "seniors": "Adultos mayores",
  "group_empty": "Agrega al menos una persona al grupo.",
  "budget": "Presupuesto total ($)",
  "budget_help": "Boletos más dulcería para todo el grupo; 0 es sin tope.",
  "snacks": "Dulcería",
  "when": "Cuándo",
  "today": "Hoy",
  "tomorrow": "Mañana",
  "pick": "Elegir fecha",
  "date": "Fecha",
  "more": "Más filtros",
  "hours": "Hora de inicio",
  "radius": "Distancia máxima (km)",
  "title_filter": "Película",
  "any_title": "Cualquier película",
  "formats": "Formato",
  "any_format": "Cualquier formato",
  "sort": "Ordenar por",
  "map": "Tu punto en el mapa",
  "map_desc": "Haz clic en el mapa para mover tu punto de partida; el círculo es la distancia máxima.",
  "no_location": "Escribe una dirección, usa tu ubicación o haz clic en el mapa para empezar.",
  "start": "Punto de partida",
  "results": "Funciones que te recomendamos",
  "summary_budget": "Para {group}, {shows} funciones en {cinemas} cines caben en tu presupuesto con {snacks}.",
  "summary_open": "Para {group}, hay {shows} funciones en {cinemas} cines a tu alcance con {snacks}.",
  "summary_best": " La más barata es {cheapest}: {cheapest_total} en total, a {cheapest_km}; la más cercana, {nearest} a {nearest_km}.",
  "summary_saving": " Eliges bien y ahorras {saving} frente a la más cara que cabe.",
  "none": "Ninguna función con costo completo cabe con esos filtros. Prueba con más distancia, otro horario, otra dulcería o más presupuesto.",
  "per_cinema_note": "Hasta {n} funciones por cine; ordena por hora para ver todas las del más cercano.",
  "snacks_unpriced": "Sin precio de dulcería en sala",
  "snacks_unpriced_desc": "Estas funciones caben en tu presupuesto solo en boletos: su cine no publica el precio de la dulcería en sala (Cinemex tiene apagada la venta de dulcería en línea), así que no sabemos el total y no las comparamos con las de arriba.",
  "col_cinema": "Cine",
  "col_title": "Película",
  "col_time": "Función",
  "col_format": "Formato",
  "col_language": "Idioma",
  "snack_reference": "ref. {price}",
  "snack_no_menu": "sin precio en sala",
  "col_tickets": "Boletos",
  "col_snacks": "Dulcería",
  "col_total": "Total",
  "col_distance": "Distancia",
  "col_promo": "Promoción",
  "promo_cell": "{name}{program}: {price} para {people}",
  "promo_in_total": "{name}{program}, en el total",
  "promo_program": " con {program}",
  "promo_range": "{low} o {high}",
  "promo_line": "{name}: {includes}. {condition}",
  "promo_note": "Si una promoción baja el costo del grupo, ya va en el total y en el presupuesto: supone que tienen la cuenta, que es gratis.",
  "km": "{km:.1f} km",
  "unpriced": "Funciones cercanas sin precio de boletos",
  "unpriced_summary": "{n} funciones",
  "unpriced_desc": "No hay lectura del boleto de su cine para ese formato y día; por eso no entran al presupuesto.",
  "leer": "Los boletos son los de lista más recientes del cine para ese formato y ese tipo de día (fin de semana, martes y miércoles de promoción, lunes y jueves), sin eventos ni matinés: adulto, niño y adulto mayor según el grupo; si la función no tiene boleto de niño o de adulto mayor, pagan el general. La dulcería es el precio del menú en sala de ese cine (tamaño base), que solo Cinépolis publica por complejo; sin paquete, la columna muestra como referencia palomitas y refresco para una persona. No incluye el cargo por servicio de la compra en línea. La distancia es en línea recta desde tu punto, no el tiempo de traslado. Para hoy solo aparecen funciones que aún no empiezan. En un empate, Cinemex va primero.",
  "footer": "Fuentes: cartelera pública de Cinemex, Cinépolis y la Cineteca Nacional; precios de lista muestreados por cine, formato y tipo de día; menú de dulcería en línea de Cinépolis. Direcciones: Nominatim © OpenStreetMap. Mapa base © OpenFreeMap y OpenStreetMap."
} as const;

export const OPS_TEXT = {
  "title": "Operaciones",
  "window": "Ventana",
  "hours": "{n} h",
  "all_ok": "Sin problemas en las últimas {hours} h.",
  "problems": "{n} problema(s) en las últimas {hours} h:",
  "checked_at": "Revisado",
  "ok": "OK",
  "failed": "Falló",
  "never": "Nunca",
  "ago": "hace {minutes} min",
  "ago_h": "hace {hours} h",
  "capture": "Captura de cartelera",
  "capture_lead": "Lo mismo que revisa scraper.health cada mañana, en vivo.",
  "signal": "Señal",
  "last_at": "Última captura",
  "last_age": "Antigüedad",
  "last_result": "Resultado",
  "last_shows": "Funciones leídas",
  "last_cinemas": "Cines leídos (máximo 7 días)",
  "captures": "Capturas en la ventana",
  "expected": "Programadas",
  "missing": "Programadas sin captura",
  "failed_runs": "Fallidas",
  "occ_t60": "Planos T−60",
  "occ_post": "Planos post-inicio",
  "prices_7d": "Precios (7 días)",
  "concessions_8d": "Cines con dulcería (8 días)",
  "delivery_8d": "Tiendas a domicilio (8 días)",
  "calibration": "Calibración del semáforo",
  "no_snapshots": "Sin capturas",
  "none": "Ninguna",
  "coverage": "Cobertura por ciudad y área",
  "coverage_lead": "Funciones vigentes y cines por cadena y llave geográfica de cada API (Cinépolis ciudad, Cinemex área), con la plaza a la que pertenecen. Es el registro para decidir qué plazas entran al muestreo de planos (AC_SEATS_PLAZAS).",
  "coverage_seats": "Planos de asientos acotados a: {plazas}",
  "coverage_no_plaza": "—",
  "jobs": "Trabajos programados",
  "jobs_lead": "Cada trabajo del registro (jobs/registry.py) con su horario y lo que dejó jobs.run en data/logs/jobs.jsonl: última corrida, fallos y el pico de memoria del paso más pesado. Sin corridas en la ventana, el trabajo no ha pasado por jobs.run en esta máquina.",
  "jobs_days": "Días",
  "jobs_status": {
    "ok": "OK",
    "failed": "Falló",
    "timeout": "Tope de tiempo",
    "skipped": "Ya corría"
  },
  "jobs_off": "Apagado",
  "runs": "Corridas recientes",
  "runs_lead": "Cada corrida de scraper.run por cadena: resultado, volumen, llamadas a la API y duración. El error literal cuando falló.",
  "runs_days": "Días",
  "runs_empty": "No hay corridas en ese rango.",
  "runs_chart_y": "Duración (s)",
  "runs_chart_x": "Captura",
  "runs_failed_legend": "Corrida fallida",
  "units": "Unidades de captura",
  "units_lead": "Cada captura se descarga por partes que fallan por separado: Cinemex por estado de su API, Cinépolis por lotes de hasta 30 cines agrupados por estado. Una unidad que falla conserva la cartelera anterior de sus cines (columna Conservadas) y no genera cambios. Las que fallaron recientemente van primero.",
  "units_empty": "Sin capturas por unidades en ese rango (existen desde el 2026-09-25).",
  "units_failed_now": "Falló en la última captura",
  "server": "Servidor y almacenamiento",
  "server_lead": "Commit en ejecución, último despliegue y respaldo, y cuánto ocupan las bases y el crudo.",
  "commit": "Commit",
  "no_git": "Sin información de git",
  "last_deploy": "Último despliegue",
  "last_backup": "Último respaldo",
  "no_line": "Sin registro en esta máquina",
  "db_file": "snapshots.db",
  "wal_file": "WAL pendiente",
  "app_db_file": "app.db (cuentas y sesiones)",
  "raw_dir": "Crudo (data/raw)",
  "backups_dir": "Respaldos locales",
  "disk_free": "Espacio libre en disco",
  "disk_free_value": "{free} de {total} · {dir}",
  "logs": "Registros",
  "logs_lead": "La cola de cada log de data/logs. La línea más reciente va al final.",
  "log": "Log",
  "lines": "Líneas",
  "log_empty": "Este log no existe todavía en esta máquina.",
  "log_meta": "{size} · última escritura {when}",
  "pending": "Lo que esta página aún no ve",
  "pending_lead": "Dos señales que hoy no se registran. Se declaran en vez de estimarse.",
  "pending_items": [
    [
      "Cambio en scraper/store.py",
      "Fallos por llamada a las APIs",
      "Los reintentos de scraper/http.py no se guardan; solo queda el resultado final de cada corrida. Contar 429, 403 del WAF o timeouts por cadena pide una tabla aditiva en SQLite."
    ],
    [
      "Permiso IAM cloudwatch:GetMetricData",
      "Métricas de la instancia RDS",
      "CPU, almacenamiento libre y conexiones vienen de CloudWatch. El servidor ya usa boto3 para SES; falta el permiso y una consulta cacheada."
    ]
  ]
} as const;

export const DISTRIBUTOR_TEXT = {
  "nav": "Distribuidoras",
  "title": "Distribuidoras",
  "q_gaps": "¿Con qué distribuidora se separa más nuestra programación de la de Cinépolis?",
  "question": "¿Cuántos cines, salas y funciones tiene cada distribuidora en cada cadena?",
  "no_data": "Sin funciones en el periodo.",
  "gap_axis": "% de las funciones del periodo",
  "gap_tooltip": "{distributor} · {chain}: {share} % de su programación · {shows} funciones",
  "leer_gaps": "Cada fila es una distribuidora; los puntos son el porcentaje de la programación que le dedica cada cadena y a la derecha, la diferencia (rojo: Cinemex le da más). Un solo punto es una distribuidora que la otra cadena no programa. Primero van las que programan ambas cadenas; al final, los programas propios. Las películas que cada cadena atribuye a una distribuidora distinta no entran.",
  "columns": {
    "distributor": "Distribuidora",
    "kind": "Tipo",
    "chain": "Cadena",
    "cinemas": "Cines",
    "share_cinemas": "% de cines",
    "screens": "Salas",
    "shows": "Funciones",
    "share_shows": "% de funciones",
    "large_shows": "Premium o gran formato"
  }
} as const;

export const DISTRIBUTOR_KIND_LABEL = {
  "distribuidor": "Distribuidora",
  "programa_propio": "Programa propio",
  "evento": "Evento",
  "sin_clasificar": "Sin clasificar",
  "sin_conciliar": "Sin conciliar"
} as const;

export const LAYER_TEXT = {
  "read_it": "Cómo leerla",
  "evidence": "Ver más"
} as const;

export const CINES_TEXT = {
  "q_ranking": "Venta por cine",
  "q_competitors": "Los Cinépolis más fuertes",
  "q_rivals": "Tu rival número uno, cine por cine",
  "axis": "% de butacas vendidas",
  "previous": "{days} días anteriores: {pct} %",
  "competitor_headers": [
    "",
    "Cinépolis",
    "Boletos",
    "% vendido",
    "Frente a los {days} días anteriores",
    "Nuestros cines a {km} km o menos"
  ],
  "rival_headers": [
    "Cinemex",
    "% vendido",
    "Su rival",
    "% vendido",
    "Diferencia",
    "Distancia",
    "Cinépolis cerca"
  ],
  "neighbor": "{name} {pct} %",
  "no_neighbors": "Ninguno",
  "more_neighbors": "+{n} más",
  "ahead": "cines que venden más que su rival",
  "km": "{km} km",
  "show_all": "Ver los {n} lugares de Cinépolis",
  "empty": "No hay planos medidos después del inicio en esta zona: solo se leen en las plazas de muestreo de planos.",
  "leer_ranking": "Cada función se lee una vez en el plano de asientos, entre 15 y 75 minutos después de empezar, en ambas cadenas y con la misma regla. El % vendido es butacas vendidas entre butacas medidas, de los últimos {days} días. Solo entran los cines con {min} funciones medidas o más.",
  "leer_competitors": "Cada lugar junta el complejo y su sala VIP, que comparten edificio. El orden por boletos vendidos compara a Cinépolis consigo mismo; contra nuestros cines se compara en % vendido, porque los cines tienen distinto tamaño.",
  "leer_rivals": "El rival de cada cine es el Cinépolis a {km} km o menos que más boletos vende, que no siempre es el más cercano. La línea une los dos % vendidos; el número de la derecha es la diferencia en puntos porcentuales."
} as const;

export const FINDING_UNIT = {
  "pct": "{value} %",
  "pp": "{value} pp",
  "pct_diff": "{value} %",
  "money": "${value}",
  "count": "{value}",
  "pace": "{value} % del aforo por día"
} as const;

export const FINDING_TEXT = {
  "versus": "frente a",
  "theme": "Tema",
  "up": "▲",
  "down": "▼"
} as const;

export const FINDING_THEME_LABEL = {
  "programacion": "Programación",
  "preventa": "Preventa",
  "precios": "Precios",
  "cines": "Cines",
  "dulceria": "Dulcería",
  "independientes": "Independientes"
} as const;

export const DOWNLOAD_TEXT = {
  "png": "Descargar PNG",
  "csv": "Descargar CSV",
  "data": "Ver datos",
  "chart": "grafica",
  "csv_headers": [
    "Concepto",
    "Cadena",
    "Valor",
    "Unidad"
  ]
} as const;

export const PAGE_LABEL = {
  "cartelera": "Cartelera",
  "programacion": "Programación semanal",
  "preventa": "Preventa",
  "precios": "Precios y butacas",
  "cines": "Cines",
  "historial": "Historial de funciones",
  "mapa": "Mapa",
  "recomendador": "¿A dónde ir?",
  "dulceria": "Dulcería",
  "independientes": "Independientes",
  "distribuidoras": "Distribuidoras",
  "datos": "Datos",
  "usuarios": "Usuarios",
  "operaciones": "Operaciones",
  "configuracion": "Configuración"
} as const;

export const MODULE_LABEL = {
  "cartelera": "Cartelera",
  "dulceria": "Dulcería",
  "datos": "Datos",
  "admin": "Administración"
} as const;

export const UPGRADE_TEXT = {
  "title": "{module} no está en tu plan",
  "sales_title": "Comunicarse con Ventas",
  "sales_body": "Ventas te escribe para ver qué módulos necesita tu organización.",
  "body": {
    "cartelera": "Compara la programación, la preventa, los precios y los cines de Cinemex y Cinépolis, con el mapa y la Cineteca.",
    "dulceria": "Compara los precios de dulcería en sala y a domicilio de Cinemex y Cinépolis.",
    "datos": "Explora y descarga las tablas completas de la captura. Viene en el plan Completo."
  },
  "cta": "Quiero conocerlo",
  "sent": "Listo. Ventas te escribirá pronto.",
  "close": "Cerrar",
  "locked": "No incluido en tu plan"
} as const;

export const NAV_LABEL = {
  "cartelera": "Hallazgos",
  "programacion": "Programación semanal",
  "preventa": "Preventa",
  "precios": "Precios y butacas",
  "cines": "Cines",
  "historial": "Historial de funciones",
  "mapa": "Mapa",
  "recomendador": "¿A dónde ir?",
  "dulceria": "En sala",
  "independientes": "Independientes",
  "distribuidoras": "Distribuidoras",
  "datos": "Datos",
  "usuarios": "Usuarios",
  "operaciones": "Operaciones",
  "configuracion": "Configuración",
  "domicilio": "A domicilio"
} as const;

export const SHELL_TEXT = {
  "search": "Buscar secciones",
  "no_results": "Ninguna sección coincide.",
  "account": "Cuenta",
  "notifications": "Preferencias de notificación",
  "language": "Preferencias de idioma",
  "appearance": "Aspecto",
  "shortcuts": "Atajos de teclado",
  "sales": "Comunicarse con Ventas",
  "upgrade": "Mejorar",
  "invite": "Cuéntale a un amigo",
  "shortcut_mac": "⌘K",
  "shortcut_other": "Ctrl K"
} as const;

export const HELP_TEXT = {
  "open": "Ayuda",
  "search": "Encuentra guías",
  "no_results": "Ninguna guía coincide.",
  "back": "Volver",
  "close": "Cerrar",
  "print": "Imprimir o guardar PDF"
} as const;

export const HELP_TOPICS = [
  {
    "key": "exportar",
    "title": "Exportar y compartir",
    "summary": "Lleva cifras y gráficas a Excel, Google Sheets o una presentación",
    "guides": [
      {
        "key": "excel",
        "title": "Exportar a Excel",
        "summary": "Cada gráfica y cada hallazgo se descargan como CSV.",
        "steps": [
          "Abajo de la gráfica o del hallazgo, elige «Descargar CSV».",
          "Abre el archivo con doble clic. Excel lee los acentos sin pasos extra.",
          "Para la tabla completa, usa Datos: el CSV trae todo lo filtrado, hasta 5,000 renglones."
        ]
      },
      {
        "key": "sheets",
        "title": "Exportar a Google Sheets",
        "summary": "Google Sheets importa el mismo CSV.",
        "steps": [
          "Descarga el CSV de la gráfica, del hallazgo o de Datos.",
          "En Google Sheets, abre Archivo › Importar › Subir y elige el archivo.",
          "Deja «Detectar automáticamente» como separador y elige dónde va la hoja."
        ]
      },
      {
        "key": "png",
        "title": "Llevar una gráfica a una presentación",
        "summary": "«Descargar PNG» guarda la gráfica como imagen a doble resolución.",
        "steps": [
          "Abajo de la gráfica, elige «Descargar PNG».",
          "Inserta la imagen en PowerPoint, Keynote o Google Slides."
        ]
      },
      {
        "key": "pdf",
        "title": "Imprimir o guardar en PDF",
        "summary": "El botón de la impresora en la barra superior imprime la pantalla completa.",
        "steps": [
          "Elige el botón de la impresora. La pantalla carga todas sus secciones primero.",
          "Para un PDF, elige «Guardar como PDF» como destino en el diálogo de impresión."
        ]
      },
      {
        "key": "link",
        "title": "Compartir una vista",
        "summary": "La zona, el periodo y la franja viajan en el enlace.",
        "steps": [
          "Elige los filtros en la barra de la pantalla.",
          "Copia la dirección del navegador y compártela.",
          "Quien la abre necesita su propia cuenta y ve la misma vista."
        ]
      }
    ]
  },
  {
    "key": "leer",
    "title": "Leer los datos",
    "summary": "Qué mide cada cifra y por qué se compara así",
    "guides": [
      {
        "key": "shares",
        "title": "Por qué todo está en porcentajes",
        "summary": "Cinemex y Cinépolis tienen distinto número de cines y salas. Un total engaña.",
        "steps": [
          "Cada cifra es el porcentaje de la programación de cada cadena.",
          "Las diferencias entre porcentajes están en puntos porcentuales (pp)."
        ]
      },
      {
        "key": "today",
        "title": "Por qué hoy no cuentan las funciones que ya empezaron",
        "summary": "Cinépolis borra cada función al empezar. Cinemex la conserva unas horas.",
        "steps": [
          "Para comparar parejo, el día en curso solo cuenta las funciones que aún no empiezan.",
          "La hora de inicio se compara en la zona horaria de cada cine."
        ]
      },
      {
        "key": "week",
        "title": "La semana de cine",
        "summary": "La semana va de jueves a miércoles, como la publican ambas cadenas."
      },
      {
        "key": "findings",
        "title": "Por qué una pantalla no muestra hallazgos",
        "summary": "Un hallazgo solo aparece si la diferencia cruza su umbral. Si ninguna lo cruza, la pantalla lo dice.",
        "steps": [
          "Prueba con otro periodo o con otra zona."
        ]
      },
      {
        "key": "cineteca",
        "title": "Dónde están la Cineteca y los independientes",
        "summary": "Tienen su propia página, Independientes. No entran a la comparación con Cinépolis."
      }
    ]
  },
  {
    "key": "usar",
    "title": "Usar el dashboard",
    "summary": "Filtros, búsqueda y aspecto",
    "guides": [
      {
        "key": "filters",
        "title": "Cambiar zona, periodo y franja",
        "summary": "La barra de la pantalla filtra todo lo que ves.",
        "steps": [
          "Zona: una plaza o todo el país.",
          "Periodo: el rango de fechas.",
          "Franja horaria: las horas de inicio de las funciones.",
          "Los filtros se conservan al cambiar de pantalla dentro de Cartelera y Dulcería."
        ]
      },
      {
        "key": "search",
        "title": "Ir rápido a una sección",
        "summary": "La búsqueda de la barra superior abre cualquier sección.",
        "steps": [
          "Usa ⌘K en Mac o Ctrl K en Windows.",
          "Escribe parte del nombre y elige la sección."
        ]
      },
      {
        "key": "appearance",
        "title": "Cambiar a tema oscuro",
        "summary": "En el menú de tu avatar, elige «Aspecto»."
      }
    ]
  }
] as const;
