'use client';

// Heatmap día×franja: la diferencia en pp entre la parte de parrilla de Cinemex y la de Cinépolis en cada celda.
import { useMemo } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import type { ContenedorGrafica } from '@/components/common';
import { VegaChart } from '@/components/vega-chart';
import { useIsMobile } from '@/lib/mobile';
import { DIVERGING, INK, PAPER } from '@/lib/labels.generated';

type Cell = { day: string; slot_label: string; gap_pp: number; label: string; tooltip: string };

const ROW = 46;

export function DaySlotHeatmap({ cells, days, slots, limit, contenedor }: {
  cells: Cell[]; days: string[]; slots: string[]; limit: number; contenedor?: ContenedorGrafica;
}) {
  const movil = useIsMobile();
  const spec = useMemo<VisualizationSpec>(() => {
    const presentDays = days.filter((d) => cells.some((c) => c.day === d));
    const presentSlots = slots.filter((s) => cells.some((c) => c.slot_label === s));
    return {
      data: { values: cells },
      width: movil ? 'container' : { step: 134 },
      height: { step: ROW },
      encoding: {
        x: {
          field: 'slot_label', type: 'nominal', sort: presentSlots, title: null,
          axis: { labelAngle: 0, orient: 'top', labelFontSize: 12, ticks: false, domain: false, labelPadding: 6, labelOverlap: false, labelLimit: 0 },
        },
        y: {
          field: 'day', type: 'nominal', sort: presentDays, title: null,
          axis: { ticks: false, domain: false, labelFontSize: 13, labelFontWeight: 'bold', labelColor: INK, labelPadding: 10 },
        },
      },
      layer: [
        {
          mark: { type: 'rect', stroke: PAPER, strokeWidth: 4, cornerRadius: 4 },
          encoding: {
            color: {
              field: 'gap_pp', type: 'quantitative', legend: null,
              scale: { domain: [-limit, -limit / 2, 0, limit / 2, limit], range: [...DIVERGING], interpolate: 'lab' },
            },
            tooltip: { field: 'tooltip' },
          },
        },
        {
          mark: { type: 'text', fontSize: 13.5, fontWeight: 'bold' },
          encoding: {
            text: { field: 'label' },
            color: { condition: { test: `abs(datum.gap_pp) > ${limit * 0.5}`, value: PAPER }, value: INK },
          },
        },
      ],
    };
  }, [cells, days, slots, limit, movil]);

  return <VegaChart spec={spec} height={ROW * days.length + 40} contenedor={contenedor} />;
}
