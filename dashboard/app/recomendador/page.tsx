'use client';

// Recomendador, como views/recomendador.py: las funciones cerca de un punto que caben en el presupuesto de un grupo.
// Los datos salen de `GET /api/recomendador`; la dirección se convierte en coordenadas con `/recomendador/geocodificar`.
import * as React from 'react';
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Slider,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { ArrowSort20Regular, CalendarLtr20Regular, Clock20Regular, Filmstrip20Regular, FoodPizza20Regular } from '@fluentui/react-icons';
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
  SkeletonSeccion,
} from '@/components/common';
import { FilterChecks, FilterMenu, today, useSetParams } from '@/components/filters';
import { CinemaMap, type MapPoint } from '@/components/mapa/cinema-map';
import { ApiError, api } from '@/lib/api';
import { addDays, date_es, fill, fixed, n, time_12 } from '@/lib/format';
import {
  CHAIN_COLOR,
  CHAIN_LABEL,
  FORMAT_BUCKETS,
  FORMAT_LABEL,
  GROUP_LABEL,
  HOUR_PRESETS,
  INK,
  LANGUAGE_LABEL,
  PAPER,
  RECOMMEND_SORT,
  RECOMMEND_TEXT as T,
  SNACK_LABEL,
} from '@/lib/labels.generated';

type Chain = keyof typeof CHAIN_LABEL;
type Snacks = keyof typeof SNACK_LABEL;
type Sort = keyof typeof RECOMMEND_SORT;
type Group = keyof typeof GROUP_LABEL;
type Promo = {
  name: string;
  includes: string;
  program: string | null;
  program_about: string | null;
  condition: string;
  price: number;
  price_max: number | null;
  people: number;
  applied: boolean;
};
type Show = {
  chain: Chain;
  cinema_id: string;
  cinema_name: string;
  lat: number;
  lng: number;
  title: string;
  date: string;
  datetime_local: string;
  language: string;
  format_bucket: string;
  tickets_total: number | null;
  snacks_total: number | null;
  snack_reference: number | null;
  total: number | null;
  distance_km: number;
  promo: Promo | null;
};
type Summary = {
  shows: number;
  cinemas: number;
  snacks_unpriced: number;
  unpriced: number;
  nearest: Show | null;
  cheapest: Show | null;
  saving: number | null;
};
type Recomendador = {
  d0: string;
  min_date: string;
  max_date: string;
  per_cinema: number;
  limit: number;
  titles: { title_norm: string; title: string }[];
  summary: Summary | null;
  results: Show[];
  snacks_unpriced: Show[];
  unpriced: Show[];
};
type GeoPoint = { lat: number; lng: number; label: string };

// Zócalo, hasta que hay punto de partida.
const CDMX_CENTER: [number, number] = [-99.1332, 19.4326];
const GROUP_PARAMS: Record<Group, [string, number]> = { adults: ['adultos', 2], children: ['ninos', 0], seniors: ['mayores', 0] };
const MAX_PER_GROUP = 10;
const MAX_BUDGET = 20000;
const MAX_RADIUS_KM = 20;
const DEFAULT_RADIUS_KM = 5;
const MARKER_RADIUS = 7;
const MAP_HEIGHT = 420;
const PRESETS = Object.keys(HOUR_PRESETS) as (keyof typeof HOUR_PRESETS)[];
const WHEN = { hoy: T.today, manana: T.tomorrow, fecha: T.pick } as const;
type When = keyof typeof WHEN;

const useStyles = makeStyles({
  row: { display: 'flex', flexWrap: 'wrap', gap: '12px 24px', alignItems: 'flex-end', margin: '10px 0' },
  grow: { flexGrow: 1, minWidth: '240px' },
  small: { width: '140px' },
  nota: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, margin: `${tokens.spacingVerticalS} 0 ${tokens.spacingVerticalM}` },
  more: { margin: '0 0 18px' },
});

function money(v: number | null): string {
  return `$${n(v)}`;
}

// `km` de labels.py usa el formato de Python '{km:.1f} km'.
function km(v: number): string {
  return T.km.replace('{km:.1f}', fixed(v, 1));
}

function groupText(group: Record<Group, number>): string {
  const parts = (Object.keys(group) as Group[]).filter((g) => group[g])
    .map((g) => `${group[g]} ${GROUP_LABEL[g][group[g] === 1 ? 0 : 1]}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : parts[0];
}

function whenText(r: Show, day: string): string {
  const hhmm = time_12(r.datetime_local.slice(11, 16));
  return r.date === day ? hhmm : `${date_es(r.date, false)}, ${hhmm}`;
}

// Dulcería del paquete elegido; sin paquete, la referencia de palomitas y refresco donde el cine publica su menú.
function snackCell(r: Show, snacks: Snacks): string {
  if (snacks !== 'none') return money(r.snacks_total);
  return r.snack_reference != null && r.snack_reference > 0 ? fill(T.snack_reference, { price: money(r.snack_reference) }) : T.snack_no_menu;
}

function cinemaText(r: Show): string {
  return `${r.cinema_name} · ${CHAIN_LABEL[r.chain]}`;
}

function cinemaCell(r: Show): Cell {
  return r.chain === 'cinemex' ? [cinemaText(r), 'cmx'] : cinemaText(r);
}

function formatText(key: string): string {
  return FORMAT_LABEL[key as keyof typeof FORMAT_LABEL] ?? key;
}

function promoCell(c: Promo): string {
  const program = c.program ? fill(T.promo_program, { program: c.program }) : '';
  if (c.applied) return fill(T.promo_in_total, { name: c.name, program });
  const price = c.price_max ? fill(T.promo_range, { low: money(c.price), high: money(c.price_max) }) : money(c.price);
  return fill(T.promo_cell, { name: c.name, program, price, people: c.people });
}

// `Table` con la columna de la promoción del día si alguna función la tiene, y qué incluye cada una.
function PromoTable({ headers, rows, shows, numCols }: { headers: string[]; rows: Cell[][]; shows: Show[]; numCols: number[] }) {
  const s = useStyles();
  const promos = shows.map((r) => r.promo);
  if (!promos.some(Boolean)) return <Table headers={headers} rows={rows} numCols={numCols} />;
  const lines = [...new Set([
    ...promos.flatMap((c) => (c ? [fill(T.promo_line, { name: c.name, includes: c.includes, condition: c.condition })] : [])),
    ...promos.flatMap((c) => (c?.program_about ? [c.program_about] : [])),
  ])];
  return (
    <>
      <Table
        headers={[...headers, T.col_promo]}
        rows={rows.map((row, i) => [...row, promos[i] ? promoCell(promos[i]!) : '—'])}
        numCols={[...numCols, headers.length]}
      />
      <p className={s.nota}>{[...lines, T.promo_note].join(' ')}</p>
    </>
  );
}

function int(value: string | null, fallback: number, max: number): number {
  const v = Number.parseInt(value ?? '', 10);
  return Number.isNaN(v) ? fallback : Math.min(Math.max(v, 0), max);
}

export default function Page() {
  const s = useStyles();
  const params = useSearchParams();
  const setParams = useSetParams();
  const day = today();

  const lat = params.get('lat');
  const lng = params.get('lng');
  const location = lat && lng ? { lat: Number(lat), lng: Number(lng) } : null;
  const source = params.get('origen');
  const group = Object.fromEntries((Object.keys(GROUP_PARAMS) as Group[])
    .map((g) => [g, int(params.get(GROUP_PARAMS[g][0]), GROUP_PARAMS[g][1], MAX_PER_GROUP)])) as Record<Group, number>;
  const people = group.adults + group.children + group.seniors;
  const budget = int(params.get('presupuesto'), 0, MAX_BUDGET);
  const snacks = (params.get('dulceria') ?? 'none') in SNACK_LABEL ? (params.get('dulceria') ?? 'none') as Snacks : 'none';
  const when = (params.get('cuando') ?? 'hoy') in WHEN ? (params.get('cuando') ?? 'hoy') as When : 'hoy';
  const d0 = when === 'hoy' ? day : when === 'manana' ? addDays(day, 1) : params.get('fecha') ?? day;
  const preset = PRESETS.find((p) => `${HOUR_PRESETS[p][0]}-${HOUR_PRESETS[p][1]}` === params.get('horas')) ?? PRESETS[0];
  const [h0, h1] = HOUR_PRESETS[preset];
  const radius = int(params.get('radio'), DEFAULT_RADIUS_KM, MAX_RADIUS_KM) || 1;
  const sort = (params.get('orden') ?? 'distance') in RECOMMEND_SORT ? (params.get('orden') ?? 'distance') as Sort : 'distance';
  const titleNorm = params.get('pelicula');
  const formats = (params.get('formatos') ?? '').split(',').filter((f) => (FORMAT_BUCKETS as readonly string[]).includes(f));

  const [data, setData] = React.useState<Recomendador | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [address, setAddress] = React.useState('');
  const [warning, setWarning] = React.useState<string | null>(null);
  const [locating, setLocating] = React.useState(false);

  const qs = new URLSearchParams({
    d0, adults: String(group.adults), children: String(group.children), seniors: String(group.seniors),
    budget: String(budget), snacks, h0: String(h0), h1: String(h1), radius_km: String(radius), sort,
  });
  if (location) {
    qs.set('lat', String(location.lat));
    qs.set('lng', String(location.lng));
  }
  if (titleNorm) qs.set('title_norm', titleNorm);
  formats.forEach((f) => qs.append('formats', f));
  const request = `/recomendador?${qs}`;
  React.useEffect(() => {
    api<Recomendador>(request).then((body) => { setData(body); setError(null); }, (e: Error) => setError(e.message));
  }, [request]);

  const setLocation = (point: { lat: number; lng: number }, origin: string) => {
    setWarning(null);
    setParams({ lat: point.lat.toFixed(5), lng: point.lng.toFixed(5), origen: origin });
  };

  const search = async () => {
    const q = address.trim();
    if (!q) return;
    try {
      const found = await api<GeoPoint | null>(`/recomendador/geocodificar?${new URLSearchParams({ q })}`);
      if (found) setLocation(found, found.label);
      else setWarning(T.not_found);
    } catch (e) {
      setWarning(e instanceof ApiError && e.status === 502 ? T.geocoder_down : (e as Error).message);
    }
  };

  const locate = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); setLocation({ lat: p.coords.latitude, lng: p.coords.longitude }, 'device'); },
      () => { setLocating(false); setWarning(T.locate_denied); },
    );
  };

  const mapPoints = React.useMemo(() => {
    const seen = new Set<string>();
    const cinemas: MapPoint[] = (data?.results ?? []).flatMap((r) => {
      const key = `${r.chain}:${r.cinema_id}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ siteId: key, lat: r.lat, lng: r.lng, radius: MARKER_RADIUS, color: CHAIN_COLOR[r.chain], opacity: 0.9, tip: cinemaText(r) }];
    });
    if (!location) return cinemas;
    return [...cinemas, { siteId: 'start', ...location, radius: MARKER_RADIUS + 2, color: PAPER, opacity: 1, tip: T.start,
      stroke: INK, strokeWidth: 3 }];
  }, [data, location?.lat, location?.lng]);

  const groupInput = (g: Group, label: string) => (
    <Field label={label} className={s.small}>
      <Input type="number" min={0} max={MAX_PER_GROUP} value={String(group[g])}
             onChange={(_, d) => setParams({ [GROUP_PARAMS[g][0]]: String(int(d.value, 0, MAX_PER_GROUP)) })} />
    </Field>
  );

  const plan = (
    <Seccion slug="rec-plan">
      <Pregunta texto={T.plan} conclusion={T.plan_desc} />
      <form className={s.row} onSubmit={(e) => { e.preventDefault(); search(); }}>
        <Field label={T.address} className={s.grow}>
          <Input value={address} placeholder={T.address_placeholder} onChange={(_, d) => setAddress(d.value)} />
        </Field>
        <Button type="submit" appearance="primary">{T.search}</Button>
        <Button type="button" onClick={locate}>{T.locate}</Button>
      </form>
      {locating && <p className={s.nota}>{`${T.locating} ${T.locate_https}`}</p>}
      {warning && <MessageBar intent="warning"><MessageBarBody>{warning}</MessageBarBody></MessageBar>}
      <div className={s.row}>
        {groupInput('adults', T.adults)}
        {groupInput('children', T.children)}
        {groupInput('seniors', T.seniors)}
        <Field label={T.budget} hint={T.budget_help} className={s.grow}>
          <Input type="number" min={0} max={MAX_BUDGET} step={100} value={String(budget)}
                 onChange={(_, d) => setParams({ presupuesto: String(int(d.value, 0, MAX_BUDGET)) })} />
        </Field>
      </div>
      <div className={s.row}>
        <FilterMenu label={T.snacks} icon={<FoodPizza20Regular />} value={snacks} options={Object.entries(SNACK_LABEL)}
                    onChange={(value) => setParams({ dulceria: value })} />
        <FilterMenu label={T.when} icon={<CalendarLtr20Regular />} value={when} options={Object.entries(WHEN)}
                    onChange={(value) => setParams({ cuando: value, fecha: value === 'fecha' ? d0 : null })} />
        {when === 'fecha' && (
          <Input type="date" aria-label={T.date} value={d0} min={data?.min_date ?? day} max={data?.max_date}
                 onChange={(_, d) => d.value && setParams({ fecha: d.value })} />
        )}
      </div>
    </Seccion>
  );

  const more = (
    <Accordion collapsible className={s.more}>
      <AccordionItem value="more">
        <AccordionHeader>{T.more}</AccordionHeader>
        <AccordionPanel>
          <div className={s.row}>
            <FilterMenu label={T.hours} icon={<Clock20Regular />} value={preset} options={PRESETS.map((p) => [p, p])}
                        onChange={(value) => setParams({ horas: value === PRESETS[0] ? null
                          : `${HOUR_PRESETS[value as typeof preset][0]}-${HOUR_PRESETS[value as typeof preset][1]}` })} />
            <Field label={`${T.radius}: ${radius}`} className={s.grow}>
              <Slider min={1} max={MAX_RADIUS_KM} value={radius} onChange={(_, d) => setParams({ radio: String(d.value) })} />
            </Field>
            <FilterMenu label={T.sort} icon={<ArrowSort20Regular />} value={sort} options={Object.entries(RECOMMEND_SORT)}
                        onChange={(value) => setParams({ orden: value })} />
          </div>
          {location && (
            <div className={s.row}>
              <FilterMenu label={T.title_filter} icon={<Filmstrip20Regular />} value={titleNorm ?? ''}
                          options={[['', T.any_title], ...(data?.titles ?? []).map((t): [string, string] => [t.title_norm, t.title])]}
                          onChange={(value) => setParams({ pelicula: value || null })} />
              <FilterChecks label={T.formats} values={formats} options={FORMAT_BUCKETS.map((f) => [f, FORMAT_LABEL[f]])}
                            onChange={(values) => setParams({ formatos: values.join(',') || null })} />
            </div>
          )}
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );

  const sourceText = source === 'click' ? T.from_click : source === 'device' ? T.from_device : fill(T.found, { label: source ?? '' });

  const map = (
    <Seccion slug="rec-mapa">
      <Pregunta texto={T.map} conclusion={T.map_desc} />
      <Leyenda items={(Object.keys(CHAIN_LABEL) as Chain[]).map((c) => [CHAIN_LABEL[c], CHAIN_COLOR[c]] as const)} />
      <CinemaMap
        points={mapPoints}
        center={location ? [location.lng, location.lat] : CDMX_CENTER}
        zoom={location ? 13 : 11}
        height={MAP_HEIGHT}
        ring={location ? { ...location, km: radius } : null}
        onMapClick={(clickLat, clickLng) => setLocation({ lat: clickLat, lng: clickLng }, 'click')}
      />
    </Seccion>
  );

  const info = (text: string) => <MessageBar intent="info"><MessageBarBody>{text}</MessageBarBody></MessageBar>;
  const results = () => {
    if (error) return <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>;
    if (!location) return info(T.no_location);
    if (!people) return info(T.group_empty);
    const summary = data?.summary;
    if (!data || !summary) return <SkeletonSeccion table />;
    const c = summary.cheapest;
    const near = summary.nearest;
    let text = '';
    if (summary.shows && c && near) {
      text = fill(budget ? T.summary_budget : T.summary_open, {
        group: groupText(group), shows: n(summary.shows), cinemas: n(summary.cinemas), snacks: SNACK_LABEL[snacks].toLowerCase(),
      });
      text += fill(T.summary_best, {
        cheapest: c.cinema_name, cheapest_total: money(c.total), cheapest_km: km(c.distance_km),
        nearest: near.cinema_name, nearest_km: km(near.distance_km),
      });
      if (summary.saving) text += fill(T.summary_saving, { saving: money(summary.saving) });
    }
    return (
      <>
        <Seccion slug="rec-resultados">
          {summary.shows ? (
            <>
              <Pregunta texto={T.results} conclusion={text} nota={fill(T.per_cinema_note, { n: data.per_cinema })} />
              <PromoTable
                headers={[T.col_cinema, T.col_title, T.col_time, T.col_format, T.col_language, T.col_tickets, T.col_snacks,
                  T.col_total, T.col_distance]}
                rows={data.results.map((r) => [cinemaCell(r), r.title, whenText(r, day), formatText(r.format_bucket),
                  LANGUAGE_LABEL[r.language as keyof typeof LANGUAGE_LABEL] ?? r.language, money(r.tickets_total),
                  snackCell(r, snacks), money(r.total), km(r.distance_km)])}
                shows={data.results}
                numCols={[5, 6, 7, 8]}
              />
            </>
          ) : (
            <Pregunta texto={T.results} conclusion={T.none} />
          )}
          <Leerla>{T.leer}</Leerla>
        </Seccion>

        {data.snacks_unpriced.length > 0 && (
          <Seccion slug="rec-sin-dulceria">
            <Pregunta texto={T.snacks_unpriced} conclusion={T.snacks_unpriced_desc} />
            <PromoTable
              headers={[T.col_cinema, T.col_title, T.col_time, T.col_format, T.col_tickets, T.col_distance]}
              rows={data.snacks_unpriced.map((r) => [cinemaCell(r), r.title, whenText(r, day), formatText(r.format_bucket),
                money(r.tickets_total), km(r.distance_km)])}
              shows={data.snacks_unpriced}
              numCols={[4, 5]}
            />
          </Seccion>
        )}

        <Apendice title={T.unpriced} resumen={fill(T.unpriced_summary, { n: n(summary.unpriced) })}>
          <p className={s.nota}>{T.unpriced_desc}</p>
          {data.unpriced.length > 0 && (
            <Table
              headers={[T.col_cinema, T.col_title, T.col_time, T.col_distance]}
              rows={data.unpriced.map((r) => [cinemaText(r), r.title, whenText(r, day), km(r.distance_km)])}
              numCols={[3]}
            />
          )}
        </Apendice>
        <PageFooter>{T.footer}</PageFooter>
      </>
    );
  };

  return (
    <>
      <PageHeader title={T.title} />
      {plan}
      {more}
      {location && source && <p className={s.nota}>{sourceText}</p>}
      {map}
      {results()}
    </>
  );
}
