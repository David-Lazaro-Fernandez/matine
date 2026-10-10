'use client';

// Pinta un spec de Vega-Lite con el estilo común de las gráficas del dashboard.
// Vega lee `document`, así que se importa dentro del efecto y nunca corre en el prerender.
import { useEffect, useRef } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import { vegaConfig } from '@/lib/vega-theme';

export function VegaChart({ spec, height }: { spec: VisualizationSpec; height: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let view: { finalize: () => void } | undefined;
    let cancelled = false;
    import('vega-embed').then(({ default: embed }) => {
      if (cancelled || !ref.current) return;
      embed(ref.current, spec, { actions: false, renderer: 'svg', config: vegaConfig }).then((result) => {
        if (cancelled) result.finalize();
        else view = result;
      });
    });
    return () => {
      cancelled = true;
      view?.finalize();
    };
  }, [spec]);

  // La altura reservada evita que la página salte cuando llega la gráfica.
  return <div ref={ref} style={{ minHeight: height }} />;
}
