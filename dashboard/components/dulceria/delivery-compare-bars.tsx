'use client';

// Barras a domicilio: el precio mediano de cada cadena por tipo de producto, una barra por cadena dentro de cada fila.
import { useMemo } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import type { ContenedorGrafica } from '@/components/common';
import { VegaChart } from '@/components/vega-chart';
import { CHAIN_COLOR, CHAIN_LABEL, COMPARED, CONCESSION_CHART_TEXT as T, GRAY_DARK } from '@/lib/labels.generated';

type Chain = (typeof COMPARED)[number];
// Una fila de `analytics.delivery_compare`.
export type DeliveryCompareRow = { label: string; delta_pct: number | null } & Record<`${Chain}_median`, number | null>;

const ROW = 30;
const CHAIN_DOMAIN = COMPARED.map((c) => CHAIN_LABEL[c]);

export function DeliveryCompareBars({ rows, contenedor }: { rows: DeliveryCompareRow[]; contenedor?: ContenedorGrafica }) {
  const spec = useMemo<VisualizationSpec>(() => {
    // Una barra por cubeta y cadena con precio: una cubeta que solo vende una cadena queda con una barra.
    const bars = rows.flatMap((r) =>
      COMPARED.filter((c) => r[`${c}_median`] != null).map((c) => ({
        label: r.label, delta_pct: r.delta_pct, chain: CHAIN_LABEL[c], price: r[`${c}_median`],
      })),
    );
    return {
      data: { values: bars },
      width: 'container',
      height: { step: ROW },
      mark: { type: 'bar', height: 11 },
      encoding: {
        y: {
          field: 'label', type: 'nominal', sort: rows.map((r) => r.label), title: null,
          axis: { labelLimit: 220, labelColor: GRAY_DARK, ticks: false, domain: false },
        },
        yOffset: { field: 'chain', type: 'nominal', sort: CHAIN_DOMAIN },
        x: { field: 'price', type: 'quantitative', title: T.price_axis, axis: { format: '$,.0f' } },
        color: { field: 'chain', type: 'nominal', legend: null, scale: { domain: CHAIN_DOMAIN, range: COMPARED.map((c) => CHAIN_COLOR[c]) } },
        tooltip: [
          { field: 'label', type: 'nominal', title: T.product },
          { field: 'chain', type: 'nominal', title: T.chain },
          { field: 'price', type: 'quantitative', title: T.median, format: '$,.0f' },
          { field: 'delta_pct', type: 'quantitative', title: T.delta_pct, format: '+.0f' },
        ],
      },
    };
  }, [rows]);

  return <VegaChart spec={spec} height={ROW * rows.length + 40} contenedor={contenedor} />;
}
