'use client';

// Pantalla Cines: la venta por cine medida en el plano de asientos (`GET /api/cartelera/cines`, `analytics.cinema_sales`).
// No depende del periodo de la barra: es lo ya vendido en los últimos días.
import * as React from 'react';
import { MessageBar, MessageBarBody, Switch, makeStyles, tokens } from '@fluentui/react-components';
import type { VisualizationSpec } from 'vega-embed';
import { useDataColor } from '@/app/providers';
import { type Cell, Leerla, Pregunta, Seccion, SkeletonSeccion, Table, useApi } from '@/components/common';
import { VegaChart } from '@/components/vega-chart';
import { query } from '@/lib/api';
import { fill, fixed, n, pp } from '@/lib/format';
import { CHAIN_COLOR, CHAIN_LABEL, CINES_TEXT as T, COMPARED, GRAY_DARK, NEUTRAL, PAPER, US } from '@/lib/labels.generated';

type Chain = (typeof COMPARED)[number];
type ChainTotal = { chain: Chain; cinemas: number; shows: number; sold_pct: number; sold_pct_prev: number | null };
type Cinema = {
  chain: Chain; cinema_id: string; cinema_name: string; shows: number; sold: number; sold_pct: number;
  sold_pct_prev: number | null; delta_pp: number | null;
};
type Site = { name: string; cinemas: string[]; shows: number; sold: number; sold_pct: number; delta_pp: number | null };
type Neighbor = { name: string; sold_pct: number; km: number };
type Competitor = Site & { neighbors: Neighbor[] };
type Rival = Record<Chain, Site> & { km: number; rivals: number; gap_pp: number };
type Cines = {
  days: number; min_shows: number; max_km: number; chains: ChainTotal[]; cinemas: Cinema[]; competitors: Competitor[];
  rivals: Rival[];
};

// Los lugares de Cinépolis que se ven antes de pedir todos.
const TOP = 15;
const NEIGHBORS = 3;
const ROW = 22;
// Margen derecho donde se escribe la diferencia de cada duelo.
const GAP_WIDTH = 70;
// Nombres de cine, diferencia y un tramo legible del eje.
const RIVALS_MIN_WIDTH = 560;
// 110 px por cadena: los cines de Cinemex se juntan entre 1 % y 10 % y necesitan alto para no encimarse.
const SPREAD_HEIGHT = 220;
const SPREAD_BIN = 0.6;

const useStyles = makeStyles({
  totals: { display: 'flex', flexWrap: 'wrap', gap: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalXXXL}`, margin: `${tokens.spacingVerticalS} 0` },
  total: { display: 'flex', flexDirection: 'column' },
  totalValue: { fontSize: tokens.fontSizeHero700, lineHeight: tokens.lineHeightHero700, fontWeight: tokens.fontWeightSemibold, fontVariantNumeric: 'tabular-nums' },
  totalLabel: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
});

const percent = (v: number | null) => (v == null ? '—' : `${fixed(v, 1)} %`);

// Cada cine es un punto en el renglón de su cadena: muestra cómo se reparten, no solo los extremos. Los cines con un %
// parecido (misma cubeta de `SPREAD_BIN` puntos) se apilan centrados, 0, +1, −1, +2…: la altura de la pila es cuántos son.
function spreadSpec(cinemas: Cinema[], axis: string): VisualizationSpec {
  const stacked = new Map<string, number>();
  const values = cinemas.map((c) => {
    const bin = `${c.chain}:${Math.round(c.sold_pct / SPREAD_BIN)}`;
    const k = stacked.get(bin) ?? 0;
    stacked.set(bin, k + 1);
    return { ...c, chain_label: CHAIN_LABEL[c.chain], stack: k % 2 ? (k + 1) / 2 : -k / 2, tooltip: `${c.cinema_name} · ${percent(c.sold_pct)}` };
  });
  const tallest = Math.max(1, ...values.map((v) => Math.abs(v.stack)));
  return {
    width: 'container',
    height: SPREAD_HEIGHT,
    data: { values },
    mark: { type: 'circle', size: 64, opacity: 0.85, stroke: PAPER, strokeWidth: 2 },
    encoding: {
      y: { field: 'chain_label', type: 'nominal', title: null, sort: COMPARED.map((c) => CHAIN_LABEL[c]), axis: { labelColor: GRAY_DARK, ticks: false, domain: false } },
      x: { field: 'sold_pct', type: 'quantitative', title: axis, axis: { grid: true } },
      yOffset: { field: 'stack', type: 'quantitative', scale: { domain: [-tallest - 1, tallest + 1] } },
      color: { field: 'chain', type: 'nominal', legend: null, scale: { domain: [...COMPARED], range: COMPARED.map((c) => CHAIN_COLOR[c]) } },
      tooltip: { field: 'tooltip' },
    },
  };
}

// Pesas: el % vendido de cada lugar de Cinemex y el de su rival número uno, unidos por una línea.
function rivalsSpec(duels: Rival[], axis: string): VisualizationSpec {
  const label = (d: Rival) => `${d[US].name} · ${d.cinepolis.name}`;
  const order = duels.map(label);
  const points = duels.flatMap((d) => COMPARED.map((c) => ({
    pair: label(d), chain: c, sold_pct: d[c].sold_pct, tooltip: `${d[c].cinemas.join(' + ')} · ${percent(d[c].sold_pct)}`,
  })));
  const y = { field: 'pair', type: 'nominal' as const, sort: order };
  return {
    width: 'container',
    height: { step: ROW },
    encoding: { y: { ...y, title: null, axis: { labelLimit: 260, labelColor: GRAY_DARK, ticks: false, domain: false, labelPadding: 8 } } },
    padding: { right: GAP_WIDTH },
    layer: [
      {
        data: { values: points },
        mark: { type: 'rule', strokeWidth: 2, color: NEUTRAL },
        encoding: {
          x: { aggregate: 'min', field: 'sold_pct', type: 'quantitative', title: axis, axis: { grid: true } },
          x2: { aggregate: 'max', field: 'sold_pct' },
        },
      },
      {
        data: { values: points },
        mark: { type: 'circle', size: 90, opacity: 1 },
        encoding: {
          x: { field: 'sold_pct', type: 'quantitative' },
          color: { field: 'chain', type: 'nominal', legend: null, scale: { domain: [...COMPARED], range: COMPARED.map((c) => CHAIN_COLOR[c]) } },
          tooltip: { field: 'tooltip' },
        },
      },
      {
        data: { values: duels.map((d) => ({ pair: label(d), delta: pp(d.gap_pp), ahead: d.gap_pp > 0 })) },
        mark: { type: 'text', align: 'left', dx: 8, fontWeight: 'bold' },
        encoding: {
          x: { value: { expr: 'width' } },
          text: { field: 'delta' },
          color: { condition: { test: 'datum.ahead', value: CHAIN_COLOR[US] }, value: GRAY_DARK },
        },
      },
    ],
  };
}

function Ranking({ data }: { data: Cines }) {
  const s = useStyles();
  const dataColor = useDataColor();
  return (
    <Seccion slug="ranking">
      <Pregunta texto={T.q_ranking} />
      <div className={s.totals}>
        {data.chains.map((t) => (
          <div key={t.chain} className={s.total}>
            <span className={s.totalValue} style={{ color: dataColor(CHAIN_COLOR[t.chain]) }}>{percent(t.sold_pct)}</span>
            <span className={s.totalLabel}>
              {`${CHAIN_LABEL[t.chain]} · ${fill(T.previous, { days: data.days, pct: t.sold_pct_prev == null ? '—' : fixed(t.sold_pct_prev, 1) })}`}
            </span>
          </div>
        ))}
      </div>
      <VegaChart spec={spreadSpec(data.cinemas, T.axis)} height={SPREAD_HEIGHT + 40} name="venta_por_cine" />
      <Leerla>{fill(T.leer_ranking, { days: data.days, min: data.min_shows })}</Leerla>
    </Seccion>
  );
}

function Competidores({ data }: { data: Cines }) {
  const [all, setAll] = React.useState(false);
  const shown = all ? data.competitors : data.competitors.slice(0, TOP);
  // Los tres más cercanos; el resto se cuenta.
  const neighbors = (c: Competitor) => {
    if (!c.neighbors.length) return T.no_neighbors;
    const named = c.neighbors.slice(0, NEIGHBORS).map((nb) => fill(T.neighbor, { name: nb.name, pct: fixed(nb.sold_pct, 1) }));
    const rest = c.neighbors.length - NEIGHBORS;
    return [...named, ...(rest > 0 ? [fill(T.more_neighbors, { n: rest })] : [])].join(' · ');
  };
  return (
    <Seccion slug="competidores">
      <Pregunta texto={T.q_competitors} />
      <Table
        headers={T.competitor_headers.map((h) => fill(h, { days: data.days, km: fixed(data.max_km, 0) }))}
        rows={shown.map((c, i): Cell[] => [
          String(i + 1), c.cinemas.join(' + '), n(c.sold), [percent(c.sold_pct), 'cnp'], c.delta_pp == null ? '—' : pp(c.delta_pp),
          neighbors(c),
        ])}
        numCols={[0, 2, 3, 4]}
        wideCols={[1, 5]}
      />
      {data.competitors.length > TOP && (
        <Switch checked={all} onChange={(_, d) => setAll(d.checked)} label={fill(T.show_all, { n: data.competitors.length })} />
      )}
      <Leerla>{T.leer_competitors}</Leerla>
    </Seccion>
  );
}

function Rivales({ data }: { data: Cines }) {
  const s = useStyles();
  const ahead = data.rivals.filter((d) => d.gap_pp > 0).length;
  return (
    <Seccion slug="rivales">
      <Pregunta texto={T.q_rivals} />
      <div className={s.totals}>
        <div className={s.total}>
          <span className={s.totalValue}>{`${ahead} / ${data.rivals.length}`}</span>
          <span className={s.totalLabel}>{T.ahead}</span>
        </div>
      </div>
      <VegaChart spec={rivalsSpec(data.rivals, T.axis)} height={ROW * data.rivals.length + 50} minWidth={RIVALS_MIN_WIDTH} name="rival_numero_uno" />
      <Table
        headers={[...T.rival_headers]}
        rows={data.rivals.map((d): Cell[] => [
          d[US].cinemas.join(' + '), d.gap_pp > 0 ? [percent(d[US].sold_pct), 'cmx'] : percent(d[US].sold_pct), d.cinepolis.cinemas.join(' + '), [percent(d.cinepolis.sold_pct), 'cnp'],
          pp(d.gap_pp), fill(T.km, { km: fixed(d.km, 1) }), String(d.rivals),
        ])}
        numCols={[1, 3, 4, 5, 6]}
        wideCols={[0, 2]}
      />
      <Leerla>{fill(T.leer_rivals, { km: fixed(data.max_km, 0) })}</Leerla>
    </Seccion>
  );
}

export function CinesView({ plaza }: { plaza: string | null }) {
  const { data, error } = useApi<Cines>(`/cartelera/cines${query({ plaza })}`);
  if (error) return <MessageBar intent="error"><MessageBarBody>{String(error)}</MessageBarBody></MessageBar>;
  if (!data) return <><SkeletonSeccion /><SkeletonSeccion table /><SkeletonSeccion /></>;
  if (!data.cinemas.length) return <MessageBar intent="info"><MessageBarBody>{T.empty}</MessageBarBody></MessageBar>;
  return (
    <>
      <Ranking data={data} />
      {data.competitors.length > 0 && <Competidores data={data} />}
      {data.rivals.length > 0 && <Rivales data={data} />}
    </>
  );
}
