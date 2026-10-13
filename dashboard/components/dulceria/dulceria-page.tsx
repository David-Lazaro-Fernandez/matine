'use client';

// Dulcería, como views/dulceria.py, en dos vistas: `sala` (precio de Cinépolis por complejo) y `domicilio` (Rappi, DiDi Food).
// Los datos salen de `GET /api/dulceria`. No depende del periodo: los precios de dulcería no cambian con la función.
import * as React from 'react';
import {
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Table16Regular } from '@fluentui/react-icons';
import { useSearchParams } from 'next/navigation';
import {
  AppLink,
  type Cell,
  type Finding,
  Hallazgo,
  Leerla,
  Leyenda,
  PageFooter,
  PageHeader,
  Pregunta,
  Seccion,
  Table,
  SkeletonBlock,
  SkeletonCapas,
} from '@/components/common';
import { DeliveryCompareBars, type DeliveryCompareRow } from '@/components/dulceria/delivery-compare-bars';
import { ProductPriceByCinema, type ProductByCinemaRow } from '@/components/dulceria/product-price-by-cinema';
import { GraficaGrupo } from '@/components/vega-chart';
import { FilterMenu, PlazaSelector, usePlaza, useSetParams } from '@/components/filters';
import { api, query } from '@/lib/api';
import { date_es, fill, fixed, n, signed } from '@/lib/format';
import {
  CHAIN_COLOR,
  CHAIN_LABEL,
  COMPARED,
  DULCERIA_TEXT as T,
  PLATFORM_LABEL,
} from '@/lib/labels.generated';

type Chain = (typeof COMPARED)[number];
type Platform = keyof typeof PLATFORM_LABEL;
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
type Dulceria = {
  plaza: string | null;
  platform: Platform | null;
  product: string | null;
  size: string | null;
  sizes: { size_name: string; cinemas: number; median_price: number; min_price: number; max_price: number; distinct_prices: number; is_menu_size: number }[];
  first_snapshot: string;
  conclusion: string;
  findings: Finding[];
  concession_summary: { cinemas: number | null }[];
  basket: BasketRow[];
  product_by_cinema: ProductByCinemaRow[];
  delivery_compare: CompareRow[];
};

const BOTH = 'ambas';
const PLATFORMS = Object.keys(PLATFORM_LABEL) as Platform[];

const useStyles = makeStyles({
  chartTitle: { fontWeight: tokens.fontWeightSemibold, margin: `0 0 ${tokens.spacingVerticalS}` },
});

function has(v: number | null | undefined): v is number {
  return v != null && v > 0;
}

function money(v: number | null | undefined): string {
  return has(v) ? `$${n(v)}` : '—';
}

export type DulceriaView = 'sala' | 'domicilio';

export function DulceriaPage({ view }: { view: DulceriaView }) {
  const s = useStyles();
  const params = useSearchParams();
  const setParams = useSetParams();
  const plaza = usePlaza();
  const platformParam = params.get('plataforma');
  const platform = PLATFORMS.includes(platformParam as Platform) ? (platformParam as Platform) : null;
  const product = params.get('producto');
  const size = params.get('tamano');
  const [data, setData] = React.useState<Dulceria | null>(null);
  const [loaded, setLoaded] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const request = `/dulceria${query({ plaza, platform, product, size })}`;
  React.useEffect(() => {
    api<Dulceria>(request).then((body) => { setData(body); setLoaded(request); setError(null); }, (e: Error) => setError(e.message));
  }, [request]);


  const info = (text: string) => <MessageBar intent="info"><MessageBarBody>{text}</MessageBarBody></MessageBar>;

  const delivery = (d: Dulceria) => {
    const controles = (
      <FilterMenu
        label={T.platform}
        value={platform ?? BOTH}
        options={[[BOTH, T.both], ...PLATFORMS.map((p): [string, string] => [p, PLATFORM_LABEL[p]])]}
        onChange={(value) => setParams({ plataforma: value === BOTH ? null : value })}
      />
    );
    const enlaces = [{ label: T.detail_delivery, icon: <Table16Regular />, href: '/datos/?dataset=delivery_prices' }];
    return (
      <>
        <p className={s.chartTitle}>{T.delivery_title}</p>
        <GraficaGrupo controles={controles} ayuda={d.delivery_compare.length ? <Leerla>{T.leer}</Leerla> : undefined} enlaces={enlaces}>
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
        </GraficaGrupo>
      </>
    );
  };

  const basket = (d: Dulceria) => (
    <Table
      headers={[...T.basket_headers]}
      rows={d.basket.map((r): Cell[] => [
        r.product_name, n(r.cinemas), [`$${n(r.median_price)}`, 'cnp'], `$${n(r.min_price)}`, `$${n(r.max_price)}`,
        `+${fixed(r.spread_pct, 0)} %`, n(r.distinct_prices),
      ])}
      numCols={[1, 2, 3, 4, 5, 6]}
    />
  );

  const room = (d: Dulceria) => {
    const row = d.basket.find((b) => b.product_name === d.product);
    if (!row) return null;
    const sized = d.sizes.find((z) => z.size_name === d.size);
    const controles = (
      <>
        <FilterMenu
          label={T.product}
          value={row.product_name}
          options={d.basket.map((b) => [b.product_name, b.product_name])}
          onChange={(value) => setParams({ producto: value, tamano: null })}
        />
        {d.sizes.length > 1 && d.size && (
          <FilterMenu
            label={T.size}
            value={d.size}
            options={d.sizes.map((z) => [z.size_name, z.size_name])}
            onChange={(value) => setParams({ tamano: value })}
          />
        )}
      </>
    );
    const ayuda = (
      <Leerla>
        <p>
          {fill(T.room_note, {
            product: sized ? `${row.product_name} ${sized.size_name}` : row.product_name,
            min: n(sized?.min_price ?? row.min_price), max: n(sized?.max_price ?? row.max_price),
            cinemas: Math.trunc(sized?.cinemas ?? row.cinemas), prices: Math.trunc(sized?.distinct_prices ?? row.distinct_prices),
            median: n(sized?.median_price ?? row.median_price),
          })}
        </p>
        <p>{T.leer}</p>
      </Leerla>
    );
    const enlaces = [{ label: T.detail_room, icon: <Table16Regular />, href: '/datos/?dataset=concession_sizes' }];
    return (
      <>
        <p className={s.chartTitle}>{fill(T.room_title, { chain: CHAIN_LABEL.cinepolis })}</p>
        <GraficaGrupo controles={controles} ayuda={ayuda} enlaces={enlaces}>
          {loaded !== request && <SkeletonBlock height={330} />}
          {loaded === request && d.product_by_cinema.length > 0 && <ProductPriceByCinema rows={d.product_by_cinema} />}
          {basket(d)}
        </GraficaGrupo>
      </>
    );
  };

  const body = () => {
    if (error) return <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>;
    if (!data) return <SkeletonCapas findings={2} sections={1} />;
    const inRoom = has(data.concession_summary[0]?.cinemas);
    const empty = view === 'sala' && !inRoom;
    return (
      <>
        {!data.findings.length && info(T.no_findings)}
        {data.findings.map((f) => <Hallazgo key={f.topic} f={f} />)}

        <Seccion slug="dulceria">
          <Pregunta texto={T.question} conclusion={data.conclusion} nota={T.question_note} />
          {empty ? info(T.empty) : (
            <>
              <Leyenda items={COMPARED.map((c) => [CHAIN_LABEL[c], CHAIN_COLOR[c]] as const)} />
              {view === 'sala' ? room(data) : delivery(data)}
            </>
          )}
        </Seccion>

        <AppLink href="/">{T.back}</AppLink>
        <PageFooter>{fill(T.footer, { date: date_es(data.first_snapshot) })}</PageFooter>
      </>
    );
  };

  return (
    <>
      <PageHeader title={T.title}>
        <PlazaSelector />
      </PageHeader>
      {body()}
    </>
  );
}
