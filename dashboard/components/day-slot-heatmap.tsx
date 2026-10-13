'use client';

// Heatmap día×franja: la diferencia en pp entre la parte de parrilla de Cinemex y la de Cinépolis en cada celda.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import { VegaChart } from '@/components/vega-chart';
import { DIVERGING, INK, PAPER } from '@/lib/labels.generated';

type Cell = { day: string; slot_label: string; gap_pp: number; label: string; tooltip: string };

const ROW = 46;
// Ancho mínimo de una columna: debajo de él la gráfica se desplaza en vez de apretar las franjas.
const MIN_STEP = 134;
// Lo que ocupan los nombres de los días a la izquierda.
const DAY_LABELS_WIDTH = 100;

export function DaySlotHeatmap({ cells, days, slots, limit }: { cells: Cell[]; days: string[]; slots: string[]; limit: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setAvailable(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const spec = useMemo<VisualizationSpec>(() => {
    const presentDays = days.filter((d) => cells.some((c) => c.day === d));
    const presentSlots = slots.filter((s) => cells.some((c) => c.slot_label === s));
    return {
      data: { values: cells },
      width: { step: Math.max(MIN_STEP, Math.floor((available - DAY_LABELS_WIDTH) / presentSlots.length)) },
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
  }, [cells, days, slots, limit, available]);

  return <div ref={box}><VegaChart spec={spec} height={ROW * days.length + 40} /></div>;
}
