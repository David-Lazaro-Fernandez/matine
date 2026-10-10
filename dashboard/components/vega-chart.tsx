'use client';

// Pinta un spec de Vega-Lite con el estilo común de las gráficas del dashboard.
// Vega lee `document`, así que se importa dentro del efecto y nunca corre en el prerender.
import { useEffect, useRef, useState } from 'react';
import type { VisualizationSpec } from 'vega-embed';
import { SkeletonBlock } from '@/components/common';
import { vegaConfig } from '@/lib/vega-theme';

export function VegaChart({ spec, height }: { spec: VisualizationSpec; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let view: { finalize: () => void } | undefined;
    let cancelled = false;
    import('vega-embed').then(({ default: embed }) => {
      if (cancelled || !ref.current) return;
      embed(ref.current, spec, { actions: false, renderer: 'svg', config: vegaConfig }).then((result) => {
        if (cancelled) result.finalize();
        else { view = result; setReady(true); }
      });
    });
    return () => {
      cancelled = true;
      view?.finalize();
    };
  }, [spec]);

  // La altura reservada evita que la página salte cuando llega la gráfica.
  return (
    <>
      {!ready && <SkeletonBlock height={height} />}
      <div ref={ref} style={{ minHeight: ready ? height : 0 }} />
    </>
  );
}
