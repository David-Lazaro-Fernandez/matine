'use client';

// Heatmap sede×franja del % de butacas vendidas tras el inicio en la cadena independiente.
import { useMemo } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import type { ContenedorGrafica } from '@/components/common';
import { VegaChart } from '@/components/vega-chart';
import { COLUMN_LABEL, GRAY_LIGHT, INDEP, SLOTS, SLOT_SHORT } from '@/lib/labels.generated';

// Filas de `analytics.occupancy_by_cinema`.
type Cell = { cinema_id: string; cinema_name: string; slot: keyof typeof SLOT_SHORT; samples: number; seats: number; sold_pct: number };

const ROW = 40;

export function IndepOccupancyHeatmap({ cells, contenedor }: { cells: Cell[]; contenedor?: ContenedorGrafica }) {
  const spec = useMemo<VisualizationSpec>(() => ({
    data: { values: cells.map((c) => ({ ...c, slot_label: SLOT_SHORT[c.slot] })) },
    width: 'container',
    height: { step: ROW },
    mark: 'rect',
    encoding: {
      x: { field: 'slot_label', type: 'nominal', sort: SLOTS.map(([key]) => SLOT_SHORT[key]), title: null },
      y: { field: 'cinema_name', type: 'nominal', title: null },
      color: {
        field: 'sold_pct', type: 'quantitative',
        scale: { range: [GRAY_LIGHT, INDEP] }, legend: { title: COLUMN_LABEL.sold_pct },
      },
      tooltip: [
        { field: 'cinema_name', type: 'nominal', title: COLUMN_LABEL.cinema_name },
        { field: 'slot_label', type: 'nominal', title: COLUMN_LABEL.slot },
        { field: 'samples', type: 'quantitative', title: COLUMN_LABEL.samples },
        { field: 'sold_pct', type: 'quantitative', title: COLUMN_LABEL.sold_pct, format: '.1f' },
      ],
    },
  }), [cells]);

  const cinemas = new Set(cells.map((c) => c.cinema_id)).size;
  return <VegaChart spec={spec} height={ROW * cinemas + 60} contenedor={contenedor} />;
}
