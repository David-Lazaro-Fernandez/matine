'use client';

// Curva de venta de un título: el % de las butacas vendidas según los días que faltaban para la función, por cadena.
import { useMemo } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import { VegaChart } from '@/components/vega-chart';
import { fill } from '@/lib/format';
import { CARTELERA_CHART_TEXT as TEXT, CHAIN_COLOR, CHAIN_LABEL, COMPARED } from '@/lib/labels.generated';

// Una fila de `analytics.presale_curve`.
export type CurveRow = { days_to_start: number; readings: number; seats: number; sold: number; sold_pct: number };
type Chain = (typeof COMPARED)[number];

const HEIGHT = 220;

// `curves` lleva la respuesta de `presale_curve` de cada cadena que tiene el título en preventa.
export function PresaleCurve({ curves }: { curves: Partial<Record<Chain, CurveRow[]>> }) {
  const spec = useMemo<VisualizationSpec>(() => {
    const values = COMPARED.flatMap((c) => (curves[c] ?? []).map((r) => ({ ...r, Cadena: CHAIN_LABEL[c] })));
    return {
      data: { values },
      width: 'container',
      height: HEIGHT,
      mark: { type: 'line', point: { size: 40 } },
      encoding: {
        x: { field: 'days_to_start', type: 'quantitative', title: TEXT.curve_x, scale: { reverse: true } },
        y: {
          field: 'sold_pct', type: 'quantitative', title: TEXT.curve_y, scale: { domain: [0, 100] },
          axis: { values: [0, 25, 50, 75, 100], labelExpr: `datum.value + '${fill(TEXT.percent, { value: '' })}'` },
        },
        color: {
          field: 'Cadena', type: 'nominal', legend: null,
          scale: { domain: COMPARED.map((c) => CHAIN_LABEL[c]), range: COMPARED.map((c) => CHAIN_COLOR[c]) },
        },
        tooltip: [
          { field: 'Cadena', type: 'nominal', title: TEXT.chain },
          { field: 'days_to_start', type: 'quantitative', title: TEXT.curve_days },
          { field: 'readings', type: 'quantitative', title: TEXT.curve_readings },
          { field: 'sold_pct', type: 'quantitative', title: TEXT.curve_sold, format: '.1f' },
        ],
      },
    };
  }, [curves]);

  return <VegaChart spec={spec} height={HEIGHT + 50} />;
}
