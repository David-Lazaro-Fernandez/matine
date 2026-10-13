'use client';

// Dumbbell de películas: el % de la programación de cada cadena por película, unidos por una línea, con la diferencia
// escrita a la derecha.
import { useMemo } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import type { ContenedorGrafica } from '@/components/common';
import { VegaChart } from '@/components/vega-chart';
import { CHAIN_COLOR, COMPARED, GRAY_DARK, NEUTRAL, US } from '@/lib/labels.generated';

type Chain = (typeof COMPARED)[number];
type Movie = {
  title: string;
  delta: string;
  winner: string;
  tooltip: Partial<Record<Chain, string>>;
} & Record<`share_${Chain}` | `shows_${Chain}`, number | null>;

const ROW = 24;

export function MoviesDumbbell({ movies, axisTitle, contenedor }: { movies: Movie[]; axisTitle: string; contenedor?: ContenedorGrafica }) {
  const spec = useMemo<VisualizationSpec>(() => {
    const order = movies.map((m) => m.title);
    // Un punto por película y cadena que la proyecta: una exclusiva queda con un solo punto.
    const points = movies.flatMap((m) =>
      COMPARED.filter((c) => m[`shows_${c}`]).map((c) => ({ title: m.title, chain: c, share: m[`share_${c}`], tooltip: m.tooltip[c] })),
    );
    const y = { field: 'title', type: 'nominal' as const, sort: order };
    return {
      hconcat: [
        {
          width: 620,
          height: { step: ROW },
          data: { values: points },
          encoding: {
            y: { ...y, title: null, axis: { labelLimit: 300, labelColor: GRAY_DARK, labelFontSize: 12.5, ticks: false, domain: false, labelPadding: 10 } },
          },
          layer: [
            {
              mark: { type: 'rule', strokeWidth: 2, color: NEUTRAL },
              encoding: {
                x: { aggregate: 'min', field: 'share', type: 'quantitative', title: axisTitle, axis: { grid: true, tickCount: 6 } },
                x2: { aggregate: 'max', field: 'share' },
              },
            },
            {
              mark: { type: 'circle', size: 120, opacity: 1 },
              encoding: {
                x: { field: 'share', type: 'quantitative' },
                color: { field: 'chain', type: 'nominal', legend: null, scale: { domain: [...COMPARED], range: COMPARED.map((c) => CHAIN_COLOR[c]) } },
                tooltip: { field: 'tooltip' },
              },
            },
          ],
        },
        {
          width: 110,
          height: { step: ROW },
          data: { values: movies },
          mark: { type: 'text', align: 'left', fontSize: 12.5, fontWeight: 'bold' },
          encoding: {
            y: { ...y, axis: null },
            x: { value: 4 },
            text: { field: 'delta' },
            color: { condition: { test: `datum.winner === '${US}'`, value: CHAIN_COLOR[US] }, value: GRAY_DARK },
          },
        },
      ],
      spacing: 6,
      resolve: { scale: { y: 'shared' } },
    };
  }, [movies, axisTitle]);

  return <VegaChart spec={spec} height={ROW * movies.length + 50} contenedor={contenedor} />;
}
