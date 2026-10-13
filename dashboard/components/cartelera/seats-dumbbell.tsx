'use client';

// Dumbbell de funciones frente a butacas por película de una cadena: el círculo es su parte de las funciones y el
// cuadro su parte de las butacas ofertadas. Recibe las filas de `analytics.offered_by_title`.
import { useMemo } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import type { ContenedorGrafica } from '@/components/common';
import { VegaChart } from '@/components/vega-chart';
import { CHAIN_COLOR, CHAIN_LABEL, COLUMN_LABEL, GRAY_DARK, NEUTRAL, SEATS_CHART_TEXT } from '@/lib/labels.generated';

type Chain = keyof typeof CHAIN_LABEL;
export type OfferedByTitle = {
  title_norm: string;
  title: string;
  shows: number;
  seats: number;
  share_shows: number;
  share_seats: number;
  avg_seats: number;
};

const ROW = 24;
const MEASURES = ['share_shows', 'share_seats'] as const;

export function SeatsDumbbell({ rows, chain, contenedor }: { rows: OfferedByTitle[]; chain: Chain; contenedor?: ContenedorGrafica }) {
  const spec = useMemo<VisualizationSpec>(() => {
    const order = rows.map((r) => r.title.trim());
    const points = rows.flatMap((r) =>
      MEASURES.map((m) => ({ ...r, title: r.title.trim(), measure: COLUMN_LABEL[m], share: r[m] })),
    );
    const measures = MEASURES.map((m) => COLUMN_LABEL[m]);
    const y = {
      field: 'title', type: 'nominal' as const, sort: order, title: null,
      axis: { labelLimit: 260, labelColor: GRAY_DARK, ticks: false, domain: false },
    };
    const legend = { orient: 'top' as const, title: null };
    return {
      width: 'container',
      height: { step: ROW },
      data: { values: points },
      layer: [
        {
          mark: { type: 'rule', strokeWidth: 2, color: NEUTRAL },
          encoding: {
            y,
            x: {
              aggregate: 'min', field: 'share', type: 'quantitative',
              title: SEATS_CHART_TEXT.axis.replace('{chain}', CHAIN_LABEL[chain]),
            },
            x2: { aggregate: 'max', field: 'share' },
          },
        },
        {
          mark: { type: 'point', size: 110, filled: true, opacity: 1 },
          encoding: {
            y,
            x: { field: 'share', type: 'quantitative' },
            shape: { field: 'measure', type: 'nominal', scale: { domain: measures, range: ['circle', 'square'] }, legend },
            color: { field: 'measure', type: 'nominal', scale: { domain: measures, range: [NEUTRAL, CHAIN_COLOR[chain]] }, legend },
            tooltip: [
              { field: 'title', type: 'nominal', title: COLUMN_LABEL.title },
              { field: 'measure', type: 'nominal', title: SEATS_CHART_TEXT.measure },
              { field: 'share', type: 'quantitative', title: SEATS_CHART_TEXT.share, format: '.1f' },
              { field: 'shows', type: 'quantitative', title: COLUMN_LABEL.shows },
              { field: 'seats', type: 'quantitative', title: COLUMN_LABEL.seats, format: ',' },
              { field: 'avg_seats', type: 'quantitative', title: COLUMN_LABEL.avg_seats },
            ],
          },
        },
      ],
    };
  }, [rows, chain]);

  return <VegaChart spec={spec} height={ROW * rows.length + 70} contenedor={contenedor} />;
}
