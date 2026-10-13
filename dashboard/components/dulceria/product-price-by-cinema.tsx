'use client';

// Columnas en sala: cuántos complejos de Cinépolis cobran cada precio de un producto, por tipo de complejo.
// Con decenas de complejos casi iguales, una barra por complejo no deja ver el patrón.
import { useMemo } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import { VegaChart } from '@/components/vega-chart';
import { CHAIN_COLOR, CINEMA_TYPE_LABEL, CONCESSION_CHART_TEXT as T, GRAY_DARK, NEUTRAL, PAPER } from '@/lib/labels.generated';

type CinemaType = keyof typeof CINEMA_TYPE_LABEL;
// Una fila de `analytics.concession_product_by_cinema`.
export type ProductByCinemaRow = { cinema_name: string; price: number; cinema_type: string };
const HEIGHT = 260;

export function ProductPriceByCinema({ rows }: { rows: ProductByCinemaRow[] }) {
  const spec = useMemo<VisualizationSpec>(() => {
    const cinemas = rows.map((r) => ({ price: r.price, type: CINEMA_TYPE_LABEL[r.cinema_type as CinemaType] }));
    const prices = [...new Set(cinemas.map((c) => c.price))].sort((a, b) => a - b);
    return {
      data: { values: cinemas },
      width: 'container',
      height: HEIGHT,
      layer: [
        {
          mark: { type: 'bar', cornerRadiusEnd: 4, stroke: PAPER, strokeWidth: 2, width: { band: 0.6 } },
          encoding: {
            x: {
              field: 'price', type: 'ordinal', sort: prices, title: T.price_axis,
              axis: { labelAngle: 0, labelColor: GRAY_DARK, ticks: false, labelExpr: "'$' + format(datum.value, ',.0f')" },
            },
            y: { aggregate: 'count', type: 'quantitative', title: T.cinemas_axis, axis: { tickMinStep: 1 } },
            color: {
              field: 'type', type: 'nominal',
              scale: { domain: [CINEMA_TYPE_LABEL.traditional, CINEMA_TYPE_LABEL.vip], range: [CHAIN_COLOR.cinepolis, NEUTRAL] },
              legend: { orient: 'top', title: null },
            },
            tooltip: [
              { field: 'price', type: 'quantitative', title: T.price, format: '$,.0f' },
              { field: 'type', type: 'nominal', title: T.cinema_type },
              { aggregate: 'count', type: 'quantitative', title: T.cinemas_axis },
            ],
          },
        },
      ],
    };
  }, [rows]);

  return <VegaChart spec={spec} height={HEIGHT + 70} />;
}
