'use client';

// Dulcería, como views/dulceria.py: precio en sala de Cinépolis por complejo y comparación a domicilio (Rappi, DiDi Food).
// Los datos salen de `GET /api/dulceria`. No depende del periodo: los precios de dulcería no cambian con la función.
import * as React from 'react';
import {
  Dropdown,
  Field,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  makeStyles,
} from '@fluentui/react-components';
import { useSearchParams } from 'next/navigation';
import { Apendice, AppLink, Capa, type Cell, type Finding, Hallazgo, Leerla, Leyenda, Pregunta, Seccion, Table } from '@/components/common';
import { DeliveryCompareBars, type DeliveryCompareRow } from '@/components/dulceria/delivery-compare-bars';
import { ProductPriceByCinema, type ProductByCinemaRow } from '@/components/dulceria/product-price-by-cinema';
import { PlazaSelector, usePlaza, useSetParams } from '@/components/filters';
import { api, query } from '@/lib/api';
import { date_es, fill, fixed, localTime, n, signed } from '@/lib/format';
import {
  CHAIN_COLOR,
  CHAIN_LABEL,
  COLUMN_LABEL,
  COMPARED,
  DULCERIA_TEXT as T,
  GRAY,
  INK,
  LINE,
  NATIONAL_LABEL,
  PLATFORM_LABEL,
  PLAZA_LABEL,
  RED,
} from '@/lib/labels.generated';

type Chain = (typeof COMPARED)[number];
type Platform = keyof typeof PLATFORM_LABEL;
type Row = Record<string, string | number | null>;
type CompareRow = DeliveryCompareRow & { cinemex_product: string | null; cinepolis_product: string | null };
type BasketRow = {
  product_name: string;
  cinemas: number;
  median_price: number;
  min_price: number;
  max_price: number;
  spread_pct: number;
  distinct_prices: number;
};
type SummaryRow = { platform: Platform; chain: Chain; stores: number; products: number; pct_single_price: number | null; last_sampled: string | null };
type Dulceria = {
  plaza: string | null;
  platform: Platform | null;
  chain: Chain;
  product: string | null;
  first_snapshot: string;
  conclusion: string;
  findings: Finding[];
  concession_summary: { cinemas: number | null }[];
  basket: BasketRow[];
  product_by_cinema: ProductByCinemaRow[];
  by_cinema: Row[];
  delivery_summary: SummaryRow[];
  delivery_compare: CompareRow[];
  delivery_products: Row[];
  delivery_stores: Row[];
};

const BOTH = 'ambas';
const PLATFORMS = Object.keys(PLATFORM_LABEL) as Platform[];
const PRODUCT_COLUMNS = ['product_name', 'category', 'stores', 'median_price', 'min_price', 'max_price', 'distinct_prices'];
const STORE_COLUMNS = ['platform', 'store_name', 'products', 'median_price'];

const useStyles = makeStyles({
  enc: { padding: '6px 0 8px', borderBottom: `3px solid ${INK}`, marginBottom: '8px' },
  title: {
    fontSize: 'clamp(30px, 4.2vw, 46px)',
    fontWeight: 850,
    fontStretch: '75%',
    lineHeight: 1.02,
    margin: 0,
    '& span': { color: RED },
  },
  meta: { display: 'flex', flexWrap: 'wrap', gap: '6px 22px', padding: '12px 0 14px', color: GRAY, fontSize: '13.5px' },
  metaKey: { color: INK, fontWeight: 600 },
  filters: { display: 'flex', flexWrap: 'wrap', gap: '12px 28px', alignItems: 'flex-start', margin: '8px 0 22px' },
  columns: { display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px', '@media (max-width: 760px)': { gridTemplateColumns: '1fr' } },
  // Sin esto, una columna de grid no se encoge por debajo del ancho de su tabla.
  column: { minWidth: 0 },
  chartTitle: { fontWeight: 700, margin: '0 0 6px' },
  nota: { color: GRAY, fontSize: '13px', margin: '6px 0 2px' },
  detail: { display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px', '@media (max-width: 760px)': { gridTemplateColumns: '1fr' } },
  scroll: { maxHeight: '360px', overflow: 'auto', minWidth: 0 },
  scrollShort: { maxHeight: '300px', overflow: 'auto' },
  pie: { marginTop: '48px', paddingTop: '16px', borderTop: `1px dashed ${LINE}`, color: GRAY, fontSize: '12.5px' },
});

function has(v: number | null | undefined): v is number {
  return v != null && v > 0;
}

function money(v: number | null | undefined): string {
  return has(v) ? `$${n(v)}` : '—';
}

// Un valor de `pretty()` de ui/common.py dentro de una tabla de detalle: las cifras con miles, la plataforma traducida.
function detailCell(col: string, v: string | number | null): string {
  if (v == null) return '';
  if (col === 'platform') return PLATFORM_LABEL[v as Platform] ?? String(v);
  if (typeof v === 'number') return n(v, Number.isInteger(v) ? 0 : 2);
  return v;
}

function detailTable(columns: string[], rows: Row[]) {
  return (
    <Table
      headers={columns.map((c) => COLUMN_LABEL[c as keyof typeof COLUMN_LABEL] ?? c)}
      rows={rows.map((r) => columns.map((c) => detailCell(c, r[c])))}
      numCols={columns.flatMap((c, i) => (typeof rows[0]?.[c] === 'number' ? [i] : []))}
    />
  );
}

export default function Page() {
  const s = useStyles();
  const params = useSearchParams();
  const setParams = useSetParams();
  const plaza = usePlaza();
  const platformParam = params.get('plataforma');
  const platform = PLATFORMS.includes(platformParam as Platform) ? (platformParam as Platform) : null;
  const chainParam = params.get('cadena');
  const chain = COMPARED.includes(chainParam as Chain) ? (chainParam as Chain) : COMPARED[0];
  const product = params.get('producto');
  const [data, setData] = React.useState<Dulceria | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const request = `/dulceria${query({ plaza, platform, chain: chain === COMPARED[0] ? null : chain, product })}`;
  React.useEffect(() => {
    api<Dulceria>(request).then((body) => { setData(body); setError(null); }, (e: Error) => setError(e.message));
  }, [request]);

  const zoneLabel = plaza ? PLAZA_LABEL[plaza as keyof typeof PLAZA_LABEL] ?? plaza : NATIONAL_LABEL;
  const header = (
    <div className={s.enc}>
      {/* El título de labels.py lleva un <span> para la palabra en rojo. */}
      <h1 className={s.title} dangerouslySetInnerHTML={{ __html: T.title }} />
      <div className={s.meta}>
        <span><strong className={s.metaKey}>{T.meta_zone}:</strong> {zoneLabel}</span>
        <span><strong className={s.metaKey}>{T.meta_room}:</strong> {T.meta_room_value}</span>
        <span><strong className={s.metaKey}>{T.meta_delivery}:</strong> {T.meta_delivery_value}</span>
        <span>{T.meta_note}</span>
      </div>
    </div>
  );

  const info = (text: string) => <MessageBar intent="info"><MessageBarBody>{text}</MessageBarBody></MessageBar>;

  const delivery = (d: Dulceria) => (
    <>
      <p className={s.chartTitle}>{T.delivery_title}</p>
      <RadioGroup
        layout="horizontal"
        aria-label={T.platform}
        value={platform ?? BOTH}
        onChange={(_, v) => setParams({ plataforma: v.value === BOTH ? null : v.value })}
      >
        <Radio value={BOTH} label={T.both} />
        {PLATFORMS.map((p) => <Radio key={p} value={p} label={PLATFORM_LABEL[p]} />)}
      </RadioGroup>
      {!d.delivery_compare.length ? info(T.delivery_empty) : (
        <>
          <DeliveryCompareBars rows={d.delivery_compare} />
          <Table
            headers={[...T.compare_headers]}
            rows={d.delivery_compare.map((r): Cell[] => [
              r.label,
              [money(r.cinemex_median), 'cmx'],
              r.cinemex_product || '—',
              [money(r.cinepolis_median), 'cnp'],
              r.cinepolis_product || '—',
              r.delta_pct == null ? '' : `${signed(r.delta_pct, 0)} %`,
            ])}
            numCols={[1, 3, 5]}
          />
        </>
      )}
    </>
  );

  const room = (d: Dulceria) => {
    const row = d.basket.find((b) => b.product_name === d.product);
    if (!row) return null;
    return (
      <>
        <p className={s.chartTitle}>{fill(T.room_title, { chain: CHAIN_LABEL.cinepolis })}</p>
        <Dropdown
          aria-label={T.product}
          value={row.product_name}
          selectedOptions={[row.product_name]}
          onOptionSelect={(_, o) => setParams({ producto: o.optionValue ?? null })}
        >
          {d.basket.map((b) => <Option key={b.product_name} value={b.product_name}>{b.product_name}</Option>)}
        </Dropdown>
        {d.product_by_cinema.length > 0 && (
          <>
            <ProductPriceByCinema rows={d.product_by_cinema} basket={row} />
            <p className={s.nota}>
              {fill(T.room_note, {
                product: row.product_name, min: n(row.min_price), max: n(row.max_price),
                cinemas: Math.trunc(row.cinemas), prices: Math.trunc(row.distinct_prices), median: n(row.median_price),
              })}
            </p>
          </>
        )}
      </>
    );
  };

  const detail = (d: Dulceria, inRoom: boolean) => {
    const byCinemaColumns = ['cinema_name', 'products', 'median_price',
      ...d.basket.map((b) => b.product_name).filter((p) => d.by_cinema.length && p in d.by_cinema[0])];
    return (
      <Apendice title={T.detail}>
        {inRoom && (
          <>
            <Table
              headers={[...T.basket_headers]}
              rows={d.basket.map((r): Cell[] => [
                r.product_name, n(r.cinemas), [`$${n(r.median_price)}`, 'cnp'], `$${n(r.min_price)}`, `$${n(r.max_price)}`,
                `+${fixed(r.spread_pct, 0)} %`, n(r.distinct_prices),
              ])}
              numCols={[1, 2, 3, 4, 5, 6]}
            />
            <div className={s.scrollShort}>{detailTable(byCinemaColumns, d.by_cinema)}</div>
          </>
        )}
        {d.delivery_summary.length > 0 && (
          <>
            <Table
              headers={[...T.summary_headers]}
              rows={d.delivery_summary.map((r): Cell[] => [
                PLATFORM_LABEL[r.platform] ?? r.platform,
                [CHAIN_LABEL[r.chain], r.chain === 'cinemex' ? 'cmx' : 'cnp'],
                n(r.stores), n(r.products),
                r.pct_single_price == null ? '—' : `${fixed(r.pct_single_price, 0)} %`,
                localTime(r.last_sampled),
              ])}
              numCols={[2, 3, 4]}
            />
            <Field label={T.chain}>
              <RadioGroup layout="horizontal" value={chain} onChange={(_, v) => setParams({ cadena: v.value === COMPARED[0] ? null : v.value })}>
                {COMPARED.map((c) => <Radio key={c} value={c} label={CHAIN_LABEL[c]} />)}
              </RadioGroup>
            </Field>
            <div className={s.detail}>
              <div className={s.scroll}>{detailTable(PRODUCT_COLUMNS, d.delivery_products)}</div>
              {d.delivery_stores.length > 0 && <div className={s.scroll}>{detailTable(STORE_COLUMNS, d.delivery_stores)}</div>}
            </div>
          </>
        )}
      </Apendice>
    );
  };

  const body = () => {
    if (error) return <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>;
    if (!data) return null;
    const inRoom = has(data.concession_summary[0]?.cinemas);
    const empty = !data.concession_summary.length && !data.delivery_summary.length;
    return (
      <>
        <Capa num={1} title={T.layer1} desc={T.layer1_desc} roja />
        {!data.findings.length && info(T.no_findings)}
        {data.findings.map((f) => <Hallazgo key={f.title} f={f} />)}

        <Capa num={2} title={T.layer2} desc={T.layer2_desc} />
        <Seccion slug="dulceria">
          <Pregunta texto={T.question} conclusion={data.conclusion} nota={T.question_note} />
          {empty ? info(T.empty) : (
            <>
              <Leyenda items={COMPARED.map((c) => [CHAIN_LABEL[c], CHAIN_COLOR[c]] as const)} />
              <div className={s.columns}>
                <div className={s.column}>{delivery(data)}</div>
                <div className={s.column}>{inRoom && room(data)}</div>
              </div>
              {detail(data, inRoom)}
            </>
          )}
          <Leerla>{T.leer}</Leerla>
        </Seccion>

        <AppLink href="/">{T.back}</AppLink>
        <p className={s.pie}>{fill(T.footer, { date: date_es(data.first_snapshot) })}</p>
      </>
    );
  };

  return (
    <>
      {header}
      <div className={s.filters}>
        <PlazaSelector />
      </div>
      {body()}
    </>
  );
}
