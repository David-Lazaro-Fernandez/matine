'use client';

// Proveedores: cuántos cines, salas y funciones de cada cadena da cada distribuidor, como
// `GET /api/proveedores`. Los filtros de plaza y periodo viven en la URL, igual que en la Cartelera.
import * as React from 'react';
import { MessageBar, MessageBarBody } from '@fluentui/react-components';
import { type Cell, PageHeader, Pregunta, Seccion, SkeletonTable, Table } from '@/components/common';
import { PeriodSelector, PlazaSelector, usePeriod, usePlaza } from '@/components/filters';
import { ApiError, api, query } from '@/lib/api';
import { n, range_es } from '@/lib/format';
import { CHAIN_LABEL, PROVIDER_KIND_LABEL, PROVIDER_TEXT as T } from '@/lib/labels.generated';

type Row = Record<string, string | number | null>;
type Proveedores = { d0: string; d1: string; providers: Row[] };

const COLUMNS = ['provider', 'kind', 'chain', 'cinemas', 'share_cinemas', 'screens', 'shows', 'share_shows', 'large_shows'];
const TEXT_COLUMNS = ['provider', 'kind', 'chain'];
const ONE_DECIMAL = ['share_cinemas', 'share_shows'];

// Las filas llegan ordenadas por funciones; aquí solo se cambian las llaves por su texto.
function table(rows: Row[]) {
  return {
    headers: COLUMNS.map((c) => T.columns[c as keyof typeof T.columns]),
    rows: rows.map((r) => COLUMNS.map((c): Cell => {
      if (c === 'kind') return PROVIDER_KIND_LABEL[String(r[c]) as keyof typeof PROVIDER_KIND_LABEL] ?? String(r[c]);
      if (c === 'chain') return CHAIN_LABEL[String(r[c]) as keyof typeof CHAIN_LABEL] ?? String(r[c]);
      const v = r[c];
      return typeof v === 'number' ? n(v, ONE_DECIMAL.includes(c) ? 1 : 0) : v ?? '';
    })),
    numCols: COLUMNS.flatMap((c, i) => (TEXT_COLUMNS.includes(c) ? [] : [i])),
  };
}

export default function Page() {
  const plaza = usePlaza();
  const { d0, d1 } = usePeriod();
  const [data, setData] = React.useState<Proveedores | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const request = `/proveedores${query({ plaza, d0, d1 })}`;

  React.useEffect(() => {
    let live = true;
    setError(null);
    api<Proveedores>(request).then(
      (body) => live && setData(body),
      (e) => live && setError(e instanceof ApiError && e.detail ? e.detail : String(e)),
    );
    return () => { live = false; };
  }, [request]);

  const header = (withMeta: boolean) => (
    <PageHeader key="h" title={T.title} meta={withMeta ? [range_es(d0, d1)] : undefined}>
      <PlazaSelector />
      <PeriodSelector />
    </PageHeader>
  );

  if (error) {
    return <>{header(false)}<MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar></>;
  }
  if (!data) {
    return <>{header(false)}<SkeletonTable rows={8} columns={COLUMNS.length} /></>;
  }
  if (!data.providers.length) {
    return <>{header(false)}<MessageBar intent="info"><MessageBarBody>{T.no_data}</MessageBarBody></MessageBar></>;
  }
  return (
    <>
      {header(true)}
      <Seccion slug="proveedores">
        <Pregunta texto={T.question} />
        <Table {...table(data.providers)} />
      </Seccion>
    </>
  );
}
