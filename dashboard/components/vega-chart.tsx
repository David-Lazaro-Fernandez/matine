'use client';

// Pinta un spec de Vega-Lite con el estilo común de las gráficas del dashboard, con su PNG y su CSV para descargar.
// Vega lee `document`, así que se importa dentro del efecto y nunca corre en el prerender.
// Un `GraficaGrupo` junta varias gráficas en un solo contenedor: su PNG une las imágenes y su CSV une los datos.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Image20Regular, Table20Regular } from '@fluentui/react-icons';
import type { VisualizationSpec } from 'vega-embed';
import { type Boton, type Enlace } from '@/components/acciones';
import { Grafica, type ContenedorGrafica, SkeletonBlock } from '@/components/common';
import { downloadCsv, downloadUrl } from '@/lib/download';
import { useCanDownload } from '@/lib/session';
import { COLUMN_LABEL, DOWNLOAD_TEXT } from '@/lib/labels.generated';
import { vegaConfig } from '@/lib/vega-theme';

type Embedded = { finalize: () => void; view: { toImageURL: (type: 'png', scale?: number) => Promise<string> } };
type Datum = Record<string, unknown>;
// Lo que una gráfica del grupo entrega: su imagen (si ya se dibujó) y sus filas, con los nombres de columna.
type Parte = { png: () => Promise<string | undefined>; datos: () => Record<string, string>[] };

// Campos que solo sirven para dibujar la gráfica: no van al CSV.
const DRAWING_FIELDS = ['tooltip', 'light', 'orden'];

const GrupoGraficas = createContext<((parte: Parte) => () => void) | null>(null);

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

// Las filas del spec, con el nombre de cada columna en español.
function datosDe(spec: VisualizationSpec): Record<string, string>[] {
  const rows = specRows(spec);
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !DRAWING_FIELDS.includes(k));
  const text = (v: unknown) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  return rows.map((r) => Object.fromEntries(keys.map((k) => [COLUMN_LABEL[k as keyof typeof COLUMN_LABEL] ?? k, text(r[k])])));
}

// Un CSV con las columnas de todas las filas; una columna que una gráfica no trae queda vacía.
function descargarCsv(name: string, datos: Record<string, string>[]) {
  const headers = [...new Set(datos.flatMap((r) => Object.keys(r)))];
  downloadCsv(name, headers, datos.map((r) => headers.map((h) => r[h] ?? '')));
}

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Une las imágenes en una sola, una debajo de otra, sobre el fondo de la página.
async function descargarPng(name: string, partes: Parte[]) {
  const urls = (await Promise.all(partes.map((p) => p.png()))).filter((u): u is string => Boolean(u));
  if (!urls.length) return;
  const imgs = await Promise.all(urls.map(cargarImagen));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(...imgs.map((i) => i.width));
  canvas.height = imgs.reduce((total, i) => total + i.height, 0);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let y = 0;
  for (const img of imgs) {
    ctx.drawImage(img, 0, y);
    y += img.height;
  }
  downloadUrl(`${name}.png`, canvas.toDataURL('image/png'));
}

export function VegaChart({ spec, height, name = DOWNLOAD_TEXT.chart, contenedor = {} }: {
  spec: VisualizationSpec; height: number; name?: string; contenedor?: ContenedorGrafica;
}) {
  const { ayuda, controles, enlaces } = contenedor;
  const grupo = useContext(GrupoGraficas);
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
  const datos = datosDe(spec);
  const png = async () => (embedded.current ? embedded.current.view.toImageURL('png', 2) : undefined);
  const botones: Boton[] = canDownload ? [
    { label: DOWNLOAD_TEXT.png, icon: <Image20Regular />, onClick: async () => {
      const url = await png();
      if (url) downloadUrl(`${name}.png`, url);
    } },
    ...(datos.length > 0 ? [{ label: DOWNLOAD_TEXT.csv, icon: <Table20Regular />, onClick: () => descargarCsv(name, datos) }] : []),
  ] : [];

  // Dentro de un grupo, la fila la pone el grupo; la gráfica solo se registra y dibuja su caja.
  const actual = useRef({ png, datos });
  actual.current = { png, datos };
  useEffect(() => grupo?.({ png: () => actual.current.png(), datos: () => actual.current.datos }), [grupo]);

  // La altura reservada evita que la página salte cuando llega la gráfica.
  const caja = (
    <>
      {!ready && <SkeletonBlock height={height} />}
      {/* Una gráfica de ancho fijo, como el heatmap de siete días, se desplaza dentro de su caja en celular. */}
      {/* Vega pone `display: inline-block` en su caja, así que el desplazamiento va en una caja de afuera. */}
      <div style={{ overflowX: 'auto' }}>
        {/* El ancho completo deja que un spec con `width: 'container'` llene la tarjeta; uno de ancho fijo no cambia. */}
        <div ref={ref} style={{ width: '100%', minHeight: ready ? height : 0 }} />
      </div>
    </>
  );
  if (grupo) return caja;
  return <Grafica ayuda={ayuda} controles={controles} enlaces={enlaces} botones={ready ? botones : []}>{caja}</Grafica>;
}

// Varias gráficas con una sola fila de acciones: el PNG une sus imágenes y el CSV une sus datos.
export function GraficaGrupo({ children, nombre = DOWNLOAD_TEXT.chart, ayuda, controles, enlaces }: {
  children: ReactNode; nombre?: string; ayuda?: ReactNode; controles?: ReactNode; enlaces?: Enlace[];
}) {
  const canDownload = useCanDownload();
  const partes = useRef(new Set<Parte>());
  const registrar = useCallback((parte: Parte) => {
    partes.current.add(parte);
    return () => { partes.current.delete(parte); };
  }, []);
  const lista = () => [...partes.current];
  const botones: Boton[] = canDownload ? [
    { label: DOWNLOAD_TEXT.png, icon: <Image20Regular />, onClick: () => descargarPng(nombre, lista()) },
    { label: DOWNLOAD_TEXT.csv, icon: <Table20Regular />, onClick: () => descargarCsv(nombre, lista().flatMap((p) => p.datos())) },
  ] : [];
  return (
    <GrupoGraficas.Provider value={registrar}>
      <Grafica ayuda={ayuda} controles={controles} enlaces={enlaces} botones={botones}>{children}</Grafica>
    </GrupoGraficas.Provider>
  );
}
