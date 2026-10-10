'use client';

// Heatmap día×franja: la diferencia en pp entre la parte de parrilla de Cinemex y la de Cinépolis en cada celda.
import { HeatMapChart } from '@fluentui/react-charts';
import { DIVERGING } from '@/lib/labels.generated';

type Cell = { day: string; slot_label: string; gap_pp: number; label: string; tooltip: string };

export function DaySlotHeatmap({ cells, days, slots, limit }: { cells: Cell[]; days: string[]; slots: string[]; limit: number }) {
  const data = [
    {
      legend: '',
      value: 0,
      data: cells.map((c) => ({ x: c.slot_label, y: c.day, value: c.gap_pp, rectText: c.label, descriptionMessage: c.tooltip })),
    },
  ];
  // El eje y de Fluent crece hacia arriba: los días van al revés para que el primero quede arriba.
  return (
    <HeatMapChart
      data={data}
      domainValuesForColorScale={[-limit, -limit / 2, 0, limit / 2, limit]}
      rangeValuesForColorScale={[...DIVERGING]}
      xAxisCategoryOrder={slots.filter((s) => cells.some((c) => c.slot_label === s))}
      yAxisCategoryOrder={[...days].reverse()}
      hideLegend
      height={46 * days.length + 60}
      margins={{ left: 110, top: 10, right: 10, bottom: 40 }}
    />
  );
}
