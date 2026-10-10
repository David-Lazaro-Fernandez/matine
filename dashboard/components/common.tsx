'use client';

// Componentes compartidos por las páginas, con el nombre y el orden de los helpers de ui/common.py (DESIGN.md).
// Una sección de evidencia va así: Pregunta, Leyenda, gráfica, controles y Leerla, dentro de una Seccion.
import * as React from 'react';
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Link,
  createTableColumn,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import { useRouter } from 'next/navigation';
import { fill } from '@/lib/format';
import { AUTH_TEXT, GRAY, GRAY_LIGHT, INK, LAYER_TEXT, LINE, PAPER, RED, RED_SOFT, WARN } from '@/lib/labels.generated';

const useStyles = makeStyles({
  capaTag: { display: 'flex', alignItems: 'baseline', gap: '14px', margin: '44px 0 4px' },
  capaNum: {
    fontWeight: 850,
    fontStretch: '70%',
    fontSize: '15px',
    color: PAPER,
    backgroundColor: INK,
    padding: '3px 12px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
  },
  capaNumRoja: { backgroundColor: RED },
  capaTitle: { fontWeight: 800, fontStretch: '80%', fontSize: '26px', margin: 0 },
  capaDesc: { color: GRAY, fontSize: '13.5px', margin: '2px 0 18px', maxWidth: '640px' },
  card: {
    backgroundColor: PAPER,
    border: `1px solid ${LINE}`,
    borderRadius: '6px',
    padding: '22px 26px 18px',
    marginBottom: '18px',
  },
  pregunta: { fontWeight: 800, fontStretch: '82%', fontSize: '22px', margin: '0 0 4px', lineHeight: 1.2 },
  conclusion: {
    fontWeight: 700,
    fontSize: '15.5px',
    margin: '6px 0 14px',
    padding: '10px 14px',
    backgroundColor: GRAY_LIGHT,
    borderRadius: '5px',
    borderLeft: `3px solid ${INK}`,
    lineHeight: 1.45,
  },
  nota: { fontStyle: 'italic', fontWeight: 500, color: GRAY },
  leerla: { fontSize: '13px', color: GRAY, maxWidth: '720px' },
  leerlaHeader: { fontSize: '13px', fontWeight: 600 },
  apendice: { backgroundColor: PAPER, border: `1px solid ${LINE}`, borderRadius: '6px', marginBottom: '4px' },
  apendiceHeader: { fontWeight: 700, fontSize: '15px' },
  resumen: { color: GRAY, fontWeight: 400 },
  leyenda: { display: 'flex', flexWrap: 'wrap', gap: '18px', fontSize: '12.5px', color: GRAY, margin: '0 0 4px' },
  dot: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', marginRight: '6px', verticalAlign: '-1px' },
  square: { width: '9px', height: '9px', borderRadius: '2px' },
  hallazgo: {
    backgroundColor: PAPER,
    border: `1px solid ${LINE}`,
    borderLeft: `5px solid ${RED}`,
    borderRadius: '6px',
    padding: '20px 24px',
    display: 'grid',
    gridTemplateColumns: '1fr 240px',
    gap: '24px',
    alignItems: 'center',
    marginBottom: '14px',
    '@media (max-width: 760px)': { gridTemplateColumns: '1fr' },
  },
  hallazgoTitle: { fontSize: '19px', fontWeight: 750, lineHeight: 1.28, margin: '0 0 6px' },
  hallazgoBody: { color: GRAY, fontSize: '13.5px', margin: 0 },
  accion: {
    display: 'inline-block',
    marginTop: '10px',
    fontSize: '12.5px',
    fontWeight: 700,
    color: RED,
    backgroundColor: RED_SOFT,
    padding: '3px 10px',
    borderRadius: '4px',
  },
  soporte: {
    borderLeft: `1px solid ${LINE}`,
    paddingLeft: '22px',
    '@media (max-width: 760px)': { borderLeft: 'none', paddingLeft: 0, borderTop: `1px solid ${LINE}`, paddingTop: '12px' },
  },
  par: { display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '13px', padding: '3px 0', color: GRAY },
  parValue: { color: INK, fontWeight: 750, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  cmx: { color: RED, fontWeight: 700 },
  cnp: { fontWeight: 700 },
  sum: { fontWeight: 700, backgroundColor: GRAY_LIGHT },
  mal: { color: WARN, fontWeight: 700 },
  table: { fontSize: '13px', fontVariantNumeric: 'tabular-nums', margin: '4px 0 10px' },
  headerCell: { color: GRAY, fontWeight: 600 },
  num: { justifyContent: 'flex-end', textAlign: 'right' },
  accessPage: { display: 'flex', justifyContent: 'center', padding: `8vh ${tokens.spacingHorizontalL} 0` },
  accessCard: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: PAPER,
    border: `1px solid ${LINE}`,
    borderRadius: '6px',
    padding: '30px 32px 22px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    '& form': { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  },
  marca: { fontWeight: 850, fontStretch: '75%', fontSize: '30px', lineHeight: 1, letterSpacing: '-.01em' },
  marcaRoja: { color: RED },
  accessTitle: { fontWeight: 800, fontStretch: '82%', fontSize: '21px', margin: '6px 0 0' },
  accessLead: { color: GRAY, fontSize: '13.5px', margin: 0 },
});

// Rótulo de capa: Capa num={1} title="Hallazgos" desc="…" roja.
export function Capa({ num, title, desc, roja = false, anchor }: {
  num: number;
  title: string;
  desc: string;
  roja?: boolean;
  anchor?: string;
}) {
  const s = useStyles();
  return (
    <>
      <div className={s.capaTag} id={anchor ?? `capa${num}`}>
        <span className={mergeClasses(s.capaNum, roja && s.capaNumRoja)}>{fill(LAYER_TEXT.tag, { num })}</span>
        <h2 className={s.capaTitle}>{title}</h2>
      </div>
      <p className={s.capaDesc}>{desc}</p>
    </>
  );
}

// Tarjeta de una sección de evidencia. `slug` es el ancla de la sección.
export function Seccion({ slug, children }: { slug: string; children: React.ReactNode }) {
  return <section id={slug} className={useStyles().card}>{children}</section>;
}

// Pregunta de la sección y su conclusión. Sin conclusión, un panel pendiente, no pinta el recuadro vacío.
export function Pregunta({ texto, conclusion, nota }: { texto: string; conclusion?: string | null; nota?: string | null }) {
  const s = useStyles();
  return (
    <>
      <h3 className={s.pregunta}>{texto}</h3>
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
    <Accordion collapsible className={s.apendice}>
      <AccordionItem value="apendice">
        <AccordionHeader expandIconPosition="end" className={s.apendiceHeader}>
          {title}
          {resumen && <span className={s.resumen}>&nbsp;· {resumen}</span>}
        </AccordionHeader>
        <AccordionPanel>{children}</AccordionPanel>
      </AccordionItem>
    </Accordion>
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
  );
}

// Una celda ya formateada, o [texto, clase] para resaltarla: 'cmx' Cinemex, 'cnp' Cinépolis, 'sum' total, 'mal' fallo.
export type Cell = string | readonly [string, 'cmx' | 'cnp' | 'sum' | 'mal'];

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
    mergeClasses(numCols.includes(i) && s.num, typeof row[i] !== 'string' && s[row[i][1]]);
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

// Tarjeta de las pantallas de acceso: la marca, el título, el texto de entrada y el formulario.
export function AccessCard({ title, lead, children }: { title?: string; lead?: string; children: React.ReactNode }) {
  const s = useStyles();
  const words = AUTH_TEXT.app_name.split(' ');
  return (
    <main className={s.accessPage}>
      <div className={s.accessCard}>
        <div className={s.marca}>
          {words.slice(0, -1).join(' ')} <span className={s.marcaRoja}>{words.at(-1)}</span>
        </div>
        {title && <h2 className={s.accessTitle}>{title}</h2>}
        {lead && <p className={s.accessLead}>{lead}</p>}
        {children}
      </div>
    </main>
  );
}

// Enlace de Fluent que navega dentro de la aplicación, sin recargar la página.
export function AppLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return <Link href={href} onClick={(e) => { e.preventDefault(); router.push(href); }}>{children}</Link>;
}
