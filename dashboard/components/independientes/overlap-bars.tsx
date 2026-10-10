'use client';

// Barras de los títulos con más funciones de la cadena independiente, en rojo los que también exhibimos en la plaza.
import { useMemo } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import { VegaChart } from '@/components/vega-chart';
import { CHAIN_COLOR, COLUMN_LABEL, GRAY_DARK, INDEP, INDEP_TEXT } from '@/lib/labels.generated';

// Filas de `analytics.independent_overlap`.
type Overlap = {
  title_norm: string;
  title: string;
  shows_indep: number;
  share_indep: number;
  shows_vs: number;
  cinemas_vs: number;
  status: keyof typeof INDEP_TEXT.status;
  samples: number;
  sold_pct: number | null;
};

const ROW = 22;

export function IndepOverlapBars({ titles }: { titles: Overlap[] }) {
  const spec = useMemo<VisualizationSpec>(() => ({
    data: { values: titles.map((t) => ({ ...t, status_label: INDEP_TEXT.status[t.status] })) },
    width: 'container',
    height: { step: ROW },
    mark: 'bar',
    encoding: {
      y: { field: 'title', type: 'nominal', sort: null, title: null, axis: { labelLimit: 260, labelColor: GRAY_DARK, ticks: false, domain: false } },
      x: { field: 'share_indep', type: 'quantitative', title: COLUMN_LABEL.share_indep },
      color: {
        field: 'status_label', type: 'nominal', legend: null,
        scale: { domain: [INDEP_TEXT.status.shared, INDEP_TEXT.status.indep_only], range: [CHAIN_COLOR.cinemex, INDEP] },
      },
      tooltip: [
        { field: 'title', type: 'nominal', title: COLUMN_LABEL.title },
        { field: 'status_label', type: 'nominal', title: COLUMN_LABEL.status },
        { field: 'shows_indep', type: 'quantitative', title: COLUMN_LABEL.shows_indep },
        { field: 'shows_vs', type: 'quantitative', title: COLUMN_LABEL.shows_vs },
      ],
    },
  }), [titles]);

  return <VegaChart spec={spec} height={ROW * titles.length + 40} />;
}
