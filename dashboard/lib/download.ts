// Descargas del navegador: CSV con BOM (Excel lo abre en UTF-8), archivos de una URL y el PNG de un spec de Vega-Lite.
import type { VisualizationSpec } from 'vega-embed';
import { vegaConfig } from './vega-theme';

export function csv(headers: string[], rows: string[][]): string {
  const quote = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return `﻿${[headers, ...rows].map((r) => r.map(quote).join(',')).join('\r\n')}\r\n`;
}

export function downloadUrl(name: string, href: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.click();
}

export function downloadCsv(name: string, headers: string[], rows: string[][]) {
  const href = URL.createObjectURL(new Blob([csv(headers, rows)], { type: 'text/csv' }));
  downloadUrl(`${name}.csv`, href);
  URL.revokeObjectURL(href);
}

// Un PNG del spec sin pintarlo en la página, a doble resolución. Vega lee `document`: se importa al usarlo.
export async function downloadSpecPng(spec: VisualizationSpec, name: string) {
  const [{ compile }, vega] = await Promise.all([import('vega-lite'), import('vega')]);
  const view = new vega.View(vega.parse(compile(spec as never, { config: vegaConfig }).spec), { renderer: 'none' });
  downloadUrl(`${name}.png`, await view.toImageURL('png', 2));
  view.finalize();
}
