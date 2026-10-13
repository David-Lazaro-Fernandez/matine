'use client';

// Pantallas de la Cartelera: Cinemex frente a Cinépolis, una pregunta por pantalla (`CarteleraView`).
// El encabezado (`GET /api/cartelera`) se pide al entrar; los hallazgos (`/cartelera/hallazgos`), solo en su pantalla.
// Cada sección y cada apéndice pide su endpoint (`/cartelera/seccion/{slug}`, `/cartelera/apendice/{slug}`) cuando se acerca a la
// pantalla. Los controles dentro de una sección piden su sub-endpoint (`/cartelera/curva`, `/cambios`, `/historia`).
import * as React from 'react';
import {
  Field,
  MessageBar,
  MessageBarBody,
  Slider,
  Subtitle2,
  Switch,
  Tab,
  TabList,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Clock20Regular, Filter20Regular } from '@fluentui/react-icons';
import { useSearchParams } from 'next/navigation';
import {
  Apendice,
  ApendiceAbierto,
  type Cell,
  type CellClass,
  Diferido,
  type Finding,
  Hallazgo,
  Leerla,
  Leyenda,
  type MetaItem,
  PageHeader,
  Pregunta,
  Seccion,
  NotaTabla,
  Table,
  SkeletonApendice,
  SkeletonCapas,
  SkeletonHallazgo,
  SkeletonSeccion,
  SkeletonTable,
  Grafica,
  errorText,
  useApi,
  type Loaded,
} from '@/components/common';
import { MixBars, type MixRow } from '@/components/cartelera/mix-bars';
import { PresaleBars, type PresaleRow } from '@/components/cartelera/presale-bars';
import { type CurveRow, PresaleCurve } from '@/components/cartelera/presale-curve';
import { type OfferedByTitle, SeatsDumbbell } from '@/components/cartelera/seats-dumbbell';
import { DaySlotHeatmap } from '@/components/day-slot-heatmap';
import { FilterChecks, FilterMenu, PeriodSelector, PlazaSelector, usePeriod, usePlaza, useSetParams } from '@/components/filters';
import { GraficaGrupo } from '@/components/vega-chart';
import { MoviesDumbbell } from '@/components/movies-dumbbell';
import { ApiError, api, query } from '@/lib/api';
import { date_es, fill, fixed, localTime, n, pp, range_es, signed, thousands, time_12 } from '@/lib/format';
import {
  AVAILABILITY_LABEL,
  CARTELERA_CHART_TEXT as CT,
  CARTELERA_TEXT as T,
  CHAIN_COLOR,
  CHAIN_LABEL,
  COLUMN_LABEL,
  COMPARED,
  DATE_TEXT,
  DAY_TYPE_LABEL,
  EXCLUSIVE_LABEL,
  FIELD_LABEL,
  FINDING_TEXT,
  FINDING_THEME_LABEL,
  FORMAT_BUCKETS,
  FORMAT_LABEL,
  FULL_DAY,
  HOURS_TEXT,
  HOUR_MARKS,
  HOUR_PRESETS,
  NAV_LABEL,
  KIND_HELP,
  KIND_LABEL,
  LANGUAGE_BUCKETS,
  LANGUAGE_LABEL,
  PUBLICATION_LABEL,
  RED_RAMP,
  SEATS_CHART_TEXT,
  SLOTS,
  SLOT_SHORT,
  STATUS_LABEL,
  VS_NOW_LABEL,
  WEEKDAY_LABEL,
} from '@/lib/labels.generated';

type Chain = (typeof COMPARED)[number];
type Value = string | number | null | undefined | readonly string[];
type Row = Record<string, Value>;
type PerChain<K extends string> = Record<`${K}_${Chain}`, number | null>;
type Kpi = {
  chain: Chain; cinemas: number; shows: number; movies: number; pct_subtitled: number; shows_per_cinema: number;
  pct_prime: number; pct_evening: number; weekend_shows: number;
};
type Capture = { chain: string; last_ok_at: string | null; age_min: number | null; error: string | null; stale: boolean };
type SummaryRow = { title: string; kind: 'title' | 'rest' | 'total'; diff_shows: number; diff_pp: number; ratio: number | null }
  & PerChain<'shows' | 'cinemas' | 'share'>;
type Gap = { title: string; gap_pp: number; exclusive: Chain | null; leader: Chain } & PerChain<'shows' | 'cinemas' | 'share'>;
type Heat = { weekday: number; slot: keyof typeof SLOT_SHORT; gap_pp: number } & PerChain<'shows' | 'share'>;
type PresaleCompare = { title: string } & Record<`title_norm_${Chain}`, string | null>;
type Curves = Partial<Record<Chain, CurveRow[]>>;
type Offered = { chain: Chain; seats_offered: number | null; avg_seats_per_show: number | null };
type Concentration = { chain: Chain; hhi: number; top3_pct: number; titles_per_cinema: number };
type Price = { chain: Chain; format_bucket: keyof typeof FORMAT_LABEL; day_type: keyof typeof DAY_TYPE_LABEL; median_price: number };
type Capacity = {
  chain: Chain; cinemas: number; screens: number; seats: number; avg_seats: number; min_seats: number; max_seats: number; small: number;
};
type Cartelera = {
  plaza: string | null;
  d0: string;
  d1: string;
  hours: [number, number];
  full_day: boolean;
  includes_today: boolean;
  today: string;
  next_week_publication: keyof typeof PUBLICATION_LABEL | null;
  snapshot_times: string[];
  first_snapshot: string;
  computed_at: string;
  shown_movies: number;
  total_movies: number;
  coverage: Row[];
  capture: Capture[];
  kpis: Kpi[];
};
type Hallazgos = { findings: Finding[] };
// Cada sección trae su conclusión: la llave de `analytics.conclusions` que la abre.
type Conclusions = { conclusions: Record<string, string> };
type ResumenData = Conclusions & { general_summary: { hours: [number, number]; rows: SummaryRow[] }[] };
type PeliculasData = Conclusions & { movie_gaps: Gap[] };
type HorariosData = Conclusions & { heatmap: Heat[] };
type FormatosData = Conclusions & { mix: MixRow[] };
type PreventaData = Conclusions & { presale_compare: PresaleCompare[]; presale_by_chain: PresaleRow[]; presale_curve: Curves };
type IndicadoresData = { offered_seats: Offered[]; concentration: Concentration[] };
type CambiosData = { events_by_kind: { chain: Chain; kind: string; n: number }[]; recent_events: Row[] };
type PreciosData = {
  prices: (Price & Row)[];
  price_summary: { cinemas: Record<string, number>; markup_min_pct: number | null; markup_max_pct: number | null };
};
type ButacasData = { capacity_summary: Capacity[]; offered_by_title: Record<Chain, OfferedByTitle[]>; capacity_by_cinema: Record<Chain, Row[]> };
type TimelineEvent = { detected_at: string; kind: string; changes: { field: string; before: string | null; after: string | null }[] };
type Historia = {
  chain: Chain;
  cinemas: { cinema_id: string; cinema_name: string }[];
  cinema_id: string | null;
  dates: string[];
  date: string | null;
  functions: Row[];
  show_id: string | null;
  timeline: TimelineEvent[];
  snapshots: string[];
  as_of: string | null;
  board: Row[];
};

const CARTELERA_KINDS = ['added', 'removed', 'moved', 'changed'] as const;
const FREE = 'libre';
const PRESETS = Object.entries(HOUR_PRESETS) as [string, readonly [number, number]][];
const TIMES = ['sampled_at', 'detected_at', 'first_seen'];
const RELABEL: Record<string, Record<string, string>> = {
  chain: CHAIN_LABEL, kind: KIND_LABEL, format_bucket: FORMAT_LABEL, day_type: DAY_TYPE_LABEL, status: STATUS_LABEL,
  vs_now: VS_NOW_LABEL, language: LANGUAGE_LABEL,
};

// Las pantallas de la Cartelera, por ruta: `hallazgos` es la portada (`/`).
export type CarteleraView = 'hallazgos' | 'programacion' | 'preventa' | 'precios' | 'historial';
const VIEW_HREF: Record<CarteleraView, string> = {
  hallazgos: '/', programacion: '/programacion/', preventa: '/preventa/', precios: '/precios/', historial: '/historial/',
};
// La pantalla y la sección donde está la evidencia de cada tema de `analytics.findings`.
const FINDING_HREF: Record<string, string> = {
  titulo: `${VIEW_HREF.programacion}#peliculas`,
  concentracion: `${VIEW_HREF.programacion}#peliculas`,
  exclusivas: `${VIEW_HREF.programacion}#peliculas`,
  movimientos: `${VIEW_HREF.programacion}#peliculas`,
  demanda: `${VIEW_HREF.programacion}#peliculas`,
  franjas: `${VIEW_HREF.programacion}#horarios`,
  formato: `${VIEW_HREF.programacion}#formatos`,
  preventa: VIEW_HREF.preventa,
  preventa_brecha: VIEW_HREF.preventa,
  preventa_exclusiva: VIEW_HREF.preventa,
  precio: VIEW_HREF.precios,
  ocupacion: '/cines/#ranking',
  rival: '/cines/#rivales',
  dulceria: '/dulceria/',
  independientes: '/independientes/',
};
// El conjunto del explorador de Datos con los renglones de cada tema. `dates` pasa el periodo; los precios son muestreos
// de días anteriores, así que su conjunto se abre sin fechas.
const FINDING_DATA: Record<string, { dataset: string; dates?: boolean; chain?: string }> = {
  titulo: { dataset: 'week_showtimes', dates: true },
  concentracion: { dataset: 'week_showtimes', dates: true },
  exclusivas: { dataset: 'week_showtimes', dates: true, chain: 'cinepolis' },
  movimientos: { dataset: 'week_showtimes', dates: true },
  demanda: { dataset: 'week_showtimes', dates: true },
  franjas: { dataset: 'week_showtimes', dates: true },
  formato: { dataset: 'week_showtimes', dates: true },
  independientes: { dataset: 'week_showtimes', dates: true, chain: 'cineteca' },
  precio: { dataset: 'ticket_prices' },
  dulceria: { dataset: 'delivery_prices' },
};

function findingData(topic: string, d0: string, d1: string): string | undefined {
  const target = FINDING_DATA[topic];
  if (!target) return undefined;
  const params = new URLSearchParams({ dataset: target.dataset, ...(target.dates ? { d0, d1 } : {}), ...(target.chain ? { chain: target.chain } : {}) });
  return `/datos/?${params}`;
}

const SKELETON: Record<CarteleraView, { findings?: number; sections?: number; appendices?: number }> = {
  hallazgos: { findings: 3, sections: 0 }, programacion: { sections: 4, appendices: 1 }, preventa: { sections: 1 },
  precios: { sections: 0, appendices: 2 }, historial: { sections: 0, appendices: 2 },
};

const useStyles = makeStyles({
  dates: { display: 'flex', gap: tokens.spacingHorizontalS },
  caption: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, margin: `${tokens.spacingVerticalXS} 0` },
  columns: { display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: '24px', '@media (max-width: 760px)': { gridTemplateColumns: 'minmax(0, 1fr)' } },
  // Sin esto, una columna de grid no se encoge por debajo del ancho de su tabla.
  column: { minWidth: 0 },
  controls: { display: 'flex', flexWrap: 'wrap', gap: '12px 20px', alignItems: 'flex-end', margin: '8px 0' },
  wide: { minWidth: '240px' },
  chartTitle: { fontWeight: tokens.fontWeightSemibold, margin: `${tokens.spacingVerticalS} 0 ${tokens.spacingVerticalXS}` },
  nota: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, margin: `${tokens.spacingVerticalS} 0 ${tokens.spacingVerticalS}` },
  scroll: { maxHeight: '400px', overflow: 'auto', minWidth: 0 },
  sugerencias: { margin: `${tokens.spacingVerticalS} 0 0`, paddingLeft: tokens.spacingHorizontalXL, display: 'grid', gap: tokens.spacingVerticalXS,
    '& a': { color: tokens.colorBrandForegroundLink, textDecoration: 'none' }, '& a:hover': { textDecoration: 'underline' } },
  hallazgosRejilla: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: tokens.spacingVerticalL,
    '@media (max-width: 760px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
});

// --- Formato propio de la cartelera: equivalentes de `hour_mark` y `range_short`. ---

function hour12(hour: number): string {
  return time_12(`${String(hour % 24).padStart(2, '0')}:00`);
}

function hourMark(hour: number): string {
  return hour === 0 ? HOURS_TEXT.opening : hour === 24 ? HOURS_TEXT.midnight : hour12(hour);
}

// '2026-10-10', '2026-10-14' → 'sáb 10 – mié 14 oct 2026'.
function rangeShort(d0: string, d1: string): string {
  const parts = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return {
      day: `${DATE_TEXT.weekdays_short[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()}`,
      month: DATE_TEXT.months_short[d.getUTCMonth()],
      year: d.getUTCFullYear(),
    };
  };
  const [a, b] = [parts(d0), parts(d1)];
  if (d0 === d1) return `${a.day} ${a.month} ${a.year}`;
  if (a.month === b.month && a.year === b.year) return `${a.day} – ${b.day} ${b.month} ${b.year}`;
  return `${a.day} ${a.month} – ${b.day} ${b.month} ${b.year}`;
}

function percent(v: number | null | undefined, digits = 1): string {
  return v == null ? '—' : fill(CT.percent, { value: fixed(v, digits) });
}

// Entero con signo y miles, como `f"{v:+,d}"` con signo menos tipográfico.
function signedInt(v: number): string {
  return `${v < 0 ? '−' : '+'}${n(Math.abs(v))}`;
}

function relative(a: number, b: number, digits = 1): string {
  return `${signed((100 * (a - b)) / b, digits)} %`;
}

function has(v: number | null | undefined): v is number {
  return v != null && v > 0;
}

function chainCell(c: Chain): Cell {
  return [CHAIN_LABEL[c], c === 'cinemex' ? 'cmx' : 'cnp'];
}

// Un valor como lo pinta `pretty()` de ui/common.py.
function pretty(col: string, v: Value): string {
  if (col === 'availability') {
    const key = v || '(sin color)';
    return AVAILABILITY_LABEL[key as keyof typeof AVAILABILITY_LABEL] ?? String(key);
  }
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'number') return n(v, Number.isInteger(v) ? 0 : 1);
  const text = v as string;
  if (col === 'datetime_local' && text.length >= 16) return `${date_es(text.slice(0, 10))}, ${time_12(text.slice(11, 16))}`;
  if (TIMES.includes(col)) return localTime(text);
  if (col in RELABEL) return RELABEL[col][text] ?? text;
  return text;
}

const BOARD_COLUMNS = ['datetime_local', 'screen', 'movie_title', 'language', 'format', 'availability', 'vs_now', 'changes'];

function DetailTable({ rows, columns }: { rows: Row[]; columns?: string[] }) {
  const cols = columns ?? Object.keys(rows[0] ?? {});
  return (
    <Table
      headers={cols.map((c) => COLUMN_LABEL[c as keyof typeof COLUMN_LABEL] ?? c)}
      rows={rows.map((r) => cols.map((c) => pretty(c, r[c])))}
      numCols={cols.flatMap((c, i) => (typeof rows[0]?.[c] === 'number' ? [i] : []))}
    />
  );
}

function Info({ text }: { text: string }) {
  return <MessageBar intent="info"><MessageBarBody>{text}</MessageBarBody></MessageBar>;
}

// --- Franja: `?h0=&h1=` (enteros de HOUR_MARKS) y `?franja=libre` para el rango libre. ---

function useHours(): { preset: string; h0: number; h1: number } {
  const params = useSearchParams();
  const [h0, h1] = [Number(params.get('h0') ?? FULL_DAY[0]), Number(params.get('h1') ?? FULL_DAY[1])];
  const marks = HOUR_MARKS as readonly number[];
  const valid = marks.includes(h0) && marks.includes(h1) && h0 < h1;
  const [a, b] = valid ? [h0, h1] : FULL_DAY;
  const match = PRESETS.find(([, [p0, p1]]) => p0 === a && p1 === b)?.[0];
  return { preset: params.get('franja') === FREE || !match ? FREE : match, h0: a, h1: b };
}

function HoursSelector() {
  const setParams = useSetParams();
  const { preset, h0, h1 } = useHours();
  const hoursParams = (a: number, b: number) =>
    a === FULL_DAY[0] && b === FULL_DAY[1] ? { h0: null, h1: null } : { h0: String(a), h1: String(b) };
  return (
    <>
      <FilterMenu
        label={T.hours_header}
        icon={<Clock20Regular />}
        value={preset}
        options={[...PRESETS.map(([key]) => [key, key] as [string, string]), [FREE, T.hours_free]]}
        onChange={(value) => {
          const chosen = PRESETS.find(([key]) => key === value)?.[1];
          setParams(chosen ? { franja: null, ...hoursParams(chosen[0], chosen[1]) } : { franja: FREE });
        }}
      />
      {preset === FREE && (
        <>
          <FilterMenu label={T.hours_from} value={String(h0)} short={`${T.hours_from} ${hourMark(h0)}`}
                      options={HOUR_MARKS.filter((h) => h < h1).map((h) => [String(h), hourMark(h)])}
                      onChange={(value) => setParams({ franja: FREE, ...hoursParams(Number(value), h1) })} />
          <FilterMenu label={T.hours_to} value={String(h1)} short={`${T.hours_to} ${hourMark(h1)}`}
                      options={HOUR_MARKS.filter((h) => h > h0).map((h) => [String(h), hourMark(h)])}
                      onChange={(value) => setParams({ franja: FREE, ...hoursParams(h0, Number(value)) })} />
        </>
      )}
    </>
  );
}

// --- Página ---

export function CarteleraPage({ view }: { view: CarteleraView }) {
  const plaza = usePlaza();
  const { d0, d1 } = usePeriod();
  const { h0, h1 } = useHours();
  const fullDay = h0 === FULL_DAY[0] && h1 === FULL_DAY[1];
  const [data, setData] = React.useState<Cartelera | null>(null);
  const [loaded, setLoaded] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const params = query({ plaza, d0, d1, h0: fullDay ? null : h0, h1: fullDay ? null : h1 });
  const request = `/cartelera${params}`;
  const hallazgos = useApi<Hallazgos>(view === 'hallazgos' ? `/cartelera/hallazgos${params}` : null);
  React.useEffect(() => {
    let live = true;
    setError(null);
    api<Cartelera>(request).then(
      (body) => { if (live) { setData(body); setLoaded(request); } },
      (e) => live && setError(apiError(e)),
    );
    return () => { live = false; };
  }, [request]);

  const nextState = data?.next_week_publication ? PUBLICATION_LABEL[data.next_week_publication] : '';
  const ready = data != null && loaded === request && data.kpis.length >= 2;
  const body = () => {
    if (error) return <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>;
    if (!data || loaded !== request) return <SkeletonCapas {...SKELETON[view]} />;
    if (!data.coverage.length) return <Info text={T.no_shows} />;
    if (data.kpis.length < 2) return <Info text={fill(T.no_board, { range: range_es(d0, d1) })} />;
    return <Contenido key={request} view={view} data={data} params={params} hallazgos={hallazgos} />;
  };

  return (
    <>
      <PageHeader title={NAV_LABEL[view === 'hallazgos' ? 'cartelera' : view]} meta={ready && data ? metaItems(data) : undefined}>
        <PlazaSelector />
        <PeriodSelector nextState={nextState} />
        <HoursSelector />
        {view === 'hallazgos' && hallazgos.data && <ThemeSelector findings={hallazgos.data.findings} />}
      </PageHeader>
      {body()}
    </>
  );
}

function apiError(e: unknown): string {
  return e instanceof ApiError && e.status === 503 ? T.no_db_web : errorText(e);
}

function metaItems(data: Cartelera): MetaItem[] {
  return [[T.meta_period, rangeShort(data.d0, data.d1)]];
}

// Una sección de evidencia que pide sus datos al acercarse a la pantalla.
function Evidencia<T>({ slug, params, table = false, children }: {
  slug: string; params: string; table?: boolean; children: (data: T) => React.ReactNode;
}) {
  return (
    <Diferido<T> path={`/cartelera/seccion/${slug}${params}`} fallback={<SkeletonSeccion table={table} />} error={apiError}>
      {children}
    </Diferido>
  );
}

// Un apéndice que pide sus datos al acercarse a la pantalla: su resumen va en el encabezado cerrado.
function Anexo<T>({ slug, params, children }: { slug: string; params: string; children: (data: T) => React.ReactNode }) {
  return (
    <Diferido<T> path={`/cartelera/apendice/${slug}${params}`} fallback={<SkeletonApendice />} error={apiError}>
      {children}
    </Diferido>
  );
}

// --- Tema: `?tema=preventa,cines`. Se filtra en el navegador; la API ya manda todos los hallazgos. ---

function useThemes(): string[] {
  return useSearchParams().get('tema')?.split(',').filter(Boolean) ?? [];
}

// Solo ofrece los temas que tienen algún hallazgo en la zona y el periodo elegidos.
function ThemeSelector({ findings }: { findings: Finding[] }) {
  const setParams = useSetParams();
  const themes = useThemes();
  const present = new Set(findings.map((f) => f.theme));
  const options = Object.entries(FINDING_THEME_LABEL).filter(([key]) => present.has(key as Finding['theme']));
  if (options.length < 2) return null;
  return (
    <FilterChecks label={FINDING_TEXT.theme} icon={<Filter20Regular />} values={themes} options={options}
                  onChange={(values) => setParams({ tema: values.length ? values.join(',') : null })} />
  );
}

// Los tres más fuertes, a todo lo ancho; el resto, en dos columnas.
const LEADING_FINDINGS = 3;
// Sugerencias del resumen: las de los hallazgos de mayor impacto, que ya vienen en orden.
const SUGGESTIONS = 3;

function CapaHallazgos({ hallazgos, d0, d1 }: { hallazgos: Loaded<Hallazgos>; d0: string; d1: string }) {
  const s = useStyles();
  const themes = useThemes();
  if (hallazgos.error) return <MessageBar intent="error"><MessageBarBody>{apiError(hallazgos.error)}</MessageBarBody></MessageBar>;
  if (!hallazgos.data) return <>{Array.from({ length: 3 }, (_, i) => <SkeletonHallazgo key={i} />)}</>;
  const findings = hallazgos.data.findings.filter((f) => !themes.length || themes.includes(f.theme));
  const suggested = findings.filter((f) => f.action).slice(0, SUGGESTIONS);
  const card = (f: Finding, compact = false) => (
    <Hallazgo key={f.topic} f={f} compact={compact} href={FINDING_HREF[f.topic]} dataHref={findingData(f.topic, d0, d1)}
              showAction={!suggested.includes(f)} />
  );
  return (
    <>
      {!findings.length && <Info text={T.no_findings} />}
      {suggested.length > 0 && (
        <Seccion slug="sugerencias">
          <Subtitle2 as="h2">{T.suggestions}</Subtitle2>
          <ol className={s.sugerencias}>
            {suggested.map((f) => <li key={f.topic}><a href={`#${f.topic}`}>{f.action}</a></li>)}
          </ol>
        </Seccion>
      )}
      {findings.slice(0, LEADING_FINDINGS).map((f) => card(f))}
      <div className={s.hallazgosRejilla}>{findings.slice(LEADING_FINDINGS).map((f) => card(f, true))}</div>
    </>
  );
}

function Contenido({ view, data, params, hallazgos }: {
  view: CarteleraView; data: Cartelera; params: string; hallazgos: Loaded<Hallazgos>;
}) {
  const stale = data.capture.filter((r) => r.stale);
  return (
    <>
      {stale.map((r) => {
        const name = CHAIN_LABEL[r.chain as keyof typeof CHAIN_LABEL] ?? r.chain;
        const text = r.age_min == null ? fill(T.stale_none, { name })
          : r.error ? fill(T.stale_error, { name, age: fixed(r.age_min, 0), error: r.error.slice(0, 120) })
            : fill(T.stale_old, { name, age: fixed(r.age_min, 0) });
        return <MessageBar key={r.chain} intent="warning"><MessageBarBody>{text}</MessageBarBody></MessageBar>;
      })}

      {view === 'hallazgos' && <CapaHallazgos hallazgos={hallazgos} d0={data.d0} d1={data.d1} />}
      {view === 'programacion' && (
        <ApendiceAbierto.Provider value>
          <Anexo<IndicadoresData> slug="indicadores" params={params}>{(ap) => <Indicadores data={data} ap={ap} />}</Anexo>
          <Evidencia<ResumenData> slug="resumen" params={params} table>{(sec) => <Resumen sec={sec} />}</Evidencia>
          <Evidencia<PeliculasData> slug="peliculas" params={params}>{(sec) => <Peliculas data={data} sec={sec} />}</Evidencia>
          <Evidencia<HorariosData> slug="horarios" params={params}>{(sec) => <Horarios data={data} sec={sec} />}</Evidencia>
          <Evidencia<FormatosData> slug="formatos" params={params}>{(sec) => <Formatos sec={sec} />}</Evidencia>
        </ApendiceAbierto.Provider>
      )}
      {view === 'preventa' && (
        <Evidencia<PreventaData> slug="preventa" params={params}>{(sec) => <Preventa data={data} sec={sec} />}</Evidencia>
      )}
      {view === 'precios' && (
        <ApendiceAbierto.Provider value>
          <Anexo<PreciosData> slug="precios" params={params}>{(ap) => <Precios ap={ap} />}</Anexo>
          <Anexo<ButacasData> slug="butacas" params={params}>{(ap) => <Butacas ap={ap} />}</Anexo>
        </ApendiceAbierto.Provider>
      )}
      {view === 'historial' && (
        <ApendiceAbierto.Provider value>
          <Apendice title={T.historia_title} resumen={fill(T.historia_summary, { date: date_es(data.first_snapshot) })}>
            <Historial plaza={data.plaza} />
          </Apendice>
          <Anexo<CambiosData> slug="cambios" params={params}>{(ap) => <Cambios data={data} ap={ap} />}</Anexo>
        </ApendiceAbierto.Provider>
      )}
    </>
  );
}

// --- Evidencia ---

function Resumen({ sec }: { sec: ResumenData }) {
  const labels = Object.keys(HOUR_PRESETS).slice(0, 2);
  const [tab, setTab] = React.useState(0);
  const rows = sec.general_summary[tab]?.rows ?? [];
  let rank = 0;
  const cells = rows.map((r): Cell[] => {
    const title = r.kind === 'title';
    if (title) rank += 1;
    const cell = (text: string, chain?: CellClass): Cell => {
      const classes = [...(title ? [] : ['sum' as const]), ...(chain ? [chain] : [])];
      return classes.length ? [text, classes] : text;
    };
    const name = { title: r.title, rest: T.resumen_rest, total: T.resumen_total }[r.kind];
    return [
      cell(title ? String(rank) : ''), cell(name),
      cell(r.kind !== 'rest' ? n(r.cinemas_cinemex) : '—', 'cmx'), cell(n(r.shows_cinemex), 'cmx'), cell(percent(r.share_cinemex), 'cmx'),
      cell(r.kind !== 'rest' ? n(r.cinemas_cinepolis) : '—', 'cnp'), cell(n(r.shows_cinepolis), 'cnp'), cell(percent(r.share_cinepolis), 'cnp'),
      cell(signedInt(r.diff_shows)), cell(r.kind !== 'total' ? pp(r.diff_pp) : ''), cell(r.ratio == null ? '—' : fixed(r.ratio, 2)),
    ];
  });
  return (
    <Seccion slug="resumen">
      <Pregunta texto={T.q_resumen} conclusion={sec.conclusions.resumen} />
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as number)}>
        {labels.map((label, i) => <Tab key={label} value={i}>{label}</Tab>)}
      </TabList>
      {rows.length ? <Table headers={[...T.resumen_headers]} rows={cells} numCols={[2, 3, 4, 5, 6, 7, 8, 9, 10]} />
        : <Info text={T.empty_period} />}
      <Leerla>{T.leer_resumen}</Leerla>
    </Seccion>
  );
}

function Peliculas({ data, sec }: { data: Cartelera; sec: PeliculasData }) {
  const [showAll, setShowAll] = React.useState(false);
  const movies = sec.movie_gaps.slice(0, showAll ? data.total_movies : data.shown_movies).map((m) => ({
    ...m,
    title: m.title.trim(),
    delta: m.exclusive ? EXCLUSIVE_LABEL[m.exclusive] : pp(m.gap_pp),
    winner: m.leader,
    tooltip: Object.fromEntries(COMPARED.filter((c) => m[`shows_${c}`]).map((c) => [c, fill(T.peliculas_tooltip, {
      title: m.title.trim(), chain: CHAIN_LABEL[c], share: fixed(m[`share_${c}`] ?? 0, 1), shows: n(m[`shows_${c}`]),
      cinemas: n(m[`cinemas_${c}`]),
    })])),
  }));
  return (
    <Seccion slug="peliculas">
      <Pregunta texto={T.q_peliculas} conclusion={sec.conclusions.peliculas} nota={showAll ? null : sec.conclusions.peliculas_note} />
      <Leyenda items={COMPARED.map((c) => [CHAIN_LABEL[c], CHAIN_COLOR[c]] as const)} />
      <MoviesDumbbell movies={movies} axisTitle={T.peliculas_axis} contenedor={{
        ayuda: <Leerla>{fill(T.leer_peliculas, { total: data.total_movies })}</Leerla>,
        controles: <Switch checked={showAll} onChange={(_, d) => setShowAll(d.checked)} label={fill(T.peliculas_all, { n: data.total_movies })} />,
      }} />
    </Seccion>
  );
}

function Horarios({ data, sec }: { data: Cartelera; sec: HorariosData }) {
  const [h0, h1] = data.hours;
  const cells = sec.heatmap.map((c) => {
    const day = WEEKDAY_LABEL[c.weekday];
    const slot = SLOT_SHORT[c.slot];
    return {
      day,
      slot_label: slot,
      gap_pp: c.gap_pp,
      label: signed(c.gap_pp),
      tooltip: fill(T.horarios_tooltip, {
        day, slot, share_cinemex: fixed(c.share_cinemex ?? 0, 1), share_cinepolis: fixed(c.share_cinepolis ?? 0, 1),
        gap: signed(c.gap_pp), shows_cinemex: n(c.shows_cinemex), shows_cinepolis: n(c.shows_cinepolis),
      }),
    };
  });
  const days = WEEKDAY_LABEL.filter((d) => cells.some((c) => c.day === d));
  const slots = SLOTS.filter(([, lo, hi]) => lo >= h0 && hi <= h1).map(([key]) => SLOT_SHORT[key as keyof typeof SLOT_SHORT]);
  const limit = Math.max(1, ...cells.map((c) => Math.abs(c.gap_pp)));
  return (
    <Seccion slug="horarios">
      <Pregunta texto={T.q_horarios} conclusion={sec.conclusions.franjas} />
      {cells.length
        ? <DaySlotHeatmap cells={cells} days={days} slots={slots} limit={limit} contenedor={{ ayuda: <Leerla>{T.leer_horarios}</Leerla> }} />
        : <Info text={T.empty_period} />}
    </Seccion>
  );
}

function Formatos({ sec }: { sec: FormatosData }) {
  const s = useStyles();
  const languagePalette = [RED_RAMP[1], RED_RAMP[3]];
  return (
    <Seccion slug="formatos">
      <Pregunta texto={T.q_formatos} conclusion={sec.conclusions.formatos} />
      <GraficaGrupo nombre="formatos" ayuda={<Leerla>{T.leer_formatos}</Leerla>}>
        {sec.mix.length > 0 && (
        <div className={s.columns}>
          <div className={s.column}>
            <Leyenda square items={FORMAT_BUCKETS.map((b, i) => [FORMAT_LABEL[b], RED_RAMP[i]] as const)} />
            <MixBars rows={sec.mix} dimension="format" />
          </div>
          <div className={s.column}>
            <Leyenda square items={LANGUAGE_BUCKETS.map((b, i) => [LANGUAGE_LABEL[b], languagePalette[i]] as const)} />
            <MixBars rows={sec.mix} dimension="language" />
          </div>
        </div>
        )}
      </GraficaGrupo>
    </Seccion>
  );
}

function Preventa({ data, sec }: { data: Cartelera; sec: PreventaData }) {
  const s = useStyles();
  const [pick, setPick] = React.useState(0);
  const [curves, setCurves] = React.useState<Curves>(sec.presale_curve);
  const row = sec.presale_compare[pick];
  React.useEffect(() => {
    if (!row) return;
    if (pick === 0) { setCurves(sec.presale_curve); return; }
    let live = true;
    api<Curves>(`/cartelera/curva${query({
      plaza: data.plaza, title_norm_cinemex: row.title_norm_cinemex, title_norm_cinepolis: row.title_norm_cinepolis,
    })}`).then((body) => live && setCurves(body), () => live && setCurves({}));
    return () => { live = false; };
  }, [pick, row, data, sec]);

  const both = sec.presale_by_chain.filter((r) => r.status === 'ambas');
  const single = sec.presale_by_chain.filter((r) => r.status !== 'ambas');
  const readings = COMPARED.reduce((total, c) => total + (curves[c]?.length ?? 0), 0);
  const pickCurve = (
    <FilterMenu label={T.curve_pick} value={String(pick)}
                options={sec.presale_compare.map((p, i) => [String(i), p.title])}
                onChange={(value) => setPick(Number(value))} />
  );
  return (
    <Seccion slug="preventa">
      <Pregunta texto={T.q_preventa} conclusion={sec.conclusions.preventa} />
      {!sec.presale_compare.length ? <Info text={T.preventa_empty} /> : (
        <>
          <Leyenda items={COMPARED.map((c) => [CHAIN_LABEL[c], CHAIN_COLOR[c]] as const)} />
          {both.length > 0 && (
            <>
              <p className={s.nota} dangerouslySetInnerHTML={{ __html: T.preventa_both }} />
              <PresaleBars rows={both} paired />
            </>
          )}
          {single.length > 0 && (
            <>
              <p className={s.nota} dangerouslySetInnerHTML={{ __html: T.preventa_single }} />
              <PresaleBars rows={single} paired={false} />
            </>
          )}
          {readings > 1
            ? <PresaleCurve curves={curves} contenedor={{ ayuda: <Leerla>{T.leer_preventa}</Leerla>, controles: pickCurve }} />
            : <Grafica ayuda={<Leerla>{T.leer_preventa}</Leerla>} controles={pickCurve}>
                <p className={s.caption}>{T.curve_pending}</p>
              </Grafica>}
        </>
      )}
    </Seccion>
  );
}

// --- Apéndices ---

function Indicadores({ data, ap }: { data: Cartelera; ap: IndicadoresData }) {
  const [us, them] = COMPARED.map((c) => data.kpis.find((k) => k.chain === c)!);
  const [cm, cp] = COMPARED.map((c) => ap.offered_seats.find((r) => r.chain === c));
  const [cx, cn] = COMPARED.map((c) => ap.concentration.find((r) => r.chain === c));
  const withSeats = has(cm?.seats_offered) && has(cp?.seats_offered);
  const K = T.kpi;
  let resumen = fill(T.kpis_summary, { us: fixed(us.shows_per_cinema, 1), them: fixed(them.shows_per_cinema, 1) });
  if (withSeats) resumen += fill(T.kpis_summary_seats, { us: thousands(cm!.seats_offered!), them: thousands(cp!.seats_offered!) });
  const weekend = Boolean(us.weekend_shows && them.weekend_shows);
  const rows: string[][] = [
    [K.shows_per_cinema, n(us.shows_per_cinema, 1), n(them.shows_per_cinema, 1), relative(us.shows_per_cinema, them.shows_per_cinema)],
    [K.shows, n(us.shows), n(them.shows), ''],
    [K.cinemas, n(us.cinemas), n(them.cinemas), ''],
    ...(data.full_day ? [weekend
      ? [K.prime, percent(us.pct_prime), percent(them.pct_prime), pp(us.pct_prime - them.pct_prime)]
      : [K.evening, percent(us.pct_evening), percent(them.pct_evening), pp(us.pct_evening - them.pct_evening)]] : []),
    [K.subtitled, percent(us.pct_subtitled), percent(them.pct_subtitled), pp(us.pct_subtitled - them.pct_subtitled)],
    [K.movies, n(us.movies), n(them.movies), signedInt(us.movies - them.movies)],
  ];
  if (withSeats) {
    rows.push(
      [K.seats_offered, n(cm!.seats_offered), n(cp!.seats_offered), relative(cm!.seats_offered!, cp!.seats_offered!)],
      [K.seats_per_show, n(cm!.avg_seats_per_show), n(cp!.avg_seats_per_show), ''],
    );
  }
  if (cx && cn) {
    rows.push(
      [K.top3, percent(cx.top3_pct), percent(cn.top3_pct), pp(cx.top3_pct - cn.top3_pct)],
      [K.hhi, n(cx.hhi), n(cn.hhi), ''],
      [K.titles_per_cinema, n(cx.titles_per_cinema, 1), n(cn.titles_per_cinema, 1), ''],
    );
  }
  const cells = rows.map((r): Cell[] => [r[0], [r[1], 'cmx'], [r[2], 'cnp'], r[3]]);
  return (
    <Apendice title={T.kpis_title} resumen={resumen}>
      <Table headers={[...T.kpis_headers]} rows={cells} numCols={[1, 2, 3]} wideCols={[0]} />
      <NotaTabla title={T.kpis_title} texto={T.kpis_note}
                 ejemplo={<Table headers={[...T.kpis_headers]} rows={cells.slice(0, 1)} numCols={[1, 2, 3]} wideCols={[0]} />} />
    </Apendice>
  );
}

function Cambios({ data, ap }: { data: Cartelera; ap: CambiosData }) {
  const s = useStyles();
  const [kinds, setKinds] = React.useState<string[]>([...CARTELERA_KINDS]);
  const [events, setEvents] = React.useState<Row[]>(ap.recent_events);
  const all = !kinds.length || kinds.length === CARTELERA_KINDS.length;
  React.useEffect(() => {
    if (all) { setEvents(ap.recent_events); return; }
    let live = true;
    const params = new URLSearchParams(kinds.map((k) => ['kinds', k]));
    if (data.plaza) params.set('plaza', data.plaza);
    api<Row[]>(`/cartelera/cambios?${params}`).then((body) => live && setEvents(body), () => live && setEvents([]));
    return () => { live = false; };
  }, [kinds, all, data, ap]);

  const g = (c: Chain, k: string) => ap.events_by_kind.find((r) => r.chain === c && r.kind === k)?.n ?? 0;
  const ev = ap.events_by_kind.length > 0;
  const resumen = ev ? fill(T.cambios_summary, {
    us_removed: thousands(g('cinemex', 'removed')), them_removed: thousands(g('cinepolis', 'removed')),
    us_moved: thousands(g('cinemex', 'moved')), them_moved: thousands(g('cinepolis', 'moved')),
  }) : T.cambios_none;
  const columns = Object.keys(events[0] ?? {}).filter((c) => c !== 'show_id' && c !== 'date');
  const cambiosRows = COMPARED.map((c): Cell[] => [chainCell(c), ...CARTELERA_KINDS.map((k) => thousands(g(c, k)))]);
  return (
    <Apendice title={T.cambios_title} resumen={resumen}>
      {ev && <Table headers={[...T.cambios_headers]} rows={cambiosRows} numCols={[1, 2, 3, 4]} />}
      <NotaTabla
        title={T.cambios_title}
        texto={
          <>
            {T.cambios_note_lead}{' '}
            {CARTELERA_KINDS.map((k) => <React.Fragment key={k}><b>{KIND_LABEL[k]}.</b> {KIND_HELP[k]} </React.Fragment>)}
            {T.cambios_note_tail}
          </>
        }
        ejemplo={ev && <Table headers={[...T.cambios_headers]} rows={cambiosRows.slice(0, 1)} numCols={[1, 2, 3, 4]} />}
      />
      <FilterChecks label={T.cambios_log} values={kinds} options={CARTELERA_KINDS.map((k) => [k, KIND_LABEL[k]])}
                    onChange={(values) => setKinds(CARTELERA_KINDS.filter((k) => values.includes(k)))} />
      {events.length ? <div className={s.scroll}><DetailTable rows={events} columns={columns} /></div> : <Info text={T.cambios_empty} />}
    </Apendice>
  );
}

function Precios({ ap }: { ap: PreciosData }) {
  if (!ap.prices.length) return null;
  const price = (c: Chain, b: string, d: string) =>
    ap.prices.find((r) => r.chain === c && r.format_bucket === b && r.day_type === d)?.median_price;
  const pair = (b: keyof typeof FORMAT_LABEL, d: keyof typeof DAY_TYPE_LABEL) => {
    const [a, c] = [price('cinemex', b, d), price('cinepolis', b, d)];
    return a && c ? fill(T.precios_pair, { format: FORMAT_LABEL[b], day: DAY_TYPE_LABEL[d].toLowerCase(), us: n(a), them: n(c) }) : null;
  };
  const ps = ap.price_summary;
  const bits = [pair('traditional', 'promo'), pair('premium', 'weekend')].filter((x): x is string => Boolean(x));
  if (ps.markup_min_pct != null) {
    bits.unshift(fill(T.precios_markup, { min: fixed(ps.markup_min_pct, 0), max: fixed(ps.markup_max_pct ?? 0, 0) }));
  }
  const days = ['weekday', 'promo', 'weekend'] as const;
  const rows = FORMAT_BUCKETS.flatMap((b) => days.flatMap((d): Cell[][] => {
    const [a, c] = [price('cinemex', b, d), price('cinepolis', b, d)];
    if (a == null && c == null) return [];
    return [[FORMAT_LABEL[b], DAY_TYPE_LABEL[d], [a ? `$${n(a)}` : '—', 'cmx'], [c ? `$${n(c)}` : '—', 'cnp'], a && c ? relative(c, a, 0) : '']];
  }));
  const cinemas = Object.entries(ps.cinemas).sort(([a], [b]) => a.localeCompare(b))
    .map(([c, v]) => fill(T.precios_cinemas, { chain: CHAIN_LABEL[c as Chain] ?? c, n: Math.trunc(v) })).join(', ');
  return (
    <Apendice title={T.precios_title} resumen={bits.join(' · ')}>
      <Table headers={[...T.precios_headers]} rows={rows} numCols={[2, 3, 4]} />
      <NotaTabla title={T.precios_title} texto={fill(T.precios_note, { cinemas })}
                 ejemplo={rows.length > 0 && <Table headers={[...T.precios_headers]} rows={rows.slice(0, 1)} numCols={[2, 3, 4]} />} />
      <DetailTable rows={ap.prices} columns={['chain', 'format_bucket', 'day_type', 'samples', 'cinemas', 'median_price', 'min_price', 'max_price']} />
    </Apendice>
  );
}

function Butacas({ ap }: { ap: ButacasData }) {
  const s = useStyles();
  const [chain, setChain] = React.useState<Chain>(COMPARED[0]);
  if (!ap.capacity_summary.length) return null;
  const resumen = ap.capacity_summary.map((r) => fill(T.butacas_summary, {
    chain: CHAIN_LABEL[r.chain], screens: Math.trunc(r.screens), seats: thousands(r.seats), avg: Math.trunc(r.avg_seats),
  })).join(' · ');
  const byTitle = ap.offered_by_title[chain] ?? [];
  const capacityRows = ap.capacity_summary.map((r): Cell[] => [
    chainCell(r.chain), n(r.cinemas), n(r.screens), n(r.seats), n(r.avg_seats), n(r.min_seats), n(r.max_seats), n(r.small),
  ]);
  return (
    <Apendice title={T.butacas_title} resumen={resumen}>
      <Table headers={[...T.butacas_headers]} rows={capacityRows} numCols={[1, 2, 3, 4, 5, 6, 7]} />
      <NotaTabla title={T.butacas_title} texto={T.butacas_note}
                 ejemplo={<Table headers={[...T.butacas_headers]} rows={capacityRows.slice(0, 1)} numCols={[1, 2, 3, 4, 5, 6, 7]} />} />
      <FilterMenu label={T.chain} value={chain} options={COMPARED.map((c) => [c, CHAIN_LABEL[c]])}
                  onChange={(value) => setChain(value as Chain)} />
      <div className={s.columns}>
        <div className={s.column}>
          <p className={s.chartTitle}>{fill(SEATS_CHART_TEXT.title, { chain: CHAIN_LABEL[chain] })}</p>
          {!byTitle.length ? <Info text={T.butacas_empty} /> : (
            <>
              <SeatsDumbbell rows={byTitle} chain={chain} />
              <p className={s.nota}>{T.butacas_chart_note}</p>
            </>
          )}
        </div>
        <div className={s.column}>
          <p className={s.chartTitle}>{T.butacas_title}</p>
          <div className={s.scroll}>
            <DetailTable rows={ap.capacity_by_cinema[chain] ?? []} columns={['cinema_name', 'screens', 'seats', 'avg_seats', 'min_seats', 'max_seats']} />
          </div>
        </div>
      </div>
    </Apendice>
  );
}

type HistoriaChoice = { chain?: Chain; cinema_id?: string; date?: string; show_id?: string; as_of?: string };

// Historial de una función: cada control fija los anteriores y deja que la API elija el valor por defecto de los siguientes.
function Historial({ plaza }: { plaza: string | null }) {
  const s = useStyles();
  const [choice, setChoice] = React.useState<HistoriaChoice>({});
  const [screen, setScreen] = React.useState<string | null>(null);
  const [h, setH] = React.useState<Historia | null>(null);
  const request = `/cartelera/historia${query({ plaza, ...choice })}`;
  React.useEffect(() => {
    let live = true;
    api<Historia>(request).then((body) => live && setH(body), () => live && setH(null));
    return () => { live = false; };
  }, [request]);
  if (!h) return <SkeletonTable rows={4} />;

  const base = { chain: h.chain, cinema_id: h.cinema_id ?? undefined, date: h.date ?? undefined };
  const screens = [...new Set(h.functions.map((f) => f.screen).filter((x): x is string => x != null).map(String))]
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
  const inScreen = (r: Row) => screen === null || String(r.screen) === screen;
  const functions = h.functions.filter(inScreen);
  const count = (status: string) => functions.filter((f) => f.status === status).length;
  const option = (f: Row) => fill(T.function_option, {
    time: time_12(String(f.datetime_local).slice(11, 16)), screen: String(f.screen ?? ''), title: String(f.movie_title ?? ''),
  });
  const change = (ch: TimelineEvent['changes'][number]) => {
    const fmt = (v: string | null) => (ch.field === 'datetime_local' && v && v.length >= 16 ? time_12(v.slice(11, 16)) : v || '—');
    return fill(T.timeline_change, { field: FIELD_LABEL[ch.field as keyof typeof FIELD_LABEL] ?? ch.field, before: fmt(ch.before), after: fmt(ch.after) });
  };
  const board = h.board.filter(inScreen).map((r) => ({
    ...r,
    changes: ((r.changed_fields as string[] | null) ?? []).map((f) => FIELD_LABEL[f as keyof typeof FIELD_LABEL] ?? f).join(', '),
  }));
  const asOfIndex = Math.max(0, h.snapshots.indexOf(h.as_of ?? ''));

  return (
    <>
      <p className={s.nota}>{T.historia_lead}</p>
      <div className={s.controls}>
        <FilterMenu label={T.chain} value={h.chain} options={COMPARED.map((c) => [c, CHAIN_LABEL[c]])}
                    onChange={(value) => { setScreen(null); setChoice({ chain: value as Chain }); }} />
        <FilterMenu label={T.cinema} value={h.cinema_id ?? ''} options={h.cinemas.map((c) => [c.cinema_id, c.cinema_name])}
                    onChange={(value) => { setScreen(null); setChoice({ chain: h.chain, cinema_id: value }); }} />
        <FilterMenu label={T.date} value={h.date ?? ''} options={h.dates.map((d) => [d, date_es(d, false)])}
                    onChange={(value) => { setScreen(null); setChoice({ chain: h.chain, cinema_id: base.cinema_id, date: value }); }} />
        {h.functions.length > 0 && (
          <FilterMenu label={T.screen} value={screen ?? ''}
                      options={[['', T.all_screens], ...screens.map((x): [string, string] => [x, x])]}
                      onChange={(value) => {
                        const next = value || null;
                        setScreen(next);
                        const first = h.functions.find((f) => next === null || String(f.screen) === next);
                        setChoice({ ...base, show_id: first ? String(first.show_id) : undefined });
                      }} />
        )}
      </div>
      {!h.functions.length ? <Info text={T.no_functions} /> : (
        <>
          <p><b>{fill(T.functions_count, { n: functions.length })}</b>{' '}
            {fill(T.functions_status, { current: count('current'), removed: count('removed'), expired: count('expired') })}</p>
          <div className={s.scroll}>
            <DetailTable rows={functions} columns={['datetime_local', 'screen', 'movie_title', 'language', 'format', 'status', 'first_seen']} />
          </div>
          <FilterMenu label={T.function} value={h.show_id ?? ''}
                      options={functions.map((f) => [String(f.show_id), option(f)])}
                      onChange={(value) => setChoice({ ...base, show_id: value })} />
          <p className={s.chartTitle}>{T.timeline}</p>
          {!h.timeline.length ? <Info text={T.timeline_empty} /> : (
            <Table
              headers={[...T.timeline_headers]}
              rows={h.timeline.map((e) => [localTime(e.detected_at), KIND_LABEL[e.kind as keyof typeof KIND_LABEL] ?? e.kind, e.changes.map(change).join('; ')])}
            />
          )}
          <p className={s.chartTitle}>{T.board_title}</p>
          {h.snapshots.length < 2 ? <Info text={T.board_few} /> : (
            <>
              <Field label={`${T.board_capture}: ${localTime(h.as_of)}`}>
                <Slider min={0} max={h.snapshots.length - 1} step={1} value={asOfIndex}
                        onChange={(_, d) => setChoice({ ...base, show_id: h.show_id ?? undefined, as_of: h.snapshots[d.value] })} />
              </Field>
              {!board.length ? <Info text={T.board_empty} /> : (
                <>
                  <div className={s.scroll}>
                    <DetailTable rows={board} columns={BOARD_COLUMNS} />
                  </div>
                  <NotaTabla title={T.board_title} texto={T.board_note} ejemplo={<DetailTable rows={board.slice(0, 1)} columns={BOARD_COLUMNS} />} />
                </>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

