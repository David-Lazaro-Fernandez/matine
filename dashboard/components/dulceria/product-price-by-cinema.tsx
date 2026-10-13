'use client';

// Barras en sala: el precio de un producto de Cinépolis en cada complejo, de mayor a menor, con la mediana punteada.
import { useMemo } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import type { ContenedorGrafica } from '@/components/common';
import { VegaChart } from '@/components/vega-chart';
import { CHAIN_COLOR, CINEMA_TYPE_LABEL, CONCESSION_CHART_TEXT as T, GRAY, GRAY_DARK, NEUTRAL } from '@/lib/labels.generated';

type CinemaType = keyof typeof CINEMA_TYPE_LABEL;
// Una fila de `analytics.concession_product_by_cinema`.
export type ProductByCinemaRow = { cinema_name: string; price: number; cinema_type: string };
// La fila del mismo producto en `analytics.concession_basket`.
export type BasketRow = { median_price: number };

const ROW = 9;

export function ProductPriceByCinema({ rows, basket, contenedor }: { rows: ProductByCinemaRow[]; basket: BasketRow; contenedor?: ContenedorGrafica }) {
  const spec = useMemo<VisualizationSpec>(() => {
    const bars = rows.map((r) => ({
      cinema: r.cinema_type === 'vip' ? T.vip_cinema.replace('{name}', r.cinema_name) : r.cinema_name,
      price: r.price,
      type: CINEMA_TYPE_LABEL[r.cinema_type as CinemaType],
    }));
    return {
      width: 'container',
      height: { step: ROW },
      layer: [
        {
          data: { values: bars },
          mark: 'bar',
          encoding: {
            y: {
              field: 'cinema', type: 'nominal', sort: null, title: null,
              axis: { labelLimit: 170, labelColor: GRAY_DARK, ticks: false, domain: false, labelFontSize: 10 },
            },
            x: { field: 'price', type: 'quantitative', title: T.price_axis, axis: { format: '$,.0f' } },
            color: {
              field: 'type', type: 'nominal',
              scale: { domain: [CINEMA_TYPE_LABEL.traditional, CINEMA_TYPE_LABEL.vip], range: [CHAIN_COLOR.cinepolis, NEUTRAL] },
              legend: { orient: 'top', title: null },
            },
            tooltip: [
              { field: 'cinema', type: 'nominal', title: T.cinema },
              { field: 'price', type: 'quantitative', title: T.price, format: '$,.0f' },
              { field: 'type', type: 'nominal', title: T.cinema_type },
            ],
          },
        },
        {
          data: { values: [{ median: basket.median_price }] },
          mark: { type: 'rule', color: GRAY, strokeDash: [4, 3] },
          encoding: { x: { field: 'median', type: 'quantitative' } },
        },
      ],
    };
  }, [rows, basket]);

  return <VegaChart spec={spec} height={ROW * rows.length + 70} contenedor={contenedor} />;
}
