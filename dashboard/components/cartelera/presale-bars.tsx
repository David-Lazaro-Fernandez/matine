'use client';

// Barras de preventa: el % de las butacas del panel ya vendidas por título y cadena.
// Con `paired`, cada título lleva una barra por cadena, una debajo de la otra.
import { useMemo } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import type { ContenedorGrafica } from '@/components/common';
import { VegaChart } from '@/components/vega-chart';
import { fill, fixed, signed, thousands } from '@/lib/format';
import {
  CARTELERA_CHART_TEXT as TEXT, CHAIN_COLOR, CHAIN_LABEL, COMPARED, GRAY_DARK, PRESALE_OTHER_LABEL, PRESALE_TAG,
} from '@/lib/labels.generated';

// Una fila de `analytics.presale_by_chain`.
export type PresaleRow = {
  title: string; release_date: string | null; status: string; chain: string; title_norm: string; shows: number;
  sold: number; seats: number; sold_pct: number; pace_pct_day: number | null; in_other_chain: string;
};

const TITLE_MAX = 42;
// Ancho de la etiqueta de título y ancho total de la gráfica, en píxeles. Las barras quedan con el resto.
const PRESALE_LABEL_WIDTH = 200;
const PRESALE_WIDTH = 480;
const PERCENT_TICKS = [0, 25, 50, 75, 100];

type Chain = (typeof COMPARED)[number];
const chainLabel = (c: string) => CHAIN_LABEL[c as Chain];

// 'Título muy largo…' a 42 caracteres, como la vista de Streamlit.
const shortTitle = (t: string) => (t.length <= TITLE_MAX ? t : `${t.slice(0, TITLE_MAX - 1).trimEnd()}…`);

// '2026-10-17' → 'sábado 17 de octubre', como `labels.date_es(d, with_year=False)`.
function releaseEs(iso: string | null): string {
  if (!iso) return TEXT.presale_no_release;
  const parts = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .formatToParts(new Date(`${iso}T00:00:00Z`));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part('weekday')} ${part('day')} de ${part('month')}`;
}

export function PresaleBars({ rows, paired, contenedor }: { rows: PresaleRow[]; paired: boolean; contenedor?: ContenedorGrafica }) {
  const spec = useMemo<VisualizationSpec>(() => {
    const values = rows.map((r) => {
      const sold = fill(TEXT.percent, { value: fixed(r.sold_pct, 0) });
      const other = chainLabel(COMPARED.find((c) => c !== r.chain) ?? r.chain);
      const tag = PRESALE_TAG[r.in_other_chain as keyof typeof PRESALE_TAG];
      return {
        ...r,
        Título: shortTitle(r.title),
        Cadena: chainLabel(r.chain),
        Estreno: releaseEs(r.release_date),
        Vendido: sold,
        Butacas: fill(TEXT.presale_seats_value, { sold: thousands(r.sold), seats: thousands(r.seats) }),
        Ritmo: r.pace_pct_day == null ? TEXT.presale_pace_pending : fill(TEXT.presale_pace_value, { pace: signed(r.pace_pct_day) }),
        'En la otra cadena': fill(PRESALE_OTHER_LABEL[r.in_other_chain as keyof typeof PRESALE_OTHER_LABEL], { other }),
        Etiqueta: tag ? fill(TEXT.presale_tagged, { sold, tag }) : sold,
      };
    });
    const order = [...new Set([...values].sort((a, b) => b.sold_pct - a.sold_pct).map((v) => v.Título))];
    const chainDomain = COMPARED.map(chainLabel);
    const encoding = {
      y: {
        field: 'Título', type: 'nominal' as const, sort: order, title: null,
        axis: { labelLimit: PRESALE_LABEL_WIDTH, labelColor: GRAY_DARK, ticks: false, domain: false },
      },
      color: {
        field: 'Cadena', type: 'nominal' as const, legend: null,
        scale: { domain: chainDomain, range: COMPARED.map((c) => CHAIN_COLOR[c]) },
      },
      tooltip: [
        { field: 'title', type: 'nominal' as const, title: TEXT.presale_title },
        { field: 'Cadena', type: 'nominal' as const, title: TEXT.chain },
        { field: 'Estreno', type: 'nominal' as const, title: TEXT.presale_release },
        { field: 'shows', type: 'quantitative' as const, title: TEXT.presale_shows },
        { field: 'Butacas', type: 'nominal' as const, title: TEXT.presale_seats },
        { field: 'Vendido', type: 'nominal' as const, title: TEXT.presale_sold },
        { field: 'Ritmo', type: 'nominal' as const, title: TEXT.presale_pace },
        { field: 'En la otra cadena', type: 'nominal' as const, title: TEXT.presale_other },
      ],
      ...(paired ? { yOffset: { field: 'Cadena', type: 'nominal' as const, sort: chainDomain } } : {}),
    };
    return {
      data: { values },
      // Ancho fijo: en celular la caja de `VegaChart` se desplaza, como el rival de Cines, y no aplasta las barras.
      width: PRESALE_WIDTH,
      height: Math.max(90, (paired ? 34 : 26) * order.length),
      layer: [
        {
          mark: { type: 'bar', height: paired ? 11 : 16 },
          encoding: {
            ...encoding,
            x: {
              field: 'sold_pct', type: 'quantitative', title: TEXT.presale_axis, scale: { domain: [0, 100] },
              axis: { grid: true, values: PERCENT_TICKS, labelExpr: `datum.value + '${fill(TEXT.percent, { value: '' })}'` },
            },
          },
        },
        {
          mark: { type: 'text', align: 'left', dx: 4, fontSize: 11, fontWeight: 'bold' },
          encoding: { ...encoding, x: { field: 'sold_pct', type: 'quantitative' }, text: { field: 'Etiqueta', type: 'nominal' } },
        },
      ],
    };
  }, [rows, paired]);

  const titles = new Set(rows.map((r) => r.title)).size;
  return <VegaChart spec={spec} height={Math.max(90, (paired ? 34 : 26) * titles) + 40} contenedor={contenedor} />;
}
