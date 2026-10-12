'use client';

// Mapa de cines, como views/mapa.py: destacados por cadena, el mapa con la ficha de cada edificio y la tabla de cines.
// Los datos salen de `GET /api/mapa`. Aquí se abren en círculo los cines del mismo edificio y se calcula el radio.
import * as React from 'react';
import {
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useSearchParams } from 'next/navigation';
import {
  Apendice,
  type Cell,
  Leerla,
  Leyenda,
  PageFooter,
  PageHeader,
  Pregunta,
  Seccion,
  Table,
  SkeletonApendice,
  SkeletonSeccion,
} from '@/components/common';
import { FilterChecks, FilterMenu, FilterPopover, PlazaSelector, SearchChecklist, usePlaza, useSetParams } from '@/components/filters';
import { CinemaMap, type MapPoint } from '@/components/mapa/cinema-map';
import { api } from '@/lib/api';
import { date_es, fill, fixed, n, range_es } from '@/lib/format';
import {
  CHAIN_COLOR,
  CHAIN_LABEL,
  COLUMN_LABEL,
  FORMAT_LABEL,
  MAP_METRIC,
  MAP_TEXT as T,
} from '@/lib/labels.generated';

type Chain = keyof typeof CHAIN_LABEL;
type Metric = keyof typeof MAP_METRIC;
type Cinema = {
  chain: Chain;
  cinema_id: string;
  cinema_name: string;
  lat: number;
  lng: number;
  shows: number;
  titles: number;
  screens: number | null;
  seats: number | null;
  ticket_price: number | null;
  ticket_sampled_at: string | null;
  ticket_max: number | null;
  ticket_max_format: string | null;
  ticket_max_sampled_at: string | null;
  popcorn_price: number | null;
  sold_pct: number | null;
  occupancy_samples: number;
};
type Highlight = { metric: Metric; chain: Chain; cinema_name: string; value: number; cinemas: number };
type Site = { site_id: string; chain: Chain; lat: number; lng: number; cinema_ids: string[] };
type Mapa = {
  plaza: string | null;
  d0: string;
  d1: string;
  options: { chain: Chain; cinema_id: string; cinema_name: string }[];
  cinemas: Cinema[];
  highlights: Highlight[];
  sites: Site[];
};

const CHAINS = Object.keys(CHAIN_LABEL) as Chain[];
const METRICS = Object.keys(MAP_METRIC) as Metric[];
const DEFAULT_METRIC: Metric = 'shows';
// Píxeles: no crecen con el zoom, así los cines vecinos no se tapan.
const MIN_RADIUS = 5;
const MAX_RADIUS = 22;
// Grados (~130 m): cuánto se abren los cines que comparten edificio.
const SPREAD = 0.0012;
const NATIONAL_ZOOM = 4.3;
const PLAZA_ZOOM = 9.6;
// Grados de separación → zoom.
const SPAN_ZOOM: [number, number][] = [[0.01, 14], [0.05, 12.5], [0.15, 11], [0.4, 10], [2, 8], [Infinity, 4.3]];
// Opacidad de un cine con dato y sin dato, la misma de la vista de pydeck (215 y 70 de 255).
const KNOWN_OPACITY = 215 / 255;
const UNKNOWN_OPACITY = 70 / 255;
const TABLE_COLUMNS = ['chain', 'cinema_name', 'shows', 'titles', 'screens', 'seats', 'ticket_price', 'ticket_sampled_at',
  'ticket_max', 'ticket_max_format', 'popcorn_price', 'sold_pct', 'occupancy_samples'] as const;
const MONEY_COLUMNS: readonly string[] = ['ticket_price', 'ticket_max', 'popcorn_price'];
const TEXT_COLUMNS: readonly string[] = ['chain', 'cinema_name', 'ticket_sampled_at', 'ticket_max_format'];

const useStyles = makeStyles({
  nota: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, margin: `${tokens.spacingVerticalS} 0 ${tokens.spacingVerticalXXS}` },
  detail: { fontWeight: tokens.fontWeightSemibold, margin: `${tokens.spacingVerticalM} 0 ${tokens.spacingVerticalXS}` },
  hint: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

function has(v: number | null | undefined): v is number {
  return v != null && v > 0;
}

// Aplica el formato de Python de MAP_METRIC: '${:,.0f}' con 1234 → '$1,234'; '{:.1f} %' con 30.25 → '30.2 %'.
function pyFormat(template: string, v: number): string {
  return template.replace(/\{:(,?)\.(\d+)f\}/, (_, comma: string, digits: string) => (comma ? n(v, +digits) : fixed(v, +digits)));
}

function fmt(m: Metric, v: number | null): string {
  return has(v) ? pyFormat(MAP_METRIC[m][1], v) : T.no_value;
}

function formatLabel(key: string): string {
  return FORMAT_LABEL[key as keyof typeof FORMAT_LABEL] ?? key;
}

// El boleto más caro dice de qué formato es.
function valueText(c: Cinema, m: Metric): string {
  const text = fmt(m, c[m]);
  return m === 'ticket_max' && has(c[m]) && c.ticket_max_format ? `${text} (${formatLabel(c.ticket_max_format)})` : text;
}

// En la ficha, el boleto lleva la fecha de su lectura.
function cell(c: Cinema, m: Metric): string {
  const text = valueText(c, m);
  const sampled = m === 'ticket_price' ? c.ticket_sampled_at : m === 'ticket_max' ? c.ticket_max_sampled_at : null;
  return has(c[m]) && sampled ? `${text}, ${fill(T.sampled, { date: date_es(sampled.slice(0, 10), false) })}` : text;
}

// Tooltip en texto plano, el mismo para cada cine del edificio: la cadena, cuántos cines hay y las métricas de cada uno.
function tip(site: Site, cinemas: Cinema[]): string {
  const k = cinemas.length;
  const head = CHAIN_LABEL[site.chain] + (k > 1 ? ` · ${fill(T.site_count, { n: k })}` : '');
  const blocks = cinemas.map((c) => `${c.cinema_name}\n${METRICS.map((m) => `  ${MAP_METRIC[m][0]}: ${valueText(c, m)}`).join('\n')}`);
  return `${head}\n\n${blocks.join('\n\n')}`;
}

// Un punto por cine. Los cines de un edificio se abren en círculo alrededor de su coordenada real.
function points(sites: Site[], byKey: Map<string, Cinema>, metric: Metric): MapPoint[] {
  const raw = sites.flatMap((site) => {
    const cinemas = site.cinema_ids.map((id) => byKey.get(`${site.chain}:${id}`)!).filter(Boolean);
    const text = tip(site, cinemas);
    const shift = cinemas.length > 1 ? SPREAD : 0;
    return cinemas.map((c, i) => {
      const angle = (2 * Math.PI * i) / cinemas.length;
      return { siteId: site.site_id, chain: c.chain, value: c[metric], tip: text,
        lat: c.lat + shift * Math.sin(angle), lng: c.lng + shift * Math.cos(angle) };
    });
  });
  const top = Math.max(...raw.map((p) => p.value ?? -Infinity));
  return raw.map(({ chain, value, ...p }) => {
    const known = has(value);
    const radius = known && top > 0 ? MIN_RADIUS + ((MAX_RADIUS - MIN_RADIUS) * value) / top : MIN_RADIUS;
    return { ...p, radius, color: CHAIN_COLOR[chain], opacity: known ? KNOWN_OPACITY : UNKNOWN_OPACITY };
  });
}

// Zoom de la zona completa, o el que encuadra los cines elegidos.
function zoomFor(data: MapPoint[], plaza: string | null, picked: boolean): number {
  if (!picked) return plaza ? PLAZA_ZOOM : NATIONAL_ZOOM;
  const lats = data.map((p) => p.lat);
  const lngs = data.map((p) => p.lng);
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
  return SPAN_ZOOM.find(([limit]) => span <= limit)![1];
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function tableCell(c: Cinema, col: (typeof TABLE_COLUMNS)[number]): string {
  const v = c[col];
  if (col === 'chain') return CHAIN_LABEL[c.chain];
  if (col === 'ticket_max_format') return c.ticket_max_format ? formatLabel(c.ticket_max_format) : '';
  if (typeof v === 'number') return MONEY_COLUMNS.includes(col) ? `$${fixed(v, 2)}` : n(v, col === 'sold_pct' ? 1 : 0);
  return v ?? '';
}

// Lista de la URL separada por comas: null si falta, [] si viene vacía.
function list(value: string | null): string[] | null {
  return value === null ? null : value.split(',').filter(Boolean);
}

export default function Page() {
  const s = useStyles();
  const params = useSearchParams();
  const setParams = useSetParams();
  const plaza = usePlaza();
  const metric = (METRICS as string[]).includes(params.get('metrica') ?? '') ? (params.get('metrica') as Metric) : DEFAULT_METRIC;
  const chains = (list(params.get('cadenas')) ?? (CHAINS as string[])).filter((c): c is Chain => c in CHAIN_LABEL);
  const pickedIds = list(params.get('cines')) ?? [];
  const [data, setData] = React.useState<Mapa | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pickedSite, setPickedSite] = React.useState<string | null>(null);

  const qs = new URLSearchParams();
  if (plaza) qs.set('plaza', plaza);
  chains.forEach((c) => qs.append('chains', c));
  pickedIds.forEach((id) => qs.append('cinema_ids', id));
  const request = `/mapa?${qs}`;
  React.useEffect(() => {
    if (!chains.length) return;
    api<Mapa>(request).then((body) => { setData(body); setError(null); }, (e: Error) => setError(e.message));
    // `request` resume plaza, cadenas y cines.
  }, [request]);

  const names = new Map((data?.options ?? []).map((o) => [o.cinema_id, `${CHAIN_LABEL[o.chain]} · ${o.cinema_name}`]));
  // Al cambiar de zona o de cadenas, los cines elegidos que ya no están en la lista se sueltan.
  const validIds = pickedIds.filter((id) => names.has(id));
  React.useEffect(() => {
    if (data && validIds.length !== pickedIds.length) setParams({ cines: validIds.join(',') || null });
  });

  const byKey = React.useMemo(() => new Map((data?.cinemas ?? []).map((c) => [`${c.chain}:${c.cinema_id}`, c])), [data]);
  const mapPoints = React.useMemo(() => points(data?.sites ?? [], byKey, metric), [data, byKey, metric]);

  const filters = (
    <>
      <PlazaSelector />
      <FilterMenu
        label={T.size_by}
        value={metric}
        short={`${T.size_by}: ${MAP_METRIC[metric][0]}`}
        note={T.size_help}
        options={METRICS.map((m) => [m, MAP_METRIC[m][0]])}
        onChange={(value) => setParams({ metrica: value === DEFAULT_METRIC ? null : value })}
      />
      <FilterChecks
        label={T.chains}
        values={chains}
        options={CHAINS.map((c) => [c, CHAIN_LABEL[c]])}
        onChange={(values) => setParams({ cadenas: values.length === CHAINS.length ? null : values.join(',') })}
      />
      <FilterPopover
        label={T.cinemas}
        text={validIds.map((id) => names.get(id)).join(', ')}
        note={T.cinemas_help}
        onClear={() => setParams({ cines: null })}
      >
        <SearchChecklist label={T.cinemas} values={validIds} options={[...names]}
                         onChange={(values) => setParams({ cines: values.join(',') || null })} />
      </FilterPopover>
    </>
  );

  const meta = data && [
    [`${T.meta_period}:`, range_es(data.d0, data.d1)],
    ...(validIds.length ? [fill(T.filtered, { n: n(data.cinemas.length), total: n(data.options.length) })] : []),
  ] as const;

  const info = (text: string) => <MessageBar intent="info"><MessageBarBody>{text}</MessageBarBody></MessageBar>;
  const body = () => {
    if (!chains.length) return info(T.no_chains);
    if (error) return <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>;
    if (!data) return <><SkeletonSeccion table /><SkeletonSeccion height={560} /><SkeletonApendice /></>;
    if (!data.cinemas.length) return info(T.empty);
    const present = new Set(data.cinemas.map((c) => c.chain));
    const shownChains = CHAINS.filter((c) => chains.includes(c) && present.has(c));
    const highlighted = shownChains.filter((c) => data.highlights.some((h) => h.chain === c));
    const site = data.sites.find((x) => x.site_id === pickedSite);
    const siteCinemas = site ? site.cinema_ids.map((id) => byKey.get(`${site.chain}:${id}`)!).filter(Boolean) : [];
    const center: [number, number] = [mean(mapPoints.map((p) => p.lng)), mean(mapPoints.map((p) => p.lat))];
    return (
      <>
        <Seccion slug="mapa-destacados">
          <Pregunta texto={T.highlights} conclusion={T.highlights_desc} />
          <Table
            headers={['', ...highlighted.map((c) => CHAIN_LABEL[c])]}
            rows={METRICS.map((m) => [
              MAP_METRIC[m][2],
              ...highlighted.map((c): Cell => {
                const h = data.highlights.find((r) => r.metric === m && r.chain === c);
                if (!h) return '—';
                const text = `${h.cinema_name} · ${fmt(m, h.value)} (${h.cinemas})`;
                return c === 'cinemex' ? [text, 'cmx'] : text;
              }),
            ])}
          />
          {highlighted.includes('cinepolis') && <p className={s.nota}>{T.popcorn_note}</p>}
        </Seccion>

        <Seccion slug="mapa-mapa">
          <Pregunta texto={T.map} conclusion={T.map_desc} />
          <Leyenda items={shownChains.map((c) => [CHAIN_LABEL[c], CHAIN_COLOR[c]] as const)} />
          <CinemaMap points={mapPoints} center={center} zoom={zoomFor(mapPoints, plaza, validIds.length > 0)} onPick={setPickedSite} />
          <p className={s.detail}>{T.detail}</p>
          {site ? (
            <Table
              headers={[CHAIN_LABEL[site.chain], ...siteCinemas.map((c) => c.cinema_name)]}
              rows={METRICS.map((m) => [MAP_METRIC[m][0], ...siteCinemas.map((c) => cell(c, m))])}
              numCols={siteCinemas.map((_, i) => i + 1)}
            />
          ) : (
            <p className={s.hint}>{T.detail_hint}</p>
          )}
          <Leerla>{T.leer}</Leerla>
        </Seccion>

        <Apendice title={T.table} resumen={`${n(data.cinemas.length)} ${COLUMN_LABEL.cinemas.toLowerCase()}`}>
          <Table
            headers={TABLE_COLUMNS.map((col) => COLUMN_LABEL[col as keyof typeof COLUMN_LABEL] ?? col)}
            rows={data.cinemas.map((c) => TABLE_COLUMNS.map((col) => tableCell(c, col)))}
            numCols={TABLE_COLUMNS.flatMap((col, i) => (TEXT_COLUMNS.includes(col) ? [] : [i]))}
          />
        </Apendice>
        <PageFooter>{T.footer}</PageFooter>
      </>
    );
  };

  return (
    <>
      <PageHeader title={T.title} meta={meta || undefined}>{filters}</PageHeader>
      {body()}
    </>
  );
}
