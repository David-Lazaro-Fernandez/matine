'use client';

// Pinta un spec de Vega-Lite con el estilo común de las gráficas del dashboard, con su PNG y su CSV para descargar.
// Vega lee `document`, así que se importa dentro del efecto y nunca corre en el prerender.
import { useEffect, useRef, useState } from 'react';
import { Button, makeStyles, tokens } from '@fluentui/react-components';
import { ArrowDownload16Regular } from '@fluentui/react-icons';
import type { VisualizationSpec } from 'vega-embed';
import { SkeletonBlock } from '@/components/common';
import { downloadCsv, downloadUrl } from '@/lib/download';
import { useCanDownload } from '@/lib/session';
import { COLUMN_LABEL, DOWNLOAD_TEXT } from '@/lib/labels.generated';
import { vegaConfig } from '@/lib/vega-theme';

type Embedded = { finalize: () => void; view: { toImageURL: (type: 'png', scale?: number) => Promise<string> } };
type Datum = Record<string, unknown>;

const useStyles = makeStyles({
  actions: { '@media print': { display: 'none' }, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: tokens.spacingHorizontalXS, '& > button': { flexShrink: 0 } },
});

// Campos que solo sirven para dibujar la gráfica: no van al CSV.
const DRAWING_FIELDS = ['tooltip', 'light', 'orden'];

// Los renglones del spec: los de arriba, o los primeros que traiga una capa o una gráfica compuesta.
function specRows(spec: unknown): Datum[] {
  const part = spec as { data?: { values?: Datum[] }; layer?: unknown[]; hconcat?: unknown[]; vconcat?: unknown[] };
  if (part.data?.values) return part.data.values;
  for (const child of [...(part.layer ?? []), ...(part.hconcat ?? []), ...(part.vconcat ?? [])]) {
    const found = specRows(child);
    if (found.length) return found;
  }
  return [];
}

export function VegaChart({ spec, height, name = DOWNLOAD_TEXT.chart }: { spec: VisualizationSpec; height: number; name?: string }) {
  const s = useStyles();
  const ref = useRef<HTMLDivElement>(null);
  const embedded = useRef<Embedded | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('vega-embed').then(({ default: embed }) => {
      if (cancelled || !ref.current) return;
      embed(ref.current, spec, { actions: false, renderer: 'svg', config: vegaConfig }).then((result) => {
        if (cancelled) result.finalize();
        else { embedded.current = result; setReady(true); }
      });
    });
    return () => {
      cancelled = true;
      embedded.current?.finalize();
      embedded.current = null;
    };
  }, [spec]);

  const canDownload = useCanDownload();
  const png = async () => embedded.current && downloadUrl(`${name}.png`, await embedded.current.view.toImageURL('png', 2));
  const rows = specRows(spec);
  const downloadRows = () => {
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !DRAWING_FIELDS.includes(k));
    const text = (v: unknown) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
    downloadCsv(name, keys.map((k) => COLUMN_LABEL[k as keyof typeof COLUMN_LABEL] ?? k), rows.map((r) => keys.map((k) => text(r[k]))));
  };

  // La altura reservada evita que la página salte cuando llega la gráfica.
  return (
    <>
      {!ready && <SkeletonBlock height={height} />}
      {/* Una gráfica de ancho fijo, como el heatmap de siete días, se desplaza dentro de su caja en celular. */}
      {/* Vega pone `display: inline-block` en su caja, así que el desplazamiento va en una caja de afuera. */}
      <div style={{ overflowX: 'auto' }}>
        {/* El ancho completo deja que un spec con `width: 'container'` llene la tarjeta; uno de ancho fijo no cambia. */}
        <div ref={ref} style={{ width: '100%', minHeight: ready ? height : 0 }} />
      </div>
      {ready && canDownload && (
        <div className={s.actions}>
          <Button appearance="subtle" size="small" icon={<ArrowDownload16Regular />} onClick={png}>{DOWNLOAD_TEXT.png}</Button>
          {rows.length > 0 && (
            <Button appearance="subtle" size="small" icon={<ArrowDownload16Regular />} onClick={downloadRows}>{DOWNLOAD_TEXT.csv}</Button>
          )}
        </div>
      )}
    </>
  );
}
