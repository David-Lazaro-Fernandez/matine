'use client';

// Componentes compartidos por las páginas, con el nombre y el orden de los helpers de ui/common.py (DESIGN.md).
// La interfaz usa los tokens de Fluent. RED y RED_SOFT solo marcan datos de Cinemex.
// Una sección de evidencia va así: Pregunta, Leyenda, gráfica, controles y Leerla, dentro de una Seccion.
import * as React from 'react';
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Body1,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Link,
  MessageBar,
  MessageBarBody,
  Subtitle1,
  Subtitle2,
  Title3,
  createTableColumn,
  makeStyles,
  mergeClasses,
  tokens,
  Skeleton,
  SkeletonItem,
  createMotionComponent,
  motionTokens,
} from '@fluentui/react-components';
import { Database20Regular, Image20Regular, Open20Regular, QuestionCircle20Regular, Table20Regular } from '@fluentui/react-icons';
import { useRouter } from 'next/navigation';
import type { VisualizationSpec } from 'vega-embed';
import { useDataColor } from '@/app/providers';
import { Acciones, type Boton, type Enlace } from '@/components/acciones';
import { ApiError, api } from '@/lib/api';
import { downloadCsv, downloadSpecPng } from '@/lib/download';
import { useCanDownload } from '@/lib/session';
import { fill, fixed, n, signed } from '@/lib/format';
import {
  AUTH_TEXT, CHAIN_COLOR, CHAIN_LABEL, DOWNLOAD_TEXT, FINDING_TEXT, FINDING_THEME_LABEL, FINDING_UNIT, LAYER_TEXT, LINE, RED, RED_SOFT,
  TABLE_NOTE_TEXT, WARN,
} from '@/lib/labels.generated';

const useStyles = makeStyles({
  skeletonStack: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  skeletonRow: { display: 'flex', gap: tokens.spacingHorizontalM, alignItems: 'center' },
  skeletonShort: { width: '40%' },
  skeletonMid: { width: '65%' },
  skeletonCell: { flex: 1 },
  pageHeader: { marginBottom: tokens.spacingVerticalL },
  pageTitle: { display: 'block', margin: 0 },
  meta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalL}`,
    padding: `${tokens.spacingVerticalS} 0`,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
  },
  metaKey: { fontWeight: tokens.fontWeightSemibold },
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
    alignItems: 'center',
    marginTop: tokens.spacingVerticalS,
  },
  pageFooter: {
    marginTop: tokens.spacingVerticalXXXL,
    paddingTop: tokens.spacingVerticalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalXXL}`,
    marginBottom: tokens.spacingVerticalL,
  },
  pregunta: { display: 'block', margin: `0 0 ${tokens.spacingVerticalXS}` },
  conclusion: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    margin: `${tokens.spacingVerticalS} 0 ${tokens.spacingVerticalM}`,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    borderLeft: `3px solid ${tokens.colorNeutralStroke1}`,
  },
  nota: { fontStyle: 'italic', fontWeight: tokens.fontWeightRegular, color: tokens.colorNeutralForeground3 },
  apendice: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: tokens.spacingVerticalXS,
  },
  apendiceHeader: { fontWeight: tokens.fontWeightSemibold },
  resumen: { color: tokens.colorNeutralForeground2, fontWeight: tokens.fontWeightRegular, margin: `0 0 ${tokens.spacingVerticalS}` },
  leyenda: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalL,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    margin: `0 0 ${tokens.spacingVerticalXS}`,
  },
  dot: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', marginRight: '6px', verticalAlign: '-1px' },
  square: { width: '9px', height: '9px', borderRadius: tokens.borderRadiusSmall },
  hallazgo: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXL}`,
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 2fr) minmax(0, 3fr)',
    gap: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXXL}`,
    marginBottom: tokens.spacingVerticalL,
    '@media (max-width: 760px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
  // En la rejilla, las tarjetas de una fila miden lo mismo: la cifra toma el espacio sobrante y la gráfica y el pie van
  // abajo, a la misma altura.
  hallazgoCompacto: { gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: 'auto 1fr auto auto', marginBottom: 0 },
  grafica: { minWidth: 0 },
  // Cabe la gráfica más alta: seis filas de pesas o cinco de barras con su leyenda.
  graficaCompacta: { height: '184px', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  hallazgoLabel: {
    gridColumn: '1 / -1',
    margin: 0,
    fontSize: tokens.fontSizeBase400,
    lineHeight: tokens.lineHeightBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  hallazgoAccion: { gridColumn: '1 / -1', margin: 0, color: tokens.colorNeutralForeground2 },
  cifra: {
    display: 'block',
    fontSize: tokens.fontSizeHero800,
    lineHeight: tokens.lineHeightHero800,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: 'tabular-nums',
  },
  cifraLabel: { display: 'block', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  comparacion: {
    marginTop: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    '& b': { fontVariantNumeric: 'tabular-nums', color: tokens.colorNeutralForeground1 },
  },
  delta: { marginTop: tokens.spacingVerticalXS },
  barras: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS, minWidth: 0 },
  barraFila: { display: 'grid', gridTemplateColumns: 'minmax(80px, 2fr) minmax(0, 3fr)', gap: tokens.spacingHorizontalS, alignItems: 'center' },
  barraNombre: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  barraNombreResaltado: { color: tokens.colorNeutralForeground1, fontWeight: tokens.fontWeightSemibold },
  barraPar: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  barra: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS, fontSize: tokens.fontSizeBase100 },
  barraRelleno: { display: 'block', height: '10px', borderRadius: '2px', minWidth: '2px' },
  pista: { flex: '0 0 78%', display: 'flex' },
  pistaMedidor: { backgroundColor: tokens.colorNeutralBackground3, borderRadius: '2px' },
  divergente: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', fontSize: tokens.fontSizeBase100 },
  divergenteLado: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: tokens.spacingHorizontalXS, minWidth: 0 },
  divergenteDerecho: { justifyContent: 'flex-start', borderLeft: `1px solid ${tokens.colorNeutralStroke1}` },
  donas: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: tokens.spacingHorizontalXXL },
  dona: { margin: 0, width: '132px', textAlign: 'center' },
  lineaDia: { fontSize: '9px', fill: tokens.colorNeutralForeground3 },
  lineaValor: { fontSize: '10px', fontWeight: tokens.fontWeightSemibold, fill: tokens.colorNeutralForeground1, fontVariantNumeric: 'tabular-nums' },
  donaCifra: { fontSize: '15px', fontWeight: tokens.fontWeightSemibold, fill: tokens.colorNeutralForeground1, fontVariantNumeric: 'tabular-nums' },
  donaNombre: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 },
  apilada: { display: 'flex', flex: '1 1 0', gap: '2px', height: '16px', minWidth: 0 },
  apiladaParte: { minWidth: '3px', borderRadius: '2px' },
  pesasFila: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, fontSize: tokens.fontSizeBase100, minWidth: 0 },
  pesas: { position: 'relative', flex: '0 0 62%', height: '14px' },
  pesasLinea: { position: 'absolute', top: '6px', height: '2px', backgroundColor: tokens.colorNeutralStroke1 },
  pesasLineaResaltada: { backgroundColor: tokens.colorNeutralForeground3 },
  pesasPunto: {
    position: 'absolute',
    top: '2px',
    width: '10px',
    height: '10px',
    marginLeft: '-5px',
    borderRadius: '50%',
    boxShadow: `0 0 0 2px ${tokens.colorNeutralBackground1}`,
  },
  barraValor: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: tokens.colorNeutralForeground2 },
  hallazgoPie: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  cmx: { color: RED, fontWeight: tokens.fontWeightSemibold },
  cnp: { fontWeight: tokens.fontWeightSemibold },
  sum: { fontWeight: tokens.fontWeightSemibold, backgroundColor: tokens.colorNeutralBackground2 },
  mal: { color: WARN, fontWeight: tokens.fontWeightSemibold },
  // Una tabla más ancha que la pantalla se desplaza dentro de su caja, no la página.
  // El borde va en la caja que se desplaza: así enmarca lo que se ve aunque la tabla sea más ancha.
  tableScroll: {
    overflowX: 'auto',
    margin: `${tokens.spacingVerticalXS} 0 ${tokens.spacingVerticalS}`,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  table: {
    fontSize: tokens.fontSizeBase200,
    fontVariantNumeric: 'tabular-nums',
    // El borde de la caja ya cierra la tabla abajo.
    '& .fui-DataGridBody .fui-DataGridRow:last-child': { borderBottom: 'none' },
  },
  // Sin `overflowWrap`, el DataGrid encoge las columnas hasta que el texto se encima sobre la de al lado.
  // La celda ocupa toda la altura de la fila para que la línea entre columnas llegue de arriba abajo.
  tableCell: {
    overflowWrap: 'anywhere',
    alignSelf: 'stretch',
    ':not(:last-child)': { borderRight: `1px solid ${tokens.colorNeutralStroke2}` },
  },
  headerCell: {
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  num: { justifyContent: 'flex-end', textAlign: 'right' },
  wideCol: { flexGrow: 3 },
  notaTabla: { display: 'flex', justifyContent: 'flex-end', margin: `0 0 ${tokens.spacingVerticalS}` },
  graficaContenedor: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS, minWidth: 0 },
  // Controles a la izquierda y el "?" a la derecha, en la misma fila.
  filaControles: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: tokens.spacingHorizontalM, flexWrap: 'wrap' },
  controles: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spacingHorizontalM, minWidth: 0 },
  notaEjemplo: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    minWidth: 0,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  notaEjemploTitulo: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, margin: 0 },
  accessPage: {
    display: 'flex',
    justifyContent: 'center',
    minHeight: '100vh',
    boxSizing: 'border-box',
    padding: `8vh ${tokens.spacingHorizontalL} 0`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  accessCard: {
    width: '100%',
    maxWidth: '420px',
    height: 'fit-content',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    '& form': { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  },
  marca: { color: tokens.colorBrandForeground1, fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  accessTitle: { display: 'block', margin: 0 },
  accessLead: { color: tokens.colorNeutralForeground3, margin: 0 },
});

// Los títulos de labels.py llevan etiquetas HTML para Streamlit: 'Dulcería: <span>Cinemex</span>' → 'Dulcería: Cinemex'.
// Entrada de Fluent para lo que aparece al llegar los datos: sube 8 px y se aclara.
// Fluent la acorta solo si el sistema pide menos movimiento.
export const Entrada = createMotionComponent({
  keyframes: [
    { opacity: 0, transform: 'translateY(8px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ],
  duration: motionTokens.durationNormal,
  easing: motionTokens.curveDecelerateMid,
});

export function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

// Un metadato del encabezado: [clave, valor] o un nodo suelto.
export type MetaItem = readonly [React.ReactNode, React.ReactNode] | React.ReactNode;

// Encabezado de página: título, fila de metadatos y, como hijos, la barra de filtros.
export function PageHeader({ title, meta, children }: { title: string; meta?: readonly MetaItem[]; children?: React.ReactNode }) {
  const s = useStyles();
  return (
    <header className={s.pageHeader}>
      <Title3 as="h1" className={s.pageTitle}>{plainText(title)}</Title3>
      {meta && meta.length > 0 && (
        <div className={s.meta}>
          {meta.map((item, i) => (
            <span key={i}>
              {Array.isArray(item) && item.length === 2 ? <><strong className={s.metaKey}>{item[0]}</strong> {item[1]}</> : item}
            </span>
          ))}
        </div>
      )}
      {children && <div className={s.filters}>{children}</div>}
    </header>
  );
}

// Pie de página con las fuentes.
export function PageFooter({ children }: { children: React.ReactNode }) {
  return <footer className={useStyles().pageFooter}>{children}</footer>;
}

// Tarjeta de una sección de evidencia. `slug` es el ancla de la sección.
export function Seccion({ slug, children }: { slug: string; children: React.ReactNode }) {
  return <Entrada><section id={slug} className={useStyles().card}>{children}</section></Entrada>;
}

// Pregunta de la sección y su conclusión. Sin conclusión, un panel pendiente, no pinta el recuadro vacío.
export function Pregunta({ texto, conclusion, nota }: { texto: string; conclusion?: string | null; nota?: string | null }) {
  const s = useStyles();
  return (
    <>
      <Subtitle2 as="h3" className={s.pregunta}>{texto}</Subtitle2>
      {conclusion && (
        <p className={s.conclusion}>
          {conclusion}
          {nota && <> <em className={s.nota}>{nota}</em></>}
        </p>
      )}
    </>
  );
}

// "Cómo leerla": un "?" al final de la sección que abre su explicación en una ventana.
export function Leerla({ children }: { children: React.ReactNode }) {
  return <Ayuda titulo={LAYER_TEXT.read_it} label={LAYER_TEXT.read_it}>{children}</Ayuda>;
}

// Con `true`, los apéndices de adentro empiezan abiertos: es la pantalla de ese tema.
export const ApendiceAbierto = React.createContext(false);

// Apéndice: cerrado, con una línea de resumen visible junto al título. Abierto dentro de `ApendiceAbierto`.
export function Apendice({ title, resumen, children }: { title: string; resumen?: string | null; children: React.ReactNode }) {
  const s = useStyles();
  const open = React.useContext(ApendiceAbierto);
  return (
    <Entrada>
      <Accordion collapsible defaultOpenItems={open ? ['apendice'] : []} className={s.apendice}>
        <AccordionItem value="apendice">
          <AccordionHeader expandIconPosition="end" className={s.apendiceHeader}>{title}</AccordionHeader>
          <AccordionPanel>
            {resumen && <p className={s.resumen}>{resumen}</p>}
            {children}
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </Entrada>
  );
}

// Leyenda HTML arriba de una gráfica: items = [[texto, color], …].
export function Leyenda({ items, square = false }: { items: readonly (readonly [string, string])[]; square?: boolean }) {
  const s = useStyles();
  const dataColor = useDataColor();
  return (
    <div className={s.leyenda}>
      {items.map(([text, color]) => (
        <span key={text}>
          <i className={mergeClasses(s.dot, square && s.square)} style={{ backgroundColor: dataColor(color) }} />
          {text}
        </span>
      ))}
    </div>
  );
}

// Un hallazgo de `analytics.findings`: cifras y una gráfica, sin redacción.
type FindingUnit = keyof typeof FINDING_UNIT;
type FindingMetric = { label: string; value: number; unit: FindingUnit; chain: string | null };
type FindingChart = {
  kind: 'bars' | 'meter' | 'line' | 'donut' | 'stack' | 'dumbbell' | 'diverging';
  unit: FindingUnit;
  rows: { label: string; values: Record<string, number>; highlight: boolean }[];
};
export type Finding = {
  topic: string;
  theme: keyof typeof FINDING_THEME_LABEL;
  label: string;
  action: string | null;
  metric: FindingMetric;
  compare: FindingMetric | null;
  delta: FindingMetric | null;
  chart: FindingChart | null;
  context: string | null;
};

// 4.62 'pct' → '4.6 %'; 3.27 'pp' → '+3.3 pp'; 52 'pct_diff' → '+52 %'; 245 'money' → '$245'.
function findingValue(v: number, unit: FindingUnit): string {
  const value = {
    pct: fixed(v, Math.abs(v) < 10 ? 1 : 0),
    pp: signed(v, 1),
    pct_diff: signed(v, 0),
    money: n(v),
    count: n(v),
    pace: fixed(v, 1),
  }[unit];
  return fill(FINDING_UNIT[unit], { value });
}

function chainColor(chain: string | null): string | undefined {
  return chain ? CHAIN_COLOR[chain as keyof typeof CHAIN_COLOR] : undefined;
}

function chartChains(chart: FindingChart): string[] {
  return [...new Set(chart.rows.flatMap((r) => Object.keys(r.values)))];
}

function chainName(chain: string): string {
  return CHAIN_LABEL[chain as keyof typeof CHAIN_LABEL] ?? chain;
}

function ChainLegend({ chains }: { chains: string[] }) {
  return chains.length > 1 ? <Leyenda items={chains.map((c) => [chainName(c), chainColor(c) ?? LINE] as const)} /> : null;
}

// La gráfica de la tarjeta según la forma del dato (`kind`, de `analytics.findings`).
function FindingGraphic({ chart }: { chart: FindingChart }) {
  if (chart.kind === 'donut') return <FindingDonuts chart={chart} />;
  if (chart.kind === 'stack') return <FindingStack chart={chart} />;
  if (chart.kind === 'dumbbell') return <FindingDumbbell chart={chart} />;
  if (chart.kind === 'line') return <FindingLines chart={chart} />;
  return <FindingBars chart={chart} />;
}

// Barras por cadena, una fila por categoría. La fila resaltada lleva el color de cada cadena y el resto va atenuado.
// `meter` mide contra el 100 % sobre una pista; `diverging` crece a cada lado de un eje central según el signo.
function FindingBars({ chart }: { chart: FindingChart }) {
  const s = useStyles();
  const chains = chartChains(chart);
  const meter = chart.kind === 'meter';
  const diverging = chart.kind === 'diverging';
  const top = meter ? 100 : Math.max(...chart.rows.flatMap((r) => Object.values(r.values).map(Math.abs)), 0) || 1;
  const dataColor = useDataColor();
  const muted = (c: string) => dataColor(c === 'cinemex' ? RED_SOFT : LINE);
  return (
    <div className={s.barras}>
      <ChainLegend chains={chains} />
      {chart.rows.map((row, i) => (
        <div key={i} className={s.barraFila}>
          <span className={mergeClasses(s.barraNombre, row.highlight && s.barraNombreResaltado)} title={row.label}>{row.label}</span>
          <div className={s.barraPar}>
            {chains.map((c) => {
              if (!(c in row.values)) return null;
              const v = row.values[c];
              const fillColor = meter || row.highlight ? dataColor(chainColor(c) ?? LINE) : muted(c);
              const bar = (
                <span
                  className={s.barraRelleno}
                  style={{ width: `${(100 * Math.abs(v)) / top}%`, backgroundColor: fillColor, opacity: meter && !row.highlight ? 0.4 : 1 }}
                />
              );
              // El ritmo de preventa se lee como porcentaje en la barra; la frase completa va en la cifra de arriba.
              const value = <span className={s.barraValor}>{findingValue(v, chart.unit === 'pace' ? 'pct' : chart.unit)}</span>;
              if (diverging) {
                return (
                  <div key={c} className={s.divergente}>
                    <span className={s.divergenteLado}>{v < 0 && <>{value}{bar}</>}</span>
                    <span className={mergeClasses(s.divergenteLado, s.divergenteDerecho)}>{v >= 0 && <>{bar}{value}</>}</span>
                  </div>
                );
              }
              return (
                <div key={c} className={s.barra}>
                  <span className={mergeClasses(s.pista, meter && s.pistaMedidor)}>{bar}</span>
                  {value}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Una dona por cadena: las partes de su programación. La parte resaltada lleva el color de la cadena; las demás van en
// gris y se separan con un espacio. Al centro, la cifra de la parte resaltada.
function FindingDonuts({ chart }: { chart: FindingChart }) {
  const s = useStyles();
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const gap = 1.5;
  const dataColor = useDataColor();
  return (
    <div className={s.donas}>
      {chartChains(chart).map((c) => {
        const parts = chart.rows.filter((r) => r.values[c] > 0);
        const total = parts.reduce((sum, r) => sum + r.values[c], 0) || 1;
        const highlighted = chart.rows.find((r) => r.highlight);
        let offset = 0;
        return (
          <figure key={c} className={s.dona}>
            <svg viewBox="0 0 100 100" role="img"
                 aria-label={`${chainName(c)}: ${parts.map((r) => `${r.label} ${findingValue(r.values[c], chart.unit)}`).join(', ')}`}>
              {parts.map((r) => {
                const length = (circumference * r.values[c]) / total;
                const arc = (
                  <circle key={r.label} cx="50" cy="50" r={radius} fill="none" strokeWidth="14"
                          stroke={dataColor(r.highlight ? chainColor(c) ?? LINE : LINE)} transform="rotate(-90 50 50)"
                          strokeDasharray={`${Math.max(length - gap, 0.5)} ${circumference}`} strokeDashoffset={-offset}>
                    <title>{`${r.label}: ${findingValue(r.values[c], chart.unit)}`}</title>
                  </circle>
                );
                offset += length;
                return arc;
              })}
              {highlighted && c in highlighted.values && (
                <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className={s.donaCifra}>
                  {findingValue(highlighted.values[c], chart.unit)}
                </text>
              )}
            </svg>
            <figcaption className={s.donaNombre}>{chainName(c)}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

// Una barra al 100 % por cadena, con las partes en el orden de las filas (las franjas, de la mañana a la noche). La
// parte resaltada lleva el color de la cadena y su cifra va a la derecha; las demás van en gris, con su cifra al pasar
// el cursor.
function FindingStack({ chart }: { chart: FindingChart }) {
  const s = useStyles();
  const dataColor = useDataColor();
  return (
    <div className={s.barras}>
      {chartChains(chart).map((c) => {
        const total = chart.rows.reduce((sum, r) => sum + (r.values[c] ?? 0), 0) || 1;
        const highlighted = chart.rows.find((r) => r.highlight && c in r.values);
        return (
          <div key={c} className={s.barraFila}>
            <span className={s.barraNombre}>{chainName(c)}</span>
            <div className={s.pesasFila}>
              <div className={s.apilada}>
                {chart.rows.filter((r) => r.values[c] > 0).map((r) => (
                  <span key={r.label} className={s.apiladaParte} title={`${r.label}: ${findingValue(r.values[c], chart.unit)}`}
                        style={{ flex: `${r.values[c] / total} 1 0`, backgroundColor: dataColor(r.highlight ? chainColor(c) ?? LINE : LINE) }} />
                ))}
              </div>
              {highlighted && <span className={s.barraValor}>{findingValue(highlighted.values[c], chart.unit)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Una línea por cadena a lo largo de las filas (los días). Las cifras de la fila resaltada van sobre sus puntos y el
// resto se lee al pasar el cursor.
const LINE_WIDTH = 300;
const LINE_HEIGHT = 110;
const LINE_PAD = { left: 8, right: 8, top: 16, bottom: 20 };

function FindingLines({ chart }: { chart: FindingChart }) {
  const s = useStyles();
  const dataColor = useDataColor();
  const chains = chartChains(chart);
  const top = Math.max(...chart.rows.flatMap((r) => Object.values(r.values)), 1);
  const x = (i: number) => LINE_PAD.left + (i * (LINE_WIDTH - LINE_PAD.left - LINE_PAD.right)) / Math.max(chart.rows.length - 1, 1);
  const y = (v: number) => LINE_HEIGHT - LINE_PAD.bottom - (v / top) * (LINE_HEIGHT - LINE_PAD.top - LINE_PAD.bottom);
  const marked = chart.rows.findIndex((r) => r.highlight);
  return (
    <div className={s.barras}>
      <ChainLegend chains={chains} />
      <svg viewBox={`0 0 ${LINE_WIDTH} ${LINE_HEIGHT}`} role="img"
           aria-label={chains.map((c) => `${chainName(c)}: ${chart.rows.map((r) => `${r.label} ${findingValue(r.values[c], chart.unit)}`).join(', ')}`).join('. ')}>
        {chart.rows.map((r, i) => (
          <text key={r.label} x={x(i)} y={LINE_HEIGHT - 4} textAnchor="middle" className={s.lineaDia}>{r.label}</text>
        ))}
        {marked >= 0 && <line x1={x(marked)} x2={x(marked)} y1={LINE_PAD.top} y2={LINE_HEIGHT - LINE_PAD.bottom} stroke={dataColor(LINE)} strokeWidth="1" />}
        {chains.map((c) => {
          const color = dataColor(chainColor(c) ?? LINE);
          const points = chart.rows.flatMap((r, i) => (c in r.values ? [[x(i), y(r.values[c])] as const] : []));
          return (
            <g key={c}>
              <polyline points={points.map(([px, py]) => `${px},${py}`).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
              {chart.rows.map((r, i) => c in r.values && (
                <circle key={r.label} cx={x(i)} cy={y(r.values[c])} r={r.highlight ? 4 : 3} fill={color}>
                  <title>{`${chainName(c)}, ${r.label}: ${findingValue(r.values[c], chart.unit)}`}</title>
                </circle>
              ))}
              {marked >= 0 && c in chart.rows[marked].values && (
                <text x={x(marked)} y={y(chart.rows[marked].values[c]) - 7} textAnchor="middle" className={s.lineaValor}>
                  {findingValue(chart.rows[marked].values[c], chart.unit)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Pesas: un punto por cadena en cada fila sobre una escala común, unidos por una línea. La distancia es la brecha.
function FindingDumbbell({ chart }: { chart: FindingChart }) {
  const s = useStyles();
  const chains = chartChains(chart);
  const values = chart.rows.flatMap((r) => Object.values(r.values));
  const [lo, hi] = [Math.min(...values), Math.max(...values)];
  const pad = (hi - lo) * 0.08 || 1;
  const x = (v: number) => (100 * (v - lo + pad)) / (hi - lo + 2 * pad);
  const dataColor = useDataColor();
  return (
    <div className={s.barras}>
      <ChainLegend chains={chains} />
      {chart.rows.map((row, i) => {
        const present = chains.filter((c) => c in row.values);
        const xs = present.map((c) => x(row.values[c]));
        return (
          <div key={i} className={s.barraFila}>
            <span className={mergeClasses(s.barraNombre, row.highlight && s.barraNombreResaltado)} title={row.label}>{row.label}</span>
            <div className={s.pesasFila}>
              <span className={s.pesas}>
                {xs.length > 1 && (
                  <span className={mergeClasses(s.pesasLinea, row.highlight && s.pesasLineaResaltada)}
                        style={{ left: `${Math.min(...xs)}%`, width: `${Math.max(...xs) - Math.min(...xs)}%` }} />
                )}
                {present.map((c, j) => (
                  <span key={c} className={s.pesasPunto} style={{ left: `${xs[j]}%`, backgroundColor: dataColor(chainColor(c) ?? LINE) }}
                        title={`${chainName(c)}: ${findingValue(row.values[c], chart.unit)}`} />
                ))}
              </span>
              <span className={s.barraValor}>{present.map((c) => findingValue(row.values[c], chart.unit)).join(' · ')}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// La tarjeta como gráfica de Vega-Lite para el PNG: título con la cifra y barras por cadena con la fila resaltada.
function findingSpec(f: Finding): VisualizationSpec {
  const chart = f.chart!;
  const line = chart.kind === 'line';
  const chains = chartChains(chart);
  const summary = [f.metric, f.compare, f.delta].filter(Boolean).map((m) => `${m!.label}: ${findingValue(m!.value, m!.unit)}`);
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: { text: f.label, subtitle: [...summary, ...(f.context ? [f.context] : [])], anchor: 'start' },
    width: 480,
    data: {
      values: chart.rows.flatMap((r) => Object.entries(r.values).map(([chain, value]) => ({
        label: r.label, chain: CHAIN_LABEL[chain as keyof typeof CHAIN_LABEL] ?? chain, value, highlight: r.highlight,
      }))),
    },
    mark: line ? { type: 'line', point: true, strokeWidth: 2 } : { type: 'bar', cornerRadiusEnd: 2 },
    encoding: {
      ...(line
        ? { x: { field: 'label', type: 'ordinal', sort: null, title: null, axis: { labelAngle: 0 } },
            y: { field: 'value', type: 'quantitative', title: fill(FINDING_UNIT[chart.unit], { value: '' }).trim() || null } }
        : { y: { field: 'label', type: 'nominal', sort: null, title: null },
            yOffset: { field: 'chain', sort: null },
            x: { field: 'value', type: 'quantitative', title: fill(FINDING_UNIT[chart.unit], { value: '' }).trim() || null } }),
      color: {
        field: 'chain', sort: null, legend: chains.length > 1 ? { title: null, orient: 'top' } : null,
        scale: { domain: chains.map((c) => CHAIN_LABEL[c as keyof typeof CHAIN_LABEL] ?? c), range: chains.map((c) => chainColor(c) ?? LINE) },
      },
      ...(line ? {} : { opacity: { condition: { test: 'datum.highlight', value: 1 }, value: 0.3 } }),
    },
  };
}

// Las cifras de la tarjeta en formato largo: concepto, cadena, valor y unidad, una fila por cifra.
function downloadFinding(f: Finding) {
  const chain = (c: string | null) => (c ? CHAIN_LABEL[c as keyof typeof CHAIN_LABEL] ?? c : '');
  const unit = (u: FindingUnit) => fill(FINDING_UNIT[u], { value: '' }).trim();
  const metrics = [f.metric, f.compare, f.delta].filter((m): m is FindingMetric => m !== null)
    .map((m) => [m.label, chain(m.chain), String(m.value), unit(m.unit)]);
  const bars = (f.chart?.rows ?? []).flatMap((r) => Object.entries(r.values)
    .map(([c, v]) => [r.label, chain(c), String(v), unit(f.chart!.unit)]));
  downloadCsv(f.topic, [...DOWNLOAD_TEXT.csv_headers], [...metrics, ...bars]);
}

// Tarjeta de hallazgo: tema, la cifra, su comparación y la diferencia, una gráfica con lo importante resaltado y la
// muestra que la sostiene, con su PNG y su CSV. `href` es la pantalla con la evidencia; `dataHref`, el explorador de Datos.
// `showAction` se apaga cuando la sugerencia ya está en el resumen de arriba.
export function Hallazgo({ f, href, dataHref, compact = false, showAction = true }: {
  f: Finding; href?: string; dataHref?: string; compact?: boolean; showAction?: boolean;
}) {
  const s = useStyles();
  const canDownload = useCanDownload();
  const dataColor = useDataColor();
  const botones: Boton[] = [
    ...(canDownload && f.chart && f.chart.rows.length > 0 ? [{ label: DOWNLOAD_TEXT.png, icon: <Image20Regular />, onClick: () => downloadSpecPng(findingSpec(f), f.topic) }] : []),
    ...(canDownload ? [{ label: DOWNLOAD_TEXT.csv, icon: <Table20Regular />, onClick: () => downloadFinding(f) }] : []),
  ];
  const enlaces: Enlace[] = [
    ...(dataHref ? [{ label: DOWNLOAD_TEXT.data, icon: <Database20Regular />, href: dataHref }] : []),
    ...(href ? [{ label: LAYER_TEXT.evidence, icon: <Open20Regular />, href }] : []),
  ];
  const metricColor = (chain: string | null) => chain ? dataColor(chainColor(chain) ?? LINE) : undefined;
  return (
    <Entrada>
      <div id={f.topic} className={mergeClasses(s.hallazgo, compact && s.hallazgoCompacto)}>
        <h3 className={s.hallazgoLabel}>{f.label}</h3>
        {showAction && f.action && <p className={s.hallazgoAccion}>{f.action}</p>}
        <div>
          <span className={s.cifra} style={{ color: metricColor(f.metric.chain) }}>{findingValue(f.metric.value, f.metric.unit)}</span>
          <span className={s.cifraLabel}>{f.metric.label}</span>
          {f.compare && (
            <div className={s.comparacion}>
              {FINDING_TEXT.versus} <b style={{ color: metricColor(f.compare.chain) }}>{findingValue(f.compare.value, f.compare.unit)}</b>{' '}
              {f.compare.label.charAt(0).toLowerCase() + f.compare.label.slice(1)}
            </div>
          )}
          {f.delta && (
            <div className={s.delta}>
              <Badge appearance="tint" color="informative">{`${f.delta.label}: ${f.delta.value > 0 ? FINDING_TEXT.up : FINDING_TEXT.down} ${findingValue(f.delta.value, f.delta.unit)}`}</Badge>
            </div>
          )}
        </div>
        <div className={mergeClasses(s.grafica, compact && s.graficaCompacta)}>
          {f.chart && f.chart.rows.length > 0 && <FindingGraphic chart={f.chart} />}
        </div>
        <div className={s.hallazgoPie}>
          <span>{f.context}</span>
          <Acciones botones={botones} enlaces={enlaces} />
        </div>
      </div>
    </Entrada>
  );
}

// Una celda ya formateada, o [texto, ...clases] para resaltarla: 'cmx' Cinemex, 'cnp' Cinépolis, 'sum' total, 'mal' fallo.
// Las clases se combinan: [texto, 'sum', 'cmx'] o [texto, ['sum', 'cmx']].
export type CellClass = 'cmx' | 'cnp' | 'sum' | 'mal';
export type Cell = string | readonly [string, ...(CellClass | readonly CellClass[])[]];

function cellClasses(cell: Cell): CellClass[] {
  return typeof cell === 'string' ? [] : cell.slice(1).flat() as CellClass[];
}

// Lo que necesita una palabra larga de la interfaz, como 'Administrador', para no partirse.
const TABLE_COLUMN_MIN_WIDTH = 104;

// Tabla compacta como `table()` de ui/common.py, sobre el DataGrid de Fluent. `numCols` alinea a la derecha.
// ponytail: sin virtualizar. El explorador de Datos necesita la versión de @fluentui-contrib para miles de renglones.
// `wideCols` son las columnas que crecen el triple que las demás, como una lista de nombres.
export function Table({ headers, rows, numCols = [], wideCols = [] }: { headers: string[]; rows: Cell[][]; numCols?: number[]; wideCols?: number[] }) {
  const dataColor = useDataColor();
  const s = useStyles();
  const columns = headers.map((header, i) =>
    createTableColumn<Cell[]>({
      columnId: i,
      renderHeaderCell: () => header,
      renderCell: (row) => (typeof row[i] === 'string' ? row[i] : row[i][0]),
    }),
  );
  const cellClass = (row: Cell[], i: number) =>
    mergeClasses(s.tableCell, numCols.includes(i) && s.num, wideCols.includes(i) && s.wideCol, ...cellClasses(row[i]).map((c) => s[c]));
  return (
    <div className={s.tableScroll}>
    <DataGrid items={rows} columns={columns} getRowId={(row) => rows.indexOf(row)} size="small" className={s.table}
      style={{ minWidth: headers.length * TABLE_COLUMN_MIN_WIDTH }}>
      <DataGridHeader>
        <DataGridRow>
          {({ renderHeaderCell, columnId }) => (
            <DataGridHeaderCell className={mergeClasses(s.headerCell, s.tableCell, numCols.includes(Number(columnId)) && s.num, wideCols.includes(Number(columnId)) && s.wideCol)}>
              {renderHeaderCell()}
            </DataGridHeaderCell>
          )}
        </DataGridRow>
      </DataGridHeader>
      <DataGridBody<Cell[]>>
        {({ item, rowId }) => (
          <DataGridRow<Cell[]> key={rowId}>
            {({ renderCell, columnId }) => (
              <DataGridCell className={cellClass(item, Number(columnId))}
                style={cellClasses(item[Number(columnId)]).includes('cmx') ? { color: dataColor(RED) } : undefined}>
                {renderCell(item)}
              </DataGridCell>
            )}
          </DataGridRow>
        )}
      </DataGridBody>
    </DataGrid>
    </div>
  );
}

// Botón "?" que abre una ventana con `children`. `label` es su nombre para lector de pantalla y su tooltip.
export function Ayuda({ titulo, label, children }: { titulo: string; label: string; children: React.ReactNode }) {
  const s = useStyles();
  const [open, setOpen] = React.useState(false);
  return (
    <div className={s.notaTabla}>
      <Button appearance="subtle" size="small" icon={<QuestionCircle20Regular />} aria-label={label} title={label} onClick={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={(_, d) => setOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogContent className={s.notaEjemplo}>{children}</DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setOpen(false)}>{TABLE_NOTE_TEXT.close}</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

// Lo que una gráfica pone alrededor: el "?", sus controles y sus enlaces. `VegaChart` y los wrappers lo reciben así.
export type ContenedorGrafica = { ayuda?: React.ReactNode; controles?: React.ReactNode; enlaces?: Enlace[] };

// Contenedor de una gráfica. Debajo de ella van tres filas, siempre en este orden: el "?" (`ayuda`), los controles que
// cambian la gráfica (`controles`) y los botones y enlaces (`botones`, `enlaces`).
export function Grafica({ children, ayuda, controles, botones, enlaces }: {
  children: React.ReactNode; ayuda?: React.ReactNode; controles?: React.ReactNode; botones?: Boton[]; enlaces?: Enlace[];
}) {
  const s = useStyles();
  return (
    <div className={s.graficaContenedor}>
      {children}
      {(controles || ayuda) && (
        <div className={s.filaControles}>
          <div className={s.controles}>{controles}</div>
          {ayuda}
        </div>
      )}
      <Acciones botones={botones} enlaces={enlaces} />
    </div>
  );
}

// Nota al pie de una tabla: su texto y, como ejemplo, la primera fila de la misma tabla.
export function NotaTabla({ title, texto, ejemplo }: { title: string; texto: React.ReactNode; ejemplo?: React.ReactNode }) {
  const s = useStyles();
  return (
    <Ayuda titulo={title} label={TABLE_NOTE_TEXT.open}>
      <p>{texto}</p>
      {ejemplo && (
        <>
          <p className={s.notaEjemploTitulo}>{TABLE_NOTE_TEXT.example}</p>
          {ejemplo}
        </>
      )}
    </Ayuda>
  );
}

// Tarjeta de las pantallas de acceso: el nombre del producto, el título, el texto de entrada y el formulario.
export function AccessCard({ title, lead, children }: { title?: string; lead?: string; children: React.ReactNode }) {
  const s = useStyles();
  return (
    <main className={s.accessPage}>
      <Entrada>
        <div className={s.accessCard}>
          <div className={s.marca}>{AUTH_TEXT.app_name}</div>
          {title && <Subtitle1 as="h2" className={s.accessTitle}>{title}</Subtitle1>}
          {lead && <Body1 as="p" className={s.accessLead}>{lead}</Body1>}
          {children}
        </div>
      </Entrada>
    </main>
  );
}

// Enlace de Fluent que navega dentro de la aplicación, sin recargar la página.
export function AppLink({ href, children, className, ariaLabel, title }: {
  href: string; children: React.ReactNode; className?: string; ariaLabel?: string; title?: string;
}) {
  const router = useRouter();
  return (
    <Link href={href} className={className} aria-label={ariaLabel} title={title} onClick={(e) => { e.preventDefault(); router.push(href); }}>
      {children}
    </Link>
  );
}

// Esqueletos de carga: la misma forma que el componente que llega después, para que la página no salte.
// Una página arma el suyo con estas piezas mientras su endpoint no responde.

export function SkeletonLines({ lines = 2 }: { lines?: number }) {
  const s = useStyles();
  return (
    <Skeleton className={s.skeletonStack} aria-busy>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonItem key={i} size={16} className={mergeClasses(i === lines - 1 && s.skeletonMid)} />
      ))}
    </Skeleton>
  );
}

export function SkeletonBlock({ height }: { height: number }) {
  return (
    <Skeleton aria-busy>
      <SkeletonItem shape="rectangle" style={{ height }} />
    </Skeleton>
  );
}

export function SkeletonTable({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  const s = useStyles();
  return (
    <Skeleton className={s.skeletonStack} aria-busy>
      {Array.from({ length: rows + 1 }, (_, r) => (
        <div key={r} className={s.skeletonRow}>
          {Array.from({ length: columns }, (_, c) => <SkeletonItem key={c} size={r === 0 ? 12 : 16} className={s.skeletonCell} />)}
        </div>
      ))}
    </Skeleton>
  );
}

export function SkeletonHallazgo() {
  const s = useStyles();
  return (
    <div className={s.hallazgo}>
      <SkeletonLines lines={3} />
      <SkeletonLines lines={4} />
    </div>
  );
}

// Una sección de evidencia: pregunta, conclusión, leyenda y la gráfica o tabla de `height` px.
export function SkeletonSeccion({ height = 240, table = false }: { height?: number; table?: boolean }) {
  const s = useStyles();
  return (
    <section className={s.card}>
      <Skeleton className={s.skeletonStack} aria-busy>
        <SkeletonItem size={20} className={s.skeletonMid} />
        <SkeletonItem size={40} />
        <SkeletonItem size={12} className={s.skeletonShort} />
      </Skeleton>
      <div style={{ marginTop: tokens.spacingVerticalM }}>
        {table ? <SkeletonTable /> : <SkeletonBlock height={height} />}
      </div>
    </section>
  );
}

export function SkeletonApendice() {
  const s = useStyles();
  return (
    <Skeleton className={s.apendice} aria-busy>
      <SkeletonItem size={40} />
    </Skeleton>
  );
}

// Las tres capas de una página de evidencia: hallazgos, secciones y apéndices.
export function SkeletonCapas({ findings = 2, sections = 1, appendices = 0 }: { findings?: number; sections?: number; appendices?: number }) {
  return (
    <>
      {Array.from({ length: findings }, (_, i) => <SkeletonHallazgo key={i} />)}
      {Array.from({ length: sections }, (_, i) => <SkeletonSeccion key={i} />)}
      {Array.from({ length: appendices }, (_, i) => <SkeletonApendice key={i} />)}
    </>
  );
}

// --- Carga de datos por partes ---

// El texto de un error de la API para el usuario: el `detail` que manda la API, o el error tal cual.
export function errorText(e: unknown): string {
  return (e instanceof ApiError && e.detail) || String(e);
}

export type Loaded<T> = { data: T | null; error: unknown };

// GET a `path`; con null no pide nada. `data` y `error` siempre son de este `path`: al cambiar vuelven a null.
export function useApi<T>(path: string | null): Loaded<T> {
  const [state, setState] = React.useState<Loaded<T> & { path: string | null }>({ path: null, data: null, error: null });
  React.useEffect(() => {
    if (path === null) return;
    let live = true;
    api<T>(path).then(
      (data) => live && setState({ path, data, error: null }),
      (error) => live && setState({ path, data: null, error }),
    );
    return () => { live = false; };
  }, [path]);
  return state.path === path ? state : { data: null, error: null };
}

// Se pide antes de que el bloque entre en pantalla, para que ya esté al verse.
const LAZY_MARGIN = '600px';
// Pide todos los bloques diferidos de la página, para imprimirla completa (`PrintButton`).
export const LOAD_ALL_EVENT = 'ac:load-all';

// Como useApi, pero pide `path` solo cuando el elemento de `ref` está cerca de la pantalla. Un `path` nuevo lejos de
// la pantalla espera a que el bloque se acerque.
export function useLazyApi<T>(path: string): Loaded<T> & { ref: (node: Element | null) => void } {
  const [node, setNode] = React.useState<Element | null>(null);
  const [near, setNear] = React.useState(false);
  const [wanted, setWanted] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: LAZY_MARGIN });
    observer.observe(node);
    const loadAll = () => setNear(true);
    window.addEventListener(LOAD_ALL_EVENT, loadAll);
    return () => { observer.disconnect(); window.removeEventListener(LOAD_ALL_EVENT, loadAll); };
  }, [node]);
  React.useEffect(() => { if (near) setWanted(path); }, [near, path]);
  const loaded = useApi<T>(wanted);
  return { ref: setNode, ...(wanted === path ? loaded : { data: null, error: null }) };
}

// Un bloque que pide `path` al acercarse a la pantalla: `fallback` mientras llega y el error en su lugar si falla,
// sin tumbar el resto de la página. `children` pinta la respuesta.
export function Diferido<T>({ path, fallback, error = errorText, children }: {
  path: string; fallback: React.ReactNode; error?: (e: unknown) => string; children: (data: T) => React.ReactNode;
}) {
  const loaded = useLazyApi<T>(path);
  let body = fallback;
  if (loaded.error) body = <MessageBar intent="error"><MessageBarBody>{error(loaded.error)}</MessageBarBody></MessageBar>;
  else if (loaded.data) body = children(loaded.data);
  return <div ref={loaded.ref}>{body}</div>;
}
