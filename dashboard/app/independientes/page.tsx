'use client';

// Oferta independiente, como views/independientes.py: la Cineteca Nacional frente a nuestra cartelera de CDMX.
// Los datos salen de `GET /api/independientes`. El periodo es propio: la Cineteca publica hasta el miércoles en curso.
import * as React from 'react';
import {
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useSearchParams } from 'next/navigation';
import type { ComponentProps } from 'react';
import { Apendice, AppLink, Capa, type Cell, type Finding, Hallazgo, Leerla, Leyenda, Pregunta, Seccion, Table } from '@/components/common';
import { PlazaSelector, today, usePlaza, useSetParams } from '@/components/filters';
import { IndepOccupancyHeatmap } from '@/components/independientes/occupancy-heatmap';
import { IndepOverlapBars } from '@/components/independientes/overlap-bars';
import { IndepSlotsBars } from '@/components/independientes/slots-bars';
import { IndepTitlesBars } from '@/components/independientes/titles-bars';
import { ApiError, api, query } from '@/lib/api';
import { addDays, cinemaWeek, date_es, fill, fixed, n, range_es } from '@/lib/format';
import { CHAIN_COLOR, CHAIN_LABEL, COLUMN_LABEL, GRAY, INDEP, INDEP_TEXT as T, INK, LINE, RED } from '@/lib/labels.generated';

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
  enc: { padding: '6px 0 8px', borderBottom: `3px solid ${INK}`, marginBottom: '8px' },
  title: {
    fontSize: 'clamp(30px, 4.2vw, 46px)',
    fontWeight: 850,
    fontStretch: '75%',
    lineHeight: 1.02,
    margin: 0,
    '& span': { color: RED },
  },
  meta: { display: 'flex', flexWrap: 'wrap', gap: '6px 22px', padding: '12px 0 14px', color: GRAY, fontSize: '13.5px' },
  metaKey: { color: INK, fontWeight: 600 },
  filters: { display: 'flex', flexWrap: 'wrap', gap: '12px 28px', alignItems: 'flex-start', margin: '8px 0 22px' },
  dates: { display: 'flex', gap: tokens.spacingHorizontalS },
  chartTitle: { fontWeight: 700, margin: '10px 0 4px' },
  scroll: { maxHeight: '500px', overflow: 'auto' },
  pie: { marginTop: '48px', paddingTop: '16px', borderTop: `1px dashed ${LINE}`, color: GRAY, fontSize: '12.5px' },
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
      <Field label={T.period_header} hint={T.period_caption}>
        <RadioGroup
          aria-label={T.period_header}
          value={key}
          onChange={(_, data) => setParams(data.value === 'fechas'
            ? { periodo: data.value, d0, d1 }
            : { periodo: data.value, d0: null, d1: null })}
        >
          {(Object.keys(labels) as PeriodKey[]).map((k) => <Radio key={k} value={k} label={labels[k]} />)}
        </RadioGroup>
      </Field>
      {key === 'fechas' && (
        <Field label={T.period_range}>
          <div className={s.dates}>
            <Input type="date" value={d0} min={min} max={d1} onChange={(_, data) => data.value && setParams({ d0: data.value })} />
            <Input type="date" value={d1} min={d0} max={max} onChange={(_, data) => data.value && setParams({ d1: data.value })} />
          </div>
        </Field>
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
  const s = useStyles();
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
    <div className={s.enc}>
      {/* El título de labels.py lleva un <span> para la palabra en rojo. */}
      <h1 className={s.title} dangerouslySetInnerHTML={{ __html: T.title }} />
      {withMeta && (
        <div className={s.meta}>
          <span><strong className={s.metaKey}>{T.meta_zone}:</strong> {T.meta_zone_value}</span>
          <span><strong className={s.metaKey}>{T.meta_period}:</strong> {range_es(d0, d1)}</span>
          <span>{T.meta_note}</span>
        </div>
      )}
    </div>
  );
  const filters = (
    <div className={s.filters}>
      <PlazaSelector />
      {supported && <PeriodRadio />}
    </div>
  );

  const body = () => {
    if (!supported) return [header(false), filters, info(T.no_plaza)];
    if (error) return [header(false), filters, <MessageBar key="e" intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>];
    const empty = data !== null && data.d0 === d0 && data.d1 === d1 && !data.venues.length;
    if (!published || empty) return [header(false), filters, info(fill(T.no_data, { period: range_es(d0, d1) }))];
    if (!data) return [header(false), filters];
    return [header(true), filters, <Contenido key="c" data={data} />];
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
      <Capa num={1} title={T.layer1} desc={T.layer1_desc} roja />
      {!data.findings.length && info(data.occupancy_confirmed
        ? fill(T.layer1_none, { pct: fixed(th.indep_min_sold_pct, 0), n: th.indep_min_samples })
        : T.layer1_pending)}
      {data.findings.map((f) => <Hallazgo key={f.title} f={f} />)}

      <Capa num={2} title={T.layer2} desc={T.layer2_desc} />
      <Seccion slug="indep-programa">
        <Pregunta texto={T.q_programa} conclusion={c.programa} nota={T.programa_note} />
        <Leyenda items={indepLegend} />
        <p className={s.chartTitle}>{T.programa_chart}</p>
        <IndepTitlesBars titles={data.titles} />
        <Table {...table(data.venues, ['cinema_name', 'shows', 'titles', 'days', 'share_shows'])} />
        <Leerla>{T.leer_programa}</Leerla>
      </Seccion>

      <Seccion slug="indep-ocupacion">
        <Pregunta texto={T.q_ocupacion} conclusion={enough ? c.ocupacion : null} />
        {!data.occupancy_confirmed ? info(T.ocupacion_pending)
          : !enough ? info(fill(T.ocupacion_few, { n: data.occupancy_samples, min: th.occupancy_min_samples }))
            : (
              <>
                <Leyenda items={indepLegend} />
                <p className={s.chartTitle}>{T.ocupacion_chart}</p>
                <IndepOccupancyHeatmap cells={data.occupancy} />
                {data.occupancy_titles.length > 0 && (
                  <>
                    <p className={s.chartTitle}>{T.ocupacion_titles}</p>
                    <Table {...table(data.occupancy_titles, ['title', 'samples', 'sold_pct'])} />
                  </>
                )}
              </>
            )}
        <Leerla>{T.leer_ocupacion}</Leerla>
      </Seccion>

      <Seccion slug="indep-solape">
        <Pregunta texto={T.q_solape} conclusion={c.solape} />
        <Leyenda items={[[T.status.shared, CHAIN_COLOR.cinemex], [T.status.indep_only, INDEP]]} />
        <p className={s.chartTitle}>{T.solape_chart}</p>
        <IndepOverlapBars titles={data.overlap_top} />
        {only.length > 0 && (
          <>
            <p className={s.chartTitle}>{T.solape_only}</p>
            <div className={s.scroll}>
              <Table {...table(only, ['title', 'shows_indep', 'share_indep', ...(enough ? ['samples', 'sold_pct'] : [])])} />
            </div>
          </>
        )}
        <Leerla>{T.leer_solape}</Leerla>
      </Seccion>

      <Seccion slug="indep-franjas">
        <Pregunta texto={T.q_franjas} conclusion={c.franjas} />
        <Leyenda items={chainsHere.map((ch) => [CHAIN_LABEL[ch], CHAIN_COLOR[ch]] as const)} />
        <p className={s.chartTitle}>{T.franjas_chart}</p>
        <IndepSlotsBars slots={data.slots} />
        <Leerla>{T.leer_franjas}</Leerla>
      </Seccion>

      <Capa num={3} title={T.layer3} desc={T.layer3_desc} />
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
      <p className={s.pie}>{fill(T.footer, { first: date_es(data.first_snapshot) })}</p>
    </>
  );
}
