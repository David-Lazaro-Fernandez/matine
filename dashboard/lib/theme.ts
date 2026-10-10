// Tema de Fluent desde la paleta de analytics/labels.py: el rojo Cinemex es la marca y la tinta es el texto fuerte.
import { createLightTheme, type BrandVariants, type Theme } from '@fluentui/react-components';
import { GRAY, GRAY_LIGHT, INK, LINE, PAPER, RED, RED_DARK, RED_RAMP, RED_SOFT } from './labels.generated';

type Shade = keyof BrandVariants;
const SHADES: Shade[] = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160];

// Fluent pide 16 tonos y usa el 80 como color de marca. RED_RAMP tiene 4; los demás se interpolan entre estos anclajes.
const ANCHORS: [number, string][] = [
  [0, INK],
  [5, RED_DARK],
  [7, RED],
  [11, RED_RAMP[2]],
  [14, RED_RAMP[3]],
  [15, RED_SOFT],
];

function rgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function mix(a: string, b: string, t: number): string {
  const [ra, rb] = [rgb(a), rgb(b)];
  return '#' + ra.map((v, i) => Math.round(v + (rb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function shadeAt(index: number): string {
  const upper = ANCHORS.findIndex(([i]) => i >= index);
  const [i1, c1] = ANCHORS[upper];
  if (i1 === index) return c1;
  const [i0, c0] = ANCHORS[upper - 1];
  return mix(c0, c1, (index - i0) / (i1 - i0));
}

const brand = Object.fromEntries(SHADES.map((shade, index) => [shade, shadeAt(index)])) as BrandVariants;

export const theme: Theme = {
  ...createLightTheme(brand),
  fontFamilyBase: 'Archivo, system-ui, sans-serif',
  colorNeutralForeground1: INK,
  colorNeutralForeground2: GRAY,
  colorNeutralBackground1: PAPER,
  colorNeutralBackground2: GRAY_LIGHT,
  colorNeutralStroke1: LINE,
  colorNeutralStroke2: LINE,
};
