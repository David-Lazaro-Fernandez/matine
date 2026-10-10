'use client';

// Barras de los títulos con más funciones de la cadena independiente, en % de su propia programación.
import { useMemo } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import { VegaChart } from '@/components/vega-chart';
import { COLUMN_LABEL, GRAY_DARK, INDEP } from '@/lib/labels.generated';

// Filas de `analytics.independent_titles`.
type Title = { title_norm: string; title: string; shows: number; cinemas: number; share_shows: number };

const ROW = 22;

export function IndepTitlesBars({ titles }: { titles: Title[] }) {
  const spec = useMemo<VisualizationSpec>(() => ({
    data: { values: titles },
    width: 'container',
    height: { step: ROW },
    mark: { type: 'bar', color: INDEP },
    encoding: {
      y: { field: 'title', type: 'nominal', sort: null, title: null, axis: { labelLimit: 260, labelColor: GRAY_DARK, ticks: false, domain: false } },
      x: { field: 'share_shows', type: 'quantitative', title: COLUMN_LABEL.share_shows },
      tooltip: [
        { field: 'title', type: 'nominal', title: COLUMN_LABEL.title },
        { field: 'shows', type: 'quantitative', title: COLUMN_LABEL.shows },
        { field: 'cinemas', type: 'quantitative', title: COLUMN_LABEL.cinemas },
        { field: 'share_shows', type: 'quantitative', title: COLUMN_LABEL.share_shows, format: '.1f' },
      ],
    },
  }), [titles]);

  return <VegaChart spec={spec} height={ROW * titles.length + 40} />;
}
