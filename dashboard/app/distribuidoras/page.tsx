'use client';

// Distribuidoras: la brecha de share entre cadenas y cuántos cines, salas y funciones da cada distribuidora, como
// `GET /api/distribuidoras`. Los filtros de plaza y periodo viven en la URL, igual que en la Cartelera.
import * as React from 'react';
import { MessageBar, MessageBarBody } from '@fluentui/react-components';
import { type Cell, PageHeader, Pregunta, Seccion, SkeletonTable, Table } from '@/components/common';
import { PeriodSelector, PlazaSelector, usePeriod, usePlaza } from '@/components/filters';
import { ApiError, api, query } from '@/lib/api';
import { n, pp, range_es } from '@/lib/format';
import { CHAIN_LABEL, DISTRIBUTOR_KIND_LABEL, DISTRIBUTOR_TEXT as T } from '@/lib/labels.generated';

type Row = Record<string, string | number | null>;
type Distribuidoras = {
  d0: string;
  d1: string;
  conclusions: { brecha?: string; sin_conciliar?: string };
  gaps: Row[];
  distributors: Row[];
};

const TEXT_COLUMNS = ['distributor', 'kind', 'chain'];
const ONE_DECIMAL = ['share_cinemas', 'share_shows', 'share_cinemex', 'share_cinepolis'];

// Las filas llegan ordenadas desde la API; aquí solo se cambian las llaves por su texto.
function table(rows: Row[], headers: Record<string, string>) {
  const columns = Object.keys(headers);
  return {
    headers: Object.values(headers),
    rows: rows.map((r) => columns.map((c): Cell => {
      if (c === 'kind') return DISTRIBUTOR_KIND_LABEL[String(r[c]) as keyof typeof DISTRIBUTOR_KIND_LABEL] ?? String(r[c]);
      if (c === 'chain') return CHAIN_LABEL[String(r[c]) as keyof typeof CHAIN_LABEL] ?? String(r[c]);
      if (c === 'gap_pp') return pp(Number(r[c]));
      const v = r[c];
      return typeof v === 'number' ? n(v, ONE_DECIMAL.includes(c) ? 1 : 0) : v ?? '';
    })),
    numCols: columns.flatMap((c, i) => (TEXT_COLUMNS.includes(c) ? [] : [i])),
  };
}

export default function Page() {
  const plaza = usePlaza();
  const { d0, d1 } = usePeriod();
  const [data, setData] = React.useState<Distribuidoras | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const request = `/distribuidoras${query({ plaza, d0, d1 })}`;

  React.useEffect(() => {
    let live = true;
    setError(null);
    api<Distribuidoras>(request).then(
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
    return <>{header(false)}<SkeletonTable rows={8} columns={Object.keys(T.columns).length} /></>;
  }
  if (!data.distributors.length) {
    return <>{header(false)}<MessageBar intent="info"><MessageBarBody>{T.no_data}</MessageBarBody></MessageBar></>;
  }
  return (
    <>
      {header(true)}
      <Seccion slug="brecha">
        <Pregunta texto={T.q_gaps} conclusion={data.conclusions.brecha} nota={data.conclusions.sin_conciliar} />
        <Table {...table(data.gaps, T.gap_columns)} />
      </Seccion>
      <Seccion slug="distribuidoras">
        <Pregunta texto={T.question} />
        <Table {...table(data.distributors, T.columns)} />
      </Seccion>
    </>
  );
}
