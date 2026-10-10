'use client';

// Duración de cada corrida de captura en el tiempo: un punto por corrida con el color de su cadena y una cruz si falló.
// Recibe las filas de `scraper.health.recent_runs`.
import { useMemo } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import { VegaChart } from '@/components/vega-chart';
import { CHAIN_COLOR, CHAIN_LABEL, COLUMN_LABEL, OPS_TEXT, WARN } from '@/lib/labels.generated';

type Chain = keyof typeof CHAIN_LABEL;
export type RecentRun = {
  id: number;
  chain: Chain;
  taken_at: string;
  finished_at: string | null;
  ok: number | null;
  n_shows: number | null;
  n_cinemas: number | null;
  n_events: number | null;
  calls: number | null;
  duration_s: number | null;
  error: string | null;
};

const HEIGHT = 200;
const TIME_FORMAT = '%d/%m %H:%M';

export function RunsChart({ runs }: { runs: RecentRun[] }) {
  const spec = useMemo<VisualizationSpec>(() => {
    const values = runs.map((r) => ({
      ...r, ok: Boolean(r.ok), chain_label: CHAIN_LABEL[r.chain], duration_s: r.duration_s ?? 0,
    }));
    const chains = (Object.keys(CHAIN_LABEL) as Chain[]).filter((c) => runs.some((r) => r.chain === c));
    return {
      width: 'container',
      height: HEIGHT,
      data: { values },
      encoding: {
        x: { field: 'taken_at', type: 'temporal', title: OPS_TEXT.runs_chart_x, axis: { format: TIME_FORMAT } },
        y: { field: 'duration_s', type: 'quantitative', title: OPS_TEXT.runs_chart_y },
        tooltip: [
          { field: 'chain_label', type: 'nominal', title: COLUMN_LABEL.chain },
          { field: 'taken_at', type: 'temporal', title: COLUMN_LABEL.taken_at, format: TIME_FORMAT },
          { field: 'duration_s', type: 'quantitative', title: COLUMN_LABEL.duration_s, format: '.0f' },
          { field: 'n_shows', type: 'quantitative', title: COLUMN_LABEL.n_shows, format: ',' },
          { field: 'calls', type: 'quantitative', title: COLUMN_LABEL.calls },
        ],
      },
      layer: [
        {
          transform: [{ filter: 'datum.ok' }],
          mark: { type: 'circle', size: 70 },
          encoding: {
            color: {
              field: 'chain_label', type: 'nominal', legend: null,
              scale: { domain: chains.map((c) => CHAIN_LABEL[c]), range: chains.map((c) => CHAIN_COLOR[c]) },
            },
          },
        },
        {
          transform: [{ filter: '!datum.ok' }],
          mark: { type: 'point', size: 110, shape: 'cross', filled: true, color: WARN },
        },
      ],
    };
  }, [runs]);

  return <VegaChart spec={spec} height={HEIGHT + 50} />;
}
