'use client';

// Distribuidoras: la brecha de share entre cadenas y cuántos cines, salas y funciones da cada distribuidora, como
// `GET /api/distribuidoras`. Los filtros de plaza y periodo viven en la URL, igual que en la Cartelera.
import * as React from 'react';
import { MessageBar, MessageBarBody } from '@fluentui/react-components';
import { type Cell, Leerla, Leyenda, PageHeader, Pregunta, Seccion, SkeletonTable, Table } from '@/components/common';
import { PeriodSelector, PlazaSelector, usePeriod, usePlaza } from '@/components/filters';
import { MoviesDumbbell } from '@/components/movies-dumbbell';
import { ApiError, api, query } from '@/lib/api';
import { fill, fixed, n, pp, range_es } from '@/lib/format';
import { CHAIN_COLOR, CHAIN_LABEL, COMPARED, DISTRIBUTOR_KIND_LABEL, DISTRIBUTOR_TEXT as T, US } from '@/lib/labels.generated';

type Row = Record<string, string | number | null>;
type Chain = (typeof COMPARED)[number];
type Gap = { distributor: string; kind: string; gap_pp: number } & Record<`share_${Chain}` | `shows_${Chain}`, number>;
type Distribuidoras = {
  d0: string;
  d1: string;
  conclusions: { brecha?: string; sin_conciliar?: string };
  gaps: Gap[];
  distributors: Row[];
};

const TEXT_COLUMNS = ['distributor', 'kind', 'chain'];
const ONE_DECIMAL = ['share_cinemas', 'share_shows'];

// Las filas llegan ordenadas por funciones; aquí solo se cambian las llaves por su texto.
function table(rows: Row[], headers: Record<string, string>) {
  const columns = Object.keys(headers);
  return {
    headers: Object.values(headers),
    rows: rows.map((r) => columns.map((c): Cell => {
      if (c === 'kind') return DISTRIBUTOR_KIND_LABEL[String(r[c]) as keyof typeof DISTRIBUTOR_KIND_LABEL] ?? String(r[c]);
      if (c === 'chain') return CHAIN_LABEL[String(r[c]) as keyof typeof CHAIN_LABEL] ?? String(r[c]);
      const v = r[c];
      return typeof v === 'number' ? n(v, ONE_DECIMAL.includes(c) ? 1 : 0) : v ?? '';
    })),
    numCols: columns.flatMap((c, i) => (TEXT_COLUMNS.includes(c) ? [] : [i])),
  };
}

// Las pesas de la sección Películas, con una distribuidora por fila. Llegan ordenadas por la diferencia.
function gapRows(gaps: Gap[]) {
  return gaps.map((g) => ({
    ...g,
    title: g.distributor,
    delta: pp(g.gap_pp),
    winner: g.gap_pp > 0 ? US : '',
    tooltip: Object.fromEntries(COMPARED.filter((c) => g[`shows_${c}`]).map((c) => [c, fill(T.gap_tooltip, {
      distributor: g.distributor, chain: CHAIN_LABEL[c], share: fixed(g[`share_${c}`], 1), shows: n(g[`shows_${c}`]),
    })])),
  }));
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
        <Leyenda items={COMPARED.map((c) => [CHAIN_LABEL[c], CHAIN_COLOR[c]] as const)} />
        <MoviesDumbbell movies={gapRows(data.gaps)} axisTitle={T.gap_axis} contenedor={{ ayuda: <Leerla>{T.leer_gaps}</Leerla> }} />
      </Seccion>
      <Seccion slug="distribuidoras">
        <Pregunta texto={T.question} />
        <Table {...table(data.distributors, T.columns)} />
      </Seccion>
    </>
  );
}
