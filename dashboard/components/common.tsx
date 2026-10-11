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
import { useRouter } from 'next/navigation';
import { ApiError, api } from '@/lib/api';
import { fill } from '@/lib/format';
import { AUTH_TEXT, LAYER_TEXT, RED, RED_SOFT, WARN } from '@/lib/labels.generated';

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
    gap: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXXL}`,
    alignItems: 'flex-start',
    marginTop: tokens.spacingVerticalS,
  },
  pageFooter: {
    marginTop: tokens.spacingVerticalXXXL,
    paddingTop: tokens.spacingVerticalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  capaTag: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    margin: `${tokens.spacingVerticalXXXL} 0 ${tokens.spacingVerticalXS}`,
  },
  capaTitle: { margin: 0 },
  capaDesc: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
    margin: `0 0 ${tokens.spacingVerticalL}`,
    maxWidth: '640px',
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
  leerla: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2, maxWidth: '720px' },
  leerlaHeader: { fontSize: tokens.fontSizeBase200, fontWeight: tokens.fontWeightSemibold },
  apendice: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: tokens.spacingVerticalXS,
  },
  apendiceHeader: { fontWeight: tokens.fontWeightSemibold },
  resumen: { color: tokens.colorNeutralForeground3, fontWeight: tokens.fontWeightRegular },
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
    borderLeft: `4px solid ${RED}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalXXL}`,
    display: 'grid',
    gridTemplateColumns: '1fr 240px',
    gap: tokens.spacingHorizontalXXL,
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalL,
    '@media (max-width: 760px)': { gridTemplateColumns: '1fr' },
  },
  hallazgoTitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase500,
    margin: `0 0 ${tokens.spacingVerticalXS}`,
  },
  hallazgoBody: { color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase300, margin: 0 },
  accion: {
    display: 'inline-block',
    marginTop: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: RED,
    backgroundColor: RED_SOFT,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  soporte: {
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    paddingLeft: tokens.spacingHorizontalXL,
    '@media (max-width: 760px)': {
      borderLeft: 'none',
      paddingLeft: 0,
      borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
      paddingTop: tokens.spacingVerticalM,
    },
  },
  par: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase200,
    padding: `${tokens.spacingVerticalXXS} 0`,
    color: tokens.colorNeutralForeground3,
  },
  parValue: {
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  cmx: { color: RED, fontWeight: tokens.fontWeightSemibold },
  cnp: { fontWeight: tokens.fontWeightSemibold },
  sum: { fontWeight: tokens.fontWeightSemibold, backgroundColor: tokens.colorNeutralBackground2 },
  mal: { color: WARN, fontWeight: tokens.fontWeightSemibold },
  table: { fontSize: tokens.fontSizeBase200, fontVariantNumeric: 'tabular-nums', margin: `${tokens.spacingVerticalXS} 0 ${tokens.spacingVerticalS}` },
  headerCell: { color: tokens.colorNeutralForeground3, fontWeight: tokens.fontWeightSemibold },
  num: { justifyContent: 'flex-end', textAlign: 'right' },
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

// Rótulo de capa: Capa num={1} title="Hallazgos" desc="…".
export function Capa({ num, title, desc, anchor }: { num: number; title: string; desc: string; anchor?: string }) {
  const s = useStyles();
  return (
    <>
      <div className={s.capaTag} id={anchor ?? `capa${num}`}>
        <Badge appearance="tint" color="brand">{fill(LAYER_TEXT.tag, { num })}</Badge>
        <Subtitle1 as="h2" className={s.capaTitle}>{title}</Subtitle1>
      </div>
      <p className={s.capaDesc}>{desc}</p>
    </>
  );
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

// "Cómo leerla", cerrado por defecto, al final de la sección.
export function Leerla({ children }: { children: React.ReactNode }) {
  const s = useStyles();
  return (
    <Accordion collapsible>
      <AccordionItem value="leerla">
        <AccordionHeader size="small" className={s.leerlaHeader}>{LAYER_TEXT.read_it}</AccordionHeader>
        <AccordionPanel className={s.leerla}>{children}</AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
}

// Apéndice de la Capa 3: cerrado, con una línea de resumen visible junto al título.
export function Apendice({ title, resumen, children }: { title: string; resumen?: string | null; children: React.ReactNode }) {
  const s = useStyles();
  return (
    <Entrada>
      <Accordion collapsible className={s.apendice}>
        <AccordionItem value="apendice">
          <AccordionHeader expandIconPosition="end" className={s.apendiceHeader}>
            {title}
            {resumen && <span className={s.resumen}>&nbsp;· {resumen}</span>}
          </AccordionHeader>
          <AccordionPanel>{children}</AccordionPanel>
        </AccordionItem>
      </Accordion>
    </Entrada>
  );
}

// Leyenda HTML arriba de una gráfica: items = [[texto, color], …].
export function Leyenda({ items, square = false }: { items: readonly (readonly [string, string])[]; square?: boolean }) {
  const s = useStyles();
  return (
    <div className={s.leyenda}>
      {items.map(([text, color]) => (
        <span key={text}>
          <i className={mergeClasses(s.dot, square && s.square)} style={{ backgroundColor: color }} />
          {text}
        </span>
      ))}
    </div>
  );
}

// Un hallazgo de `analytics.findings`.
export type Finding = {
  title: string;
  body: string;
  action: string;
  support: { label: string; value: string; cmx: boolean }[];
};

// Tarjeta de hallazgo de la Capa 1: titular como decisión, contexto, chip de decisión y números de soporte.
export function Hallazgo({ f }: { f: Finding }) {
  const s = useStyles();
  return (
    <Entrada>
      <div className={s.hallazgo}>
        <div>
          <h3 className={s.hallazgoTitle}>{f.title}</h3>
          <p className={s.hallazgoBody}>{f.body}</p>
          <span className={s.accion}>{f.action}</span>
        </div>
        <div className={s.soporte}>
          {f.support.map((p) => (
            <div key={p.label} className={s.par}>
              <span>{p.label}</span>
              <b className={mergeClasses(s.parValue, p.cmx && s.cmx)}>{p.value}</b>
            </div>
          ))}
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

// Tabla compacta como `table()` de ui/common.py, sobre el DataGrid de Fluent. `numCols` alinea a la derecha.
// ponytail: sin virtualizar. El explorador de Datos necesita la versión de @fluentui-contrib para miles de renglones.
export function Table({ headers, rows, numCols = [] }: { headers: string[]; rows: Cell[][]; numCols?: number[] }) {
  const s = useStyles();
  const columns = headers.map((header, i) =>
    createTableColumn<Cell[]>({
      columnId: i,
      renderHeaderCell: () => header,
      renderCell: (row) => (typeof row[i] === 'string' ? row[i] : row[i][0]),
    }),
  );
  const cellClass = (row: Cell[], i: number) =>
    mergeClasses(numCols.includes(i) && s.num, ...cellClasses(row[i]).map((c) => s[c]));
  return (
    <DataGrid items={rows} columns={columns} getRowId={(row) => rows.indexOf(row)} size="small" className={s.table}>
      <DataGridHeader>
        <DataGridRow>
          {({ renderHeaderCell, columnId }) => (
            <DataGridHeaderCell className={mergeClasses(s.headerCell, numCols.includes(Number(columnId)) && s.num)}>
              {renderHeaderCell()}
            </DataGridHeaderCell>
          )}
        </DataGridRow>
      </DataGridHeader>
      <DataGridBody<Cell[]>>
        {({ item, rowId }) => (
          <DataGridRow<Cell[]> key={rowId}>
            {({ renderCell, columnId }) => (
              <DataGridCell className={cellClass(item, Number(columnId))}>{renderCell(item)}</DataGridCell>
            )}
          </DataGridRow>
        )}
      </DataGridBody>
    </DataGrid>
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
export function AppLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return <Link href={href} onClick={(e) => { e.preventDefault(); router.push(href); }}>{children}</Link>;
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

export function SkeletonCapa() {
  const s = useStyles();
  return (
    <Skeleton className={mergeClasses(s.capaTag, s.skeletonRow)} aria-busy>
      <SkeletonItem size={24} style={{ width: 64 }} />
      <SkeletonItem size={24} className={s.skeletonShort} />
    </Skeleton>
  );
}

export function SkeletonHallazgo() {
  const s = useStyles();
  return (
    <div className={s.hallazgo}>
      <SkeletonLines lines={3} />
      <div className={s.soporte}><SkeletonLines lines={4} /></div>
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
      <SkeletonCapa />
      {Array.from({ length: findings }, (_, i) => <SkeletonHallazgo key={i} />)}
      <SkeletonCapa />
      {Array.from({ length: sections }, (_, i) => <SkeletonSeccion key={i} />)}
      {appendices > 0 && <SkeletonCapa />}
      {Array.from({ length: appendices }, (_, i) => <SkeletonApendice key={i} />)}
    </>
  );
}

// --- Carga de datos por partes ---

// El texto de un error de la API para el usuario: el `detail` que manda la API, o el error tal cual.
export function errorText(e: unknown): string {
  return (e instanceof ApiError && e.detail) || String(e);
}

type Loaded<T> = { data: T | null; error: unknown };

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
    return () => observer.disconnect();
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
