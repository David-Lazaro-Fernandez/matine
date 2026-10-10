'use client';

// Barras 100 % por cadena con la mezcla de formatos o de idiomas de su programación.
import { useMemo } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import { VegaChart } from '@/components/vega-chart';
import { fill, fixed } from '@/components/cartelera/format';
import {
  CARTELERA_CHART_TEXT as TEXT, CHAIN_LABEL, COMPARED, FORMAT_BUCKETS, FORMAT_LABEL, INK, LANGUAGE_BUCKETS,
  LANGUAGE_LABEL, PAPER, RED, RED_RAMP, RED_RAMP_TEXT, US,
} from '@/lib/labels.generated';

// Una fila de `analytics.mix`.
export type MixRow = { dimension: string; chain: string; bucket: string; shows: number; share: number };

const DIMENSIONS = {
  format: { buckets: FORMAT_BUCKETS, label: FORMAT_LABEL as Record<string, string>, palette: RED_RAMP, firstLight: 2 },
  language: { buckets: LANGUAGE_BUCKETS, label: LANGUAGE_LABEL as Record<string, string>, palette: [RED_RAMP[1], RED_RAMP[3]], firstLight: 1 },
};
const MIN_LABELED_SHARE = 7;
const HEIGHT = 90;

export function MixBars({ rows, dimension }: { rows: MixRow[]; dimension: keyof typeof DIMENSIONS }) {
  const spec = useMemo<VisualizationSpec>(() => {
    const { buckets, label, palette, firstLight } = DIMENSIONS[dimension];
    const order: string[] = [...buckets];
    const values = rows
      .filter((r) => r.dimension === dimension)
      .map((r) => ({
        ...r,
        Cadena: CHAIN_LABEL[r.chain as keyof typeof CHAIN_LABEL],
        Grupo: label[r.bucket],
        orden: order.indexOf(r.bucket),
        label: r.share >= MIN_LABELED_SHARE ? fill(TEXT.percent, { value: fixed(r.share, 0) }) : '',
        // Tonos claros: texto oscuro.
        light: order.indexOf(r.bucket) >= firstLight,
      }));
    const domain = buckets.map((b) => label[b]);
    const chainDomain = COMPARED.map((c) => CHAIN_LABEL[c]);
    const x = { field: 'share', type: 'quantitative' as const, stack: 'normalize' as const };
    return {
      data: { values },
      width: 'container',
      height: HEIGHT,
      layer: [
        {
          mark: { type: 'bar', cornerRadius: 0, stroke: PAPER, strokeWidth: 1.5, height: 26 },
          encoding: {
            y: {
              field: 'Cadena', type: 'nominal', sort: chainDomain, title: null,
              axis: {
                ticks: false, domain: false, labelFontSize: 13, labelFontWeight: 'bold', labelPadding: 10,
                labelColor: { condition: { test: `datum.value == '${CHAIN_LABEL[US]}'`, value: RED }, value: INK },
              },
            },
            x: { ...x, title: null, axis: null },
            order: { field: 'orden', type: 'quantitative' },
            color: { field: 'Grupo', type: 'nominal', scale: { domain, range: palette.slice(0, domain.length) }, legend: null },
            tooltip: [
              { field: 'Cadena', type: 'nominal', title: TEXT.chain },
              { field: 'Grupo', type: 'nominal', title: TEXT.group },
              { field: 'share', type: 'quantitative', title: TEXT.mix_share, format: '.1f' },
              { field: 'shows', type: 'quantitative', title: TEXT.mix_shows },
            ],
          },
        },
        {
          mark: { type: 'text', fontSize: 11.5, fontWeight: 'bold' },
          encoding: {
            y: { field: 'Cadena', type: 'nominal', sort: chainDomain },
            x: { ...x, bandPosition: 0.5 },
            order: { field: 'orden', type: 'quantitative' },
            text: { field: 'label', type: 'nominal' },
            detail: { field: 'Grupo', type: 'nominal' },
            color: { condition: { test: 'datum.light', value: RED_RAMP_TEXT }, value: PAPER },
          },
        },
      ],
    };
  }, [rows, dimension]);

  return <VegaChart spec={spec} height={HEIGHT + 10} />;
}
