'use client';

// Oferta independiente, como views/independientes.py: la Cineteca Nacional frente a nuestra cartelera de CDMX.
// Los datos salen de `GET /api/independientes`. El periodo es propio: la Cineteca publica hasta el miércoles en curso.
import * as React from 'react';
import {
  Input,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { CalendarLtr20Regular } from '@fluentui/react-icons';
import { useSearchParams } from 'next/navigation';
import type { ComponentProps } from 'react';
import {
  Apendice,
  AppLink,
  type Cell,
  type Finding,
  Hallazgo,
  Leerla,
  Leyenda,
  PageFooter,
  PageHeader,
  Pregunta,
  Seccion,
  Table,
  SkeletonCapas,
} from '@/components/common';
import { FilterMenu, PlazaSelector, today, usePlaza, useSetParams } from '@/components/filters';
import { IndepOccupancyHeatmap } from '@/components/independientes/occupancy-heatmap';
import { IndepOverlapBars } from '@/components/independientes/overlap-bars';
import { IndepSlotsBars } from '@/components/independientes/slots-bars';
import { IndepTitlesBars } from '@/components/independientes/titles-bars';
import { ApiError, api, query } from '@/lib/api';
import { addDays, cinemaWeek, date_es, fill, fixed, n, range_es } from '@/lib/format';
import { CHAIN_COLOR, CHAIN_LABEL, COLUMN_LABEL, INDEP, INDEP_TEXT as T } from '@/lib/labels.generated';

type Row = Record<string, string | number | null>;
type Overlap = ComponentProps<typeof IndepOverlapBars>['titles'][number];
type Independientes = {
  supported: boolean;
  d0: string;
  d1: string;
  first_snapshot: string;
  occupancy_confirmed: boolean;
  thresholds: { occupancy_days: number; occupancy_min_samples: number; indep_min_sold_pct: number; indep_min_samples: number };
  venues: Row[];
  conclusions: Record<string, string>;
  findings: Finding[];
  titles: ComponentProps<typeof IndepTitlesBars>['titles'];
  occupancy: ComponentProps<typeof IndepOccupancyHeatmap>['cells'];
  occupancy_samples: number;
  occupancy_readable: boolean;
  occupancy_titles: Row[];
  overlap: Overlap[];
  overlap_top: Overlap[];
  slots: ComponentProps<typeof IndepSlotsBars>['slots'];
  board: Row[];
  capacity: Row[];
};

const INDEP_CHAIN = 'cineteca';
type PeriodKey = 'hoy' | 'manana' | 'semana' | 'fechas';
const DEFAULT_PERIOD: PeriodKey = 'semana';
const ONE_DECIMAL = ['share_shows', 'share_indep', 'sold_pct', 'avg_seats'];
const TEXT_COLUMNS = ['cinema_name', 'title', 'first_date', 'last_date'];

const useStyles = makeStyles({
  dates: { display: 'flex', gap: tokens.spacingHorizontalS },
  chartTitle: { fontWeight: tokens.fontWeightSemibold, margin: `${tokens.spacingVerticalS} 0 ${tokens.spacingVerticalXS}` },
  scroll: { maxHeight: '500px', overflow: 'auto' },
});

// El periodo de la URL dentro de ayer y el miércoles de la semana de cine en curso, el rango que acepta la API.
// Una clave de otra página, como la semana siguiente, cae en el resto de la semana.
function usePeriod(): { key: PeriodKey; d0: string; d1: string; min: string; max: string } {
  const params = useSearchParams();
  const day = today();
  const [min, max] = [addDays(day, -1), cinemaWeek(day)[1]];
  const ranges: Record<Exclude<PeriodKey, 'fechas'>, [string, string]> = {
    hoy: [day, day],
    manana: [addDays(day, 1), addDays(day, 1)],
    semana: [day, max],
  };
  const raw = params.get('periodo') as PeriodKey;
  const key = raw === 'fechas' || raw in ranges ? raw : DEFAULT_PERIOD;
  if (key !== 'fechas') return { key, d0: ranges[key][0], d1: ranges[key][1], min, max };
  const clamp = (iso: string) => (iso < min ? min : iso > max ? max : iso);
  const d0 = clamp(params.get('d0') ?? day);
  const d1 = clamp(params.get('d1') ?? max);
  return { key, d0, d1: d1 < d0 ? d0 : d1, min, max };
}

function PeriodRadio() {
  const s = useStyles();
  const setParams = useSetParams();
  const { key, d0, d1, min, max } = usePeriod();
  const labels: Record<PeriodKey, string> = {
    hoy: T.period_today,
    manana: T.period_tomorrow,
    semana: fill(T.period_week, { d1: date_es(max, false) }),
    fechas: T.period_pick,
  };
  return (
    <>
      <FilterMenu
        label={T.period_header}
        icon={<CalendarLtr20Regular />}
        value={key}
        note={T.period_caption}
        options={(Object.keys(labels) as PeriodKey[]).map((k) => [k, labels[k]])}
        onChange={(value) => setParams(value === 'fechas' ? { periodo: value, d0, d1 } : { periodo: value, d0: null, d1: null })}
      />
      {key === 'fechas' && (
        <div className={s.dates}>
          <Input type="date" aria-label={T.period_range} value={d0} min={min} max={d1} onChange={(_, data) => data.value && setParams({ d0: data.value })} />
          <Input type="date" aria-label={T.period_range} value={d1} min={d0} max={max} onChange={(_, data) => data.value && setParams({ d1: data.value })} />
        </div>
      )}
    </>
  );
}

// Celdas de una tabla como `pretty()` de ui/common.py, con los encabezados de COLUMN_LABEL.
function table(rows: Row[], columns: string[]) {
  return {
    headers: columns.map((c) => COLUMN_LABEL[c as keyof typeof COLUMN_LABEL] ?? c),
    rows: rows.map((r) => columns.map((c): Cell => {
      const v = r[c];
      return typeof v === 'number' ? n(v, ONE_DECIMAL.includes(c) ? 1 : 0) : v ?? '';
    })),
    numCols: columns.flatMap((c, i) => (TEXT_COLUMNS.includes(c) ? [] : [i])),
  };
}

// Las negritas de labels.py vienen en markdown: '**Precio.** Texto' → <b>Precio.</b> Texto.
function bold(text: string) {
  return text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}

function sum(rows: Row[], column: string): number {
  return rows.reduce((total, r) => total + Number(r[column] ?? 0), 0);
}

export default function Page() {
  const plaza = usePlaza();
  const { d0, d1, max } = usePeriod();
  const [data, setData] = React.useState<Independientes | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Mañana puede caer después del miércoles: la Cineteca aún no publica y la API no lo acepta.
  const published = d0 <= max;
  const supported = plaza === null || plaza === 'cdmx';
  const request = `/independientes${query({ plaza, d0, d1 })}`;
  React.useEffect(() => {
    if (!published || !supported) return;
    let live = true;
    setError(null);
    api<Independientes>(request).then(
      (body) => live && setData(body),
      (e) => live && setError(e instanceof ApiError && e.status === 503 ? T.no_db : (e instanceof ApiError && e.detail) || String(e)),
    );
    return () => { live = false; };
  }, [request, published, supported]);

  const info = (text: string) => <MessageBar intent="info"><MessageBarBody>{text}</MessageBarBody></MessageBar>;
  const header = (withMeta: boolean) => (
    <PageHeader
      key="h"
      title={T.title}
      meta={withMeta ? [[`${T.meta_period}:`, range_es(d0, d1)], T.meta_note] : undefined}
    >
      <PlazaSelector />
      {supported && <PeriodRadio />}
    </PageHeader>
  );

  const body = () => {
    if (!supported) return [header(false), info(T.no_plaza)];
    if (error) return [header(false), <MessageBar key="e" intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>];
    const empty = data !== null && data.d0 === d0 && data.d1 === d1 && !data.venues.length;
    if (!published || empty) return [header(false), info(fill(T.no_data, { period: range_es(d0, d1) }))];
    if (!data) return [header(false), <SkeletonCapas key="s" findings={2} sections={4} appendices={3} />];
    return [header(true), <Contenido key="c" data={data} />];
  };

  return <>{body().map((node, i) => <React.Fragment key={i}>{node}</React.Fragment>)}</>;
}

function Contenido({ data }: { data: Independientes }) {
  const s = useStyles();
  const c = data.conclusions;
  const th = data.thresholds;
  const enough = data.occupancy_readable;
  const indepLegend = [[CHAIN_LABEL[INDEP_CHAIN], INDEP]] as const;
  const only = data.overlap.filter((o) => o.status === 'indep_only');
  const present = new Set(data.slots.map((r) => r.chain));
  const chainsHere = (['cinemex', INDEP_CHAIN] as const).filter((ch) => present.has(ch));
  const info = (text: string) => <MessageBar intent="info"><MessageBarBody>{text}</MessageBarBody></MessageBar>;

  return (
    <>
      {!data.findings.length && info(data.occupancy_confirmed
        ? fill(T.layer1_none, { pct: fixed(th.indep_min_sold_pct, 0), n: th.indep_min_samples })
        : T.layer1_pending)}
      {data.findings.map((f) => <Hallazgo key={f.topic} f={f} />)}

      <Seccion slug="indep-programa">
        <Pregunta texto={T.q_programa} conclusion={c.programa} nota={T.programa_note} />
        <Leyenda items={indepLegend} />
        <p className={s.chartTitle}>{T.programa_chart}</p>
        <IndepTitlesBars titles={data.titles} contenedor={{ ayuda: <Leerla>{T.leer_programa}</Leerla> }} />
        <Table {...table(data.venues, ['cinema_name', 'shows', 'titles', 'days', 'share_shows'])} />
      </Seccion>

      <Seccion slug="indep-ocupacion">
        <Pregunta texto={T.q_ocupacion} conclusion={enough ? c.ocupacion : null} />
        {!data.occupancy_confirmed ? info(T.ocupacion_pending)
          : !enough ? info(fill(T.ocupacion_few, { n: data.occupancy_samples, min: th.occupancy_min_samples }))
            : (
              <>
                <Leyenda items={indepLegend} />
                <p className={s.chartTitle}>{T.ocupacion_chart}</p>
                <IndepOccupancyHeatmap cells={data.occupancy} contenedor={{ ayuda: <Leerla>{T.leer_ocupacion}</Leerla> }} />
                {data.occupancy_titles.length > 0 && (
                  <>
                    <p className={s.chartTitle}>{T.ocupacion_titles}</p>
                    <Table {...table(data.occupancy_titles, ['title', 'samples', 'sold_pct'])} />
                  </>
                )}
              </>
            )}
      </Seccion>

      <Seccion slug="indep-solape">
        <Pregunta texto={T.q_solape} conclusion={c.solape} />
        <Leyenda items={[[T.status.shared, CHAIN_COLOR.cinemex], [T.status.indep_only, INDEP]]} />
        <p className={s.chartTitle}>{T.solape_chart}</p>
        <IndepOverlapBars titles={data.overlap_top} contenedor={{ ayuda: <Leerla>{T.leer_solape}</Leerla> }} />
        {only.length > 0 && (
          <>
            <p className={s.chartTitle}>{T.solape_only}</p>
            <div className={s.scroll}>
              <Table {...table(only, ['title', 'shows_indep', 'share_indep', ...(enough ? ['samples', 'sold_pct'] : [])])} />
            </div>
          </>
        )}
      </Seccion>

      <Seccion slug="indep-franjas">
        <Pregunta texto={T.q_franjas} conclusion={c.franjas} />
        <Leyenda items={chainsHere.map((ch) => [CHAIN_LABEL[ch], CHAIN_COLOR[ch]] as const)} />
        <p className={s.chartTitle}>{T.franjas_chart}</p>
        <IndepSlotsBars slots={data.slots} contenedor={{ ayuda: <Leerla>{T.leer_franjas}</Leerla> }} />
      </Seccion>

      <Apendice title={T.app_board} resumen={fill(T.app_board_summary, { titles: n(data.board.length), shows: n(sum(data.board, 'shows')) })}>
        <div className={s.scroll}>
          <Table {...table(data.board, ['title', 'shows', 'cinemas', 'share_shows', 'spanish', 'subtitled', 'other', 'first_date', 'last_date'])} />
        </div>
      </Apendice>
      <Apendice
        title={T.app_capacity}
        resumen={data.capacity.length ? fill(T.app_capacity_summary, { screens: n(sum(data.capacity, 'screens')), cinemas: n(data.capacity.length) }) : null}
      >
        {data.capacity.length
          ? <Table {...table(data.capacity, ['cinema_name', 'screens', 'seats', 'avg_seats', 'min_seats', 'max_seats'])} />
          : info(T.app_capacity_empty)}
      </Apendice>
      <Apendice title={T.app_pending} resumen={T.app_pending_summary}>
        <ul>{T.pending_items.map((item) => <li key={item}>{bold(item)}</li>)}</ul>
      </Apendice>

      <p><AppLink href="/">{T.back}</AppLink></p>
      <PageFooter>{fill(T.footer, { first: date_es(data.first_snapshot) })}</PageFooter>
    </>
  );
}
