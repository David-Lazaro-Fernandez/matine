'use client';

// Barras agrupadas por franja: el % de la programación de cada cadena, la nuestra junto a la independiente.
import { useMemo } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import { VegaChart } from '@/components/vega-chart';
import { CHAIN_COLOR, CHAIN_LABEL, COLUMN_LABEL, SLOTS, SLOT_SHORT } from '@/lib/labels.generated';

type Chain = keyof typeof CHAIN_LABEL;
// Filas de `analytics.independent_slots`.
type Slot = { slot: keyof typeof SLOT_SHORT; chain: Chain; shows: number; share: number };

const HEIGHT = 260;

export function IndepSlotsBars({ slots }: { slots: Slot[] }) {
  const spec = useMemo<VisualizationSpec>(() => {
    // Las filas traen nuestra cadena primero y solo las cadenas con funciones.
    const chains = [...new Set(slots.map((s) => s.chain))];
    const domain = chains.map((c) => CHAIN_LABEL[c]);
    return {
      data: { values: slots.map((s) => ({ ...s, chain_label: CHAIN_LABEL[s.chain], slot_label: SLOT_SHORT[s.slot] })) },
      width: 'container',
      height: HEIGHT,
      mark: 'bar',
      encoding: {
        x: { field: 'slot_label', type: 'nominal', sort: SLOTS.map(([key]) => SLOT_SHORT[key]), title: null, axis: { labelAngle: 0 } },
        xOffset: { field: 'chain_label', type: 'nominal', sort: domain },
        y: { field: 'share', type: 'quantitative', title: COLUMN_LABEL.share },
        color: { field: 'chain_label', type: 'nominal', legend: null, scale: { domain, range: chains.map((c) => CHAIN_COLOR[c]) } },
        tooltip: [
          { field: 'chain_label', type: 'nominal', title: COLUMN_LABEL.chain },
          { field: 'slot_label', type: 'nominal', title: COLUMN_LABEL.slot },
          { field: 'shows', type: 'quantitative', title: COLUMN_LABEL.shows },
          { field: 'share', type: 'quantitative', title: COLUMN_LABEL.share, format: '.1f' },
        ],
      },
    };
  }, [slots]);

  return <VegaChart spec={spec} height={HEIGHT + 40} />;
}
