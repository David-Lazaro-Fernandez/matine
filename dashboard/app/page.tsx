'use client';

// Cartelera, como views/cartelera.py: Cinemex frente a Cinépolis en tres capas (hallazgos, evidencia y apéndice).
// El encabezado (`GET /api/cartelera`) y los hallazgos (`/cartelera/hallazgos`) se piden al entrar. Cada sección y
// cada apéndice pide su endpoint (`/cartelera/seccion/{slug}`, `/cartelera/apendice/{slug}`) cuando se acerca a la
// pantalla. Los controles dentro de una sección piden su sub-endpoint (`/cartelera/curva`, `/cambios`, `/historia`).
import * as React from 'react';
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Checkbox,
  Dropdown,
  Field,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Switch,
  Tab,
  TabList,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useSearchParams } from 'next/navigation';
import {
  Apendice,
  AppLink,
  Capa,
  type Cell,
  type CellClass,
  Diferido,
  type Finding,
  Hallazgo,
  Leerla,
  Leyenda,
  type MetaItem,
  PageFooter,
  PageHeader,
  Pregunta,
  Seccion,
  Table,
  SkeletonApendice,
  SkeletonCapas,
  SkeletonHallazgo,
  SkeletonSeccion,
  SkeletonTable,
  errorText,
  useApi,
} from '@/components/common';
import { MixBars, type MixRow } from '@/components/cartelera/mix-bars';
import { PresaleBars, type PresaleRow } from '@/components/cartelera/presale-bars';
import { type CurveRow, PresaleCurve } from '@/components/cartelera/presale-curve';
import { type OfferedByTitle, SeatsDumbbell } from '@/components/cartelera/seats-dumbbell';
import { DaySlotHeatmap } from '@/components/day-slot-heatmap';
import { PeriodSelector, PlazaSelector, usePeriod, usePlaza, useSetParams } from '@/components/filters';
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
  FORMAT_BUCKETS,
  FORMAT_LABEL,
  FULL_DAY,
  HOURS_TEXT,
  HOUR_MARKS,
  HOUR_PRESETS,
  INDEP_TEXT,
  KIND_HELP,
  KIND_LABEL,
  LANGUAGE_BUCKETS,
  LANGUAGE_LABEL,
  PLAZA_LABEL,
  PUBLICATION_LABEL,
  RED_RAMP,
  SEATS_CHART_TEXT,
  SLOTS,
  SLOT_SHORT,
  STATUS_LABEL,
  VS_NOW_LABEL,
  WEEKDAY_LABEL,
  ZONE_TEXT,
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
type Estimated = { shows: number; shows_estimated: number; seats_offered: number; seats_occupied_est: number | null; occupancy_pct_est: number };
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
  shown_movies: number;
  total_movies: number;
  coverage: Row[];
  capture: Capture[];
  kpis: Kpi[];
};
type Hallazgos = { findings: (Finding & { topic: string })[] };
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
type OcupacionData = {
  occupancy_summary: Row[];
  semaphore_calibration: Row[];
  occupancy_total: { samples: number; sold_pct: number; levels: number };
  estimated_occupancy: Estimated[];
  occupancy_recent: Row[];
};
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

const useStyles = makeStyles({
  navCapas: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalL}`,
    fontSize: tokens.fontSizeBase200,
    marginBottom: tokens.spacingVerticalM,
    '& a': { color: tokens.colorNeutralForeground2, textDecoration: 'none' },
  },
  navNum: { color: tokens.colorBrandForeground1, marginRight: tokens.spacingHorizontalXS },
  dates: { display: 'flex', gap: tokens.spacingHorizontalS },
  guide: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, maxWidth: '720px', marginBottom: '12px' },
  caption: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, margin: `${tokens.spacingVerticalXS} 0` },
  columns: { display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px', '@media (max-width: 760px)': { gridTemplateColumns: '1fr' } },
  // Sin esto, una columna de grid no se encoge por debajo del ancho de su tabla.
  column: { minWidth: 0 },
  controls: { display: 'flex', flexWrap: 'wrap', gap: '12px 20px', alignItems: 'flex-end', margin: '8px 0' },
  wide: { minWidth: '240px' },
  chartTitle: { fontWeight: tokens.fontWeightSemibold, margin: `${tokens.spacingVerticalS} 0 ${tokens.spacingVerticalXS}` },
  nota: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, margin: `${tokens.spacingVerticalS} 0 ${tokens.spacingVerticalS}` },
  scroll: { maxHeight: '400px', overflow: 'auto', minWidth: 0 },
});

// --- Formato propio de la cartelera: equivalentes de `hour_mark`, `hours_label`, `range_short` y `plaza_title`. ---

function hour12(hour: number): string {
  return time_12(`${String(hour % 24).padStart(2, '0')}:00`);
}

function hourMark(hour: number): string {
  return hour === 0 ? HOURS_TEXT.opening : hour === 24 ? HOURS_TEXT.midnight : hour12(hour);
}

function hoursLabel([h0, h1]: readonly [number, number]): string {
  if (h0 === FULL_DAY[0] && h1 === FULL_DAY[1]) return HOURS_TEXT.full_day;
  const key = h1 === 24 ? 'from' : h0 === 0 ? 'until' : 'range';
  return fill(HOURS_TEXT[key], { h0: hour12(h0), h1: hour12(h1) });
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

function plazaTitle(plaza: string | null): string {
  return plaza ? fill(ZONE_TEXT.title, { plaza: PLAZA_LABEL[plaza as keyof typeof PLAZA_LABEL] ?? plaza }) : ZONE_TEXT.title_national;
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

// Las negritas de labels.py vienen en markdown: '**Cinépolis.** Texto' → <b>Cinépolis.</b> Texto.
function bold(text: string) {
  return text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
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
  const s = useStyles();
  const setParams = useSetParams();
  const { preset, h0, h1 } = useHours();
  const hoursParams = (a: number, b: number) =>
    a === FULL_DAY[0] && b === FULL_DAY[1] ? { h0: null, h1: null } : { h0: String(a), h1: String(b) };
  return (
    <>
      <Field label={T.hours_header} hint={h0 !== FULL_DAY[0] || h1 !== FULL_DAY[1] ? fill(T.hours_caption, { hours: hoursLabel([h0, h1]) }) : undefined}>
        <RadioGroup
          aria-label={T.hours_header}
          value={preset}
          onChange={(_, data) => {
            const chosen = PRESETS.find(([key]) => key === data.value)?.[1];
            setParams(chosen ? { franja: null, ...hoursParams(chosen[0], chosen[1]) } : { franja: FREE });
          }}
        >
          {PRESETS.map(([key]) => <Radio key={key} value={key} label={key} />)}
          <Radio value={FREE} label={T.hours_free} />
        </RadioGroup>
      </Field>
      {preset === FREE && (
        <Field label={T.hours_slider}>
          <div className={s.dates}>
            <Select aria-label={T.hours_from} value={String(h0)} onChange={(_, data) => setParams({ franja: FREE, ...hoursParams(Number(data.value), h1) })}>
              {HOUR_MARKS.filter((h) => h < h1).map((h) => <option key={h} value={h}>{hourMark(h)}</option>)}
            </Select>
            <Select aria-label={T.hours_to} value={String(h1)} onChange={(_, data) => setParams({ franja: FREE, ...hoursParams(h0, Number(data.value)) })}>
              {HOUR_MARKS.filter((h) => h > h0).map((h) => <option key={h} value={h}>{hourMark(h)}</option>)}
            </Select>
          </div>
        </Field>
      )}
    </>
  );
}

// --- Página ---

export default function Page() {
  const s = useStyles();
  const plaza = usePlaza();
  const { d0, d1 } = usePeriod();
  const { h0, h1 } = useHours();
  const fullDay = h0 === FULL_DAY[0] && h1 === FULL_DAY[1];
  const [data, setData] = React.useState<Cartelera | null>(null);
  const [loaded, setLoaded] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const params = query({ plaza, d0, d1, h0: fullDay ? null : h0, h1: fullDay ? null : h1 });
  const request = `/cartelera${params}`;
  const hallazgos = useApi<Hallazgos>(`/cartelera/hallazgos${params}`);
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
    if (!data || loaded !== request) return <SkeletonCapas findings={3} sections={5} appendices={4} />;
    if (!data.coverage.length) return <Info text={T.no_shows} />;
    if (data.kpis.length < 2) return <Info text={fill(T.no_board, { range: range_es(d0, d1) })} />;
    return <Contenido key={request} data={data} params={params} hallazgos={hallazgos} />;
  };

  return (
    <>
      <PageHeader title={fill(T.title, { plaza: plazaTitle(plaza) })} meta={ready && data ? metaItems(data) : undefined}>
        <PlazaSelector />
        <PeriodSelector nextState={nextState} />
        <HoursSelector />
      </PageHeader>
      {ready && <NavCapas />}
      {data && loaded === request && <Guia data={data} />}
      {body()}
    </>
  );
}

function apiError(e: unknown): string {
  return e instanceof ApiError && e.status === 503 ? T.no_db_web : errorText(e);
}

function metaItems(data: Cartelera): MetaItem[] {
  const [us, them] = COMPARED.map((c) => data.kpis.find((k) => k.chain === c)!);
  const times = data.capture.flatMap((r) => (r.last_ok_at ? [r.last_ok_at] : []));
  const last = times.length ? times.reduce((a, b) => (new Date(a) <= new Date(b) ? a : b)) : null;
  return [
    [T.meta_period, rangeShort(data.d0, data.d1)],
    ...(data.full_day ? [] : [[T.meta_hours, hoursLabel(data.hours)] as const]),
    [`${us.cinemas} + ${them.cinemas}`, T.meta_cinemas],
    [thousands(us.shows + them.shows), T.meta_shows],
    `${T.meta_capture} ${last ? localTime(last) : '—'}`,
  ];
}

function NavCapas() {
  const s = useStyles();
  return (
    <nav className={s.navCapas}>
      {T.nav.map((label, i) => <a key={label} href={`#capa${i + 1}`}><b className={s.navNum}>{i + 1}</b>{label}</a>)}
    </nav>
  );
}

// "Cómo leer las cifras" y el glosario: la guía de la barra lateral de Streamlit.
function Guia({ data }: { data: Cartelera }) {
  const s = useStyles();
  return (
    <Accordion collapsible multiple className={s.guide}>
      <AccordionItem value="read">
        <AccordionHeader size="small">{T.read_header}</AccordionHeader>
        <AccordionPanel>
          <p>{bold(T.read_body + (data.includes_today ? T.read_today : ''))}</p>
          <p className={s.caption}>{fill(T.capture_caption, { times: data.snapshot_times.map(time_12).join(', '), refresh: '' })}</p>
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem value="glossary">
        <AccordionHeader size="small">{T.glossary_header}</AccordionHeader>
        <AccordionPanel>
          <ul>{T.glossary.map((item) => <li key={item}>{bold(item)}</li>)}</ul>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
}

// Una sección de la Capa 2 que pide sus datos al acercarse a la pantalla.
function Evidencia<T>({ slug, params, table = false, children }: {
  slug: string; params: string; table?: boolean; children: (data: T) => React.ReactNode;
}) {
  return (
    <Diferido<T> path={`/cartelera/seccion/${slug}${params}`} fallback={<SkeletonSeccion table={table} />} error={apiError}>
      {children}
    </Diferido>
  );
}

// Un apéndice de la Capa 3 que pide sus datos al acercarse a la pantalla: su resumen va en el encabezado cerrado.
function Anexo<T>({ slug, params, children }: { slug: string; params: string; children: (data: T) => React.ReactNode }) {
  return (
    <Diferido<T> path={`/cartelera/apendice/${slug}${params}`} fallback={<SkeletonApendice />} error={apiError}>
      {children}
    </Diferido>
  );
}

function CapaHallazgos({ hallazgos }: { hallazgos: { data: Hallazgos | null; error: unknown } }) {
  if (hallazgos.error) return <MessageBar intent="error"><MessageBarBody>{apiError(hallazgos.error)}</MessageBarBody></MessageBar>;
  if (!hallazgos.data) return <>{Array.from({ length: 3 }, (_, i) => <SkeletonHallazgo key={i} />)}</>;
  const { findings } = hallazgos.data;
  const topics = new Set(findings.map((f) => f.topic));
  return (
    <>
      {!findings.length && <Info text={T.no_findings} />}
      {findings.map((f) => <Hallazgo key={f.title} f={f} />)}
      {topics.has('dulceria') && <p><AppLink href="/dulceria">{T.link_dulceria}</AppLink></p>}
      {topics.has('independientes') && <p><AppLink href="/independientes">{INDEP_TEXT.link}</AppLink></p>}
    </>
  );
}

function Contenido({ data, params, hallazgos }: {
  data: Cartelera; params: string; hallazgos: { data: Hallazgos | null; error: unknown };
}) {
  const stale = data.capture.filter((r) => r.stale);
  const hoursFilter = data.full_day ? '' : fill(T.footer_filter, { hours: hoursLabel(data.hours) });
  return (
    <>
      {stale.map((r) => {
        const name = CHAIN_LABEL[r.chain as keyof typeof CHAIN_LABEL] ?? r.chain;
        const text = r.age_min == null ? fill(T.stale_none, { name })
          : r.error ? fill(T.stale_error, { name, age: fixed(r.age_min, 0), error: r.error.slice(0, 120) })
            : fill(T.stale_old, { name, age: fixed(r.age_min, 0) });
        return <MessageBar key={r.chain} intent="warning"><MessageBarBody>{text}</MessageBarBody></MessageBar>;
      })}

      <Capa num={1} title={T.layer1} desc={T.layer1_desc} />
      <CapaHallazgos hallazgos={hallazgos} />

      <Capa num={2} title={T.layer2} desc={T.layer2_desc} />
      <Evidencia<ResumenData> slug="resumen" params={params} table>{(sec) => <Resumen sec={sec} />}</Evidencia>
      <Evidencia<PeliculasData> slug="peliculas" params={params}>{(sec) => <Peliculas data={data} sec={sec} />}</Evidencia>
      <Evidencia<HorariosData> slug="horarios" params={params}>{(sec) => <Horarios data={data} sec={sec} />}</Evidencia>
      <Evidencia<FormatosData> slug="formatos" params={params}>{(sec) => <Formatos sec={sec} />}</Evidencia>
      <Evidencia<PreventaData> slug="preventa" params={params}>{(sec) => <Preventa data={data} sec={sec} />}</Evidencia>

      <Capa num={3} title={T.layer3} desc={T.layer3_desc} />
      <Anexo<IndicadoresData> slug="indicadores" params={params}>{(ap) => <Indicadores data={data} ap={ap} />}</Anexo>
      <Anexo<CambiosData> slug="cambios" params={params}>{(ap) => <Cambios data={data} ap={ap} />}</Anexo>
      <Anexo<PreciosData> slug="precios" params={params}>{(ap) => <Precios ap={ap} />}</Anexo>
      <Anexo<ButacasData> slug="butacas" params={params}>{(ap) => <Butacas ap={ap} />}</Anexo>
      <Apendice title={T.historia_title} resumen={fill(T.historia_summary, { date: date_es(data.first_snapshot) })}>
        <Historial plaza={data.plaza} />
      </Apendice>
      <Anexo<OcupacionData> slug="ocupacion" params={params}>{(ap) => <Ocupacion ap={ap} />}</Anexo>

      <PageFooter>{fill(T.footer, { filter: hoursFilter, date: date_es(data.first_snapshot) })}</PageFooter>
    </>
  );
}

// --- Capa 2 ---

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
      <MoviesDumbbell movies={movies} axisTitle={T.peliculas_axis} />
      <Switch checked={showAll} onChange={(_, d) => setShowAll(d.checked)} label={fill(T.peliculas_all, { n: data.total_movies })} />
      <Leerla>{fill(T.leer_peliculas, { total: data.total_movies })}</Leerla>
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
      {cells.length ? <DaySlotHeatmap cells={cells} days={days} slots={slots} limit={limit} /> : <Info text={T.empty_period} />}
      <Leerla>{T.leer_horarios}</Leerla>
    </Seccion>
  );
}

function Formatos({ sec }: { sec: FormatosData }) {
  const s = useStyles();
  const languagePalette = [RED_RAMP[1], RED_RAMP[3]];
  return (
    <Seccion slug="formatos">
      <Pregunta texto={T.q_formatos} conclusion={sec.conclusions.formatos} />
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
      <Leerla>{T.leer_formatos}</Leerla>
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
          <Field label={T.curve_pick} className={s.wide}>
            <Dropdown
              value={row?.title ?? ''}
              selectedOptions={[String(pick)]}
              onOptionSelect={(_, o) => setPick(Number(o.optionValue ?? 0))}
            >
              {sec.presale_compare.map((p, i) => <Option key={`${p.title}-${i}`} value={String(i)}>{p.title}</Option>)}
            </Dropdown>
          </Field>
          {readings > 1 ? <PresaleCurve curves={curves} /> : <p className={s.caption}>{T.curve_pending}</p>}
        </>
      )}
      <Leerla>{T.leer_preventa}</Leerla>
    </Seccion>
  );
}

// --- Capa 3 ---

function Indicadores({ data, ap }: { data: Cartelera; ap: IndicadoresData }) {
  const s = useStyles();
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
  return (
    <Apendice title={T.kpis_title} resumen={resumen}>
      <Table headers={[...T.kpis_headers]} rows={rows.map((r): Cell[] => [r[0], [r[1], 'cmx'], [r[2], 'cnp'], r[3]])} numCols={[1, 2, 3]} />
      <p className={s.nota}>{T.kpis_note}</p>
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
  const toggle = (k: string, on: boolean) => setKinds(CARTELERA_KINDS.filter((x) => (x === k ? on : kinds.includes(x))));
  const columns = Object.keys(events[0] ?? {}).filter((c) => c !== 'show_id' && c !== 'date');
  return (
    <Apendice title={T.cambios_title} resumen={resumen}>
      {ev && (
        <Table
          headers={[...T.cambios_headers]}
          rows={COMPARED.map((c): Cell[] => [chainCell(c), ...CARTELERA_KINDS.map((k) => thousands(g(c, k)))])}
          numCols={[1, 2, 3, 4]}
        />
      )}
      <p className={s.nota}>
        {T.cambios_note_lead}{' '}
        {CARTELERA_KINDS.map((k) => <React.Fragment key={k}><b>{KIND_LABEL[k]}.</b> {KIND_HELP[k]} </React.Fragment>)}
        {T.cambios_note_tail}
      </p>
      <Field label={T.cambios_log}>
        <div className={s.controls}>
          {CARTELERA_KINDS.map((k) => (
            <Checkbox key={k} label={KIND_LABEL[k]} checked={kinds.includes(k)} onChange={(_, d) => toggle(k, Boolean(d.checked))} />
          ))}
        </div>
      </Field>
      {events.length ? <div className={s.scroll}><DetailTable rows={events} columns={columns} /></div> : <Info text={T.cambios_empty} />}
    </Apendice>
  );
}

function Precios({ ap }: { ap: PreciosData }) {
  const s = useStyles();
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
      <p className={s.nota}>{fill(T.precios_note, { cinemas })}</p>
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
  return (
    <Apendice title={T.butacas_title} resumen={resumen}>
      <Table
        headers={[...T.butacas_headers]}
        rows={ap.capacity_summary.map((r): Cell[] => [
          chainCell(r.chain), n(r.cinemas), n(r.screens), n(r.seats), n(r.avg_seats), n(r.min_seats), n(r.max_seats), n(r.small),
        ])}
        numCols={[1, 2, 3, 4, 5, 6, 7]}
      />
      <p className={s.nota}>{T.butacas_note}</p>
      <RadioGroup layout="horizontal" aria-label={T.chain} value={chain} onChange={(_, d) => setChain(d.value as Chain)}>
        {COMPARED.map((c) => <Radio key={c} value={c} label={CHAIN_LABEL[c]} />)}
      </RadioGroup>
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
  const cinemaName = h.cinemas.find((c) => c.cinema_id === h.cinema_id)?.cinema_name ?? '';
  const option = (f: Row) => fill(T.function_option, {
    time: time_12(String(f.datetime_local).slice(11, 16)), screen: String(f.screen ?? ''), title: String(f.movie_title ?? ''),
  });
  const shown = functions.find((f) => f.show_id === h.show_id);
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
        <Field label={T.chain}>
          <Dropdown value={CHAIN_LABEL[h.chain]} selectedOptions={[h.chain]}
                    onOptionSelect={(_, o) => { setScreen(null); setChoice({ chain: o.optionValue as Chain }); }}>
            {COMPARED.map((c) => <Option key={c} value={c}>{CHAIN_LABEL[c]}</Option>)}
          </Dropdown>
        </Field>
        <Field label={T.cinema} className={s.wide}>
          <Dropdown value={cinemaName} selectedOptions={h.cinema_id ? [h.cinema_id] : []}
                    onOptionSelect={(_, o) => { setScreen(null); setChoice({ chain: h.chain, cinema_id: o.optionValue }); }}>
            {h.cinemas.map((c) => <Option key={c.cinema_id} value={c.cinema_id}>{c.cinema_name}</Option>)}
          </Dropdown>
        </Field>
        <Field label={T.date}>
          <Dropdown value={h.date ? date_es(h.date, false) : ''} selectedOptions={h.date ? [h.date] : []}
                    onOptionSelect={(_, o) => { setScreen(null); setChoice({ chain: h.chain, cinema_id: base.cinema_id, date: o.optionValue }); }}>
            {h.dates.map((d) => <Option key={d} value={d}>{date_es(d, false)}</Option>)}
          </Dropdown>
        </Field>
        {h.functions.length > 0 && (
          <Field label={T.screen}>
            <Dropdown value={screen ?? T.all_screens} selectedOptions={[screen ?? '']}
                      onOptionSelect={(_, o) => {
                        const next = o.optionValue || null;
                        setScreen(next);
                        const first = h.functions.find((f) => next === null || String(f.screen) === next);
                        setChoice({ ...base, show_id: first ? String(first.show_id) : undefined });
                      }}>
              <Option value="">{T.all_screens}</Option>
              {screens.map((x) => <Option key={x} value={x}>{x}</Option>)}
            </Dropdown>
          </Field>
        )}
      </div>
      {!h.functions.length ? <Info text={T.no_functions} /> : (
        <>
          <p><b>{fill(T.functions_count, { n: functions.length })}</b>{' '}
            {fill(T.functions_status, { current: count('current'), removed: count('removed'), expired: count('expired') })}</p>
          <div className={s.scroll}>
            <DetailTable rows={functions} columns={['datetime_local', 'screen', 'movie_title', 'language', 'format', 'status', 'first_seen']} />
          </div>
          <Field label={T.function} className={s.wide}>
            <Dropdown value={shown ? option(shown) : ''} selectedOptions={h.show_id ? [h.show_id] : []}
                      onOptionSelect={(_, o) => setChoice({ ...base, show_id: o.optionValue })}>
              {functions.map((f) => <Option key={String(f.show_id)} value={String(f.show_id)}>{option(f)}</Option>)}
            </Dropdown>
          </Field>
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
                    <DetailTable rows={board} columns={['datetime_local', 'screen', 'movie_title', 'language', 'format', 'availability', 'vs_now', 'changes']} />
                  </div>
                  <p className={s.nota}>{T.board_note}</p>
                </>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function Ocupacion({ ap }: { ap: OcupacionData }) {
  const s = useStyles();
  const { samples, sold_pct: weighted, levels } = ap.occupancy_total;
  const calibrated = ap.semaphore_calibration.length > 0;
  const resumen = fill(T.ocupacion_summary, {
    n: samples, pct: fixed(weighted, 1),
    levels: levels ? fill(T.ocupacion_levels, { levels }) : T.ocupacion_no_levels,
    calibrated: calibrated ? T.ocupacion_calibrated : T.ocupacion_uncalibrated,
  });
  const est = ap.estimated_occupancy[0];
  const calibration = ap.semaphore_calibration.map((r) => ({ ...r, availability: r.level }));
  return (
    <Apendice title={T.ocupacion_title} resumen={resumen}>
      {samples === 0 ? <Info text={T.ocupacion_empty} /> : (
        <>
          <p>{bold(fill(T.ocupacion_cinepolis, { n: samples, pct: fixed(weighted, 1) }))}</p>
          <DetailTable rows={ap.occupancy_summary} columns={['availability', 'samples', 'avg_sold_pct', 'min_sold_pct', 'max_sold_pct']} />
        </>
      )}
      {!calibrated ? <p>{bold(T.ocupacion_cinemex_pending)}</p> : (
        <>
          {est && has(est.seats_occupied_est) && (
            <p>{bold(fill(T.ocupacion_cinemex, {
              occupied: thousands(est.seats_occupied_est), offered: thousands(est.seats_offered), pct: fixed(est.occupancy_pct_est, 1),
              estimated: thousands(est.shows_estimated), shows: thousands(est.shows),
            }))}</p>
          )}
          <DetailTable rows={calibration} columns={['availability', 'samples', 'sold_pct', 'min_sold_pct', 'max_sold_pct']} />
        </>
      )}
      {samples > 0 && (
        <>
          <p className={s.chartTitle}>{T.ocupacion_recent}</p>
          <div className={s.scroll}><DetailTable rows={ap.occupancy_recent} /></div>
        </>
      )}
      <p className={s.nota}>{T.ocupacion_note}</p>
    </Apendice>
  );
}
