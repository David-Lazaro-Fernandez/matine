'use client';

// Explorador de datos: tablas curadas de `snapshots.db` (`GET /api/datos`) y descarga en CSV.
// Los parámetros de la URL se llaman como los de la API y viajan tal cual; la API ignora los que el conjunto no declara.
import * as React from 'react';
import {
  Button,
  Caption1,
  Checkbox,
  Input,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { ArrowDownload20Regular, ChevronLeft20Regular, ChevronRight20Regular, Database20Regular, Search20Regular } from '@fluentui/react-icons';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  PageHeader,
  Table,
  SkeletonTable,
} from '@/components/common';
import { FilterChecks, FilterMenu, FilterPopover, HideFields, SortFields } from '@/components/filters';
import { downloadCsv } from '@/lib/download';
import { useCanDownload } from '@/lib/session';
import { ApiError, api } from '@/lib/api';
import { PILOT_TIMEZONE, fill, fixed } from '@/lib/format';
import {
  AVAILABILITY_LABEL,
  CHAIN_LABEL,
  COLUMN_LABEL,
  DATASET_LABEL,
  DATA_TEXT,
  DATE_TEXT,
  DAY_TYPE_LABEL,
  FORMAT_BUCKETS,
  FORMAT_LABEL,
  KIND_LABEL,
  LANGUAGE_LABEL,
  PLATFORM_LABEL,
  PLAZA_LABEL,
  ROLE_LABEL,
  STATUS_LABEL,
  VS_NOW_LABEL,
} from '@/lib/labels.generated';

type Row = Record<string, string | number | null>;
type Datos = {
  datasets: { key: keyof typeof DATASET_LABEL; filters: string[] }[];
  dataset: keyof typeof DATASET_LABEL;
  d0: string | null;
  d1: string | null;
  cinemas: { chain: string; cinema_id: string; cinema_name: string }[];
  categories: string[];
  rows: Row[];
  total: number;
  limit: number;
  offset: number;
  max_rows: number;
};

const DEFAULT_DATASET = 'cinemas';
// Las mismas de `analytics.datasets.PAGE_SIZES`.
const PAGE_SIZES = ['25', '50', '100'];
const DEFAULT_PAGE_SIZE = '50';
// Llaves de la URL que no son filtros de la API. Cambiar un filtro, el orden o el tamaño regresa a la primera página.
const VIEW_KEYS = ['ocultar', 'orden', 'dir', 'pagina', 'por_pagina'];
const HIDDEN = ['cinema_id', 'show_id', 'lat', 'lng'];
const PRICES = ['general_price', 'min_price', 'max_price', 'fee_price', 'price'];
const TIMES = ['sampled_at', 'detected_at', 'first_seen', 'first_seen_at', 'closed_at', 'last_seen', 'last_login_at',
  'created_at', 'starts_at', 'taken_at', 'finished_at', 'last_started_at', 'last_at'];
const RELABEL: Record<string, Record<string, string>> = {
  chain: CHAIN_LABEL, kind: KIND_LABEL, format_bucket: FORMAT_LABEL, day_type: DAY_TYPE_LABEL, status: STATUS_LABEL,
  vs_now: VS_NOW_LABEL, role: ROLE_LABEL, closed_kind: STATUS_LABEL, language: LANGUAGE_LABEL, platform: PLATFORM_LABEL,
  plaza: PLAZA_LABEL,
};
// Las llaves de la URL que dependen del conjunto, como las llaves por conjunto de Streamlit.
const PER_DATASET = ['category', 'search', 'latest_only', 'ocultar', 'orden', 'dir', 'pagina'];

const useStyles = makeStyles({
  bar: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalL, alignItems: 'flex-end', marginBottom: tokens.spacingVerticalM },
  tabs: { display: 'flex' },
  // Solo la línea de arriba, donde se apoya la pestaña del conjunto. Sin bordes a los lados, el contenido va alineado
  // con el título.
  folder: {
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    paddingTop: tokens.spacingVerticalL,
  },
  dates: { display: 'flex', gap: tokens.spacingHorizontalS },
  scroll: { maxHeight: '560px', overflow: 'auto', marginBottom: tokens.spacingVerticalXL },
  caption: { display: 'block', color: tokens.colorNeutralForeground3, margin: `0 0 ${tokens.spacingVerticalS}` },
});

// 'dd/mm hh:mm A.M.' en hora de la plaza, como `local_time` de ui/common.py. Una hora sin zona ya es local.
function localTime(iso: string): string {
  let [day, month, hour, minute] = [iso.slice(8, 10), iso.slice(5, 7), Number(iso.slice(11, 13) || 0), iso.slice(14, 16) || '00'];
  if (iso.length > 10 && /(Z|[+-]\d{2}:?\d{2})$/i.test(iso)) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: PILOT_TIMEZONE, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
    [day, month, hour, minute] = [parts.day, parts.month, Number(parts.hour), parts.minute];
  }
  const h12 = String(hour % 12 || 12).padStart(2, '0');
  return `${day}/${month} ${h12}:${minute} ${hour < 12 ? DATE_TEXT.am : DATE_TEXT.pm}`.replace(/^0/, '');
}

// Un valor como lo pinta `pretty()` de ui/common.py; los precios con `money` si `money` es verdadero.
function cell(col: string, v: string | number | null, money: boolean): string {
  if (col === 'availability') {
    const key = v || '(sin color)';
    return AVAILABILITY_LABEL[key as keyof typeof AVAILABILITY_LABEL] ?? String(key);
  }
  if (v == null) return '';
  if (PRICES.includes(col)) return money ? fill(DATA_TEXT.money, { v: fixed(Number(v), 2) }) : String(v);
  if (typeof v === 'string' && TIMES.includes(col)) return localTime(v);
  if (col in RELABEL) return RELABEL[col][String(v)] ?? String(v);
  return String(v);
}

export default function Page() {
  const s = useStyles();
  const canDownload = useCanDownload();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [data, setData] = React.useState<Datos | null>(null);
  const [loaded, setLoaded] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const dataset = (params.get('dataset') ?? DEFAULT_DATASET) as keyof typeof DATASET_LABEL;
  // La base ordena y pagina: `orden`, `dir`, `pagina` y `por_pagina` van a la API como sort, desc, offset y limit.
  const hidden = params.get('ocultar')?.split(',') ?? [];
  const sort = params.get('orden');
  const desc = params.get('dir') === 'desc';
  const pageSize = PAGE_SIZES.includes(params.get('por_pagina') ?? '') ? params.get('por_pagina')! : DEFAULT_PAGE_SIZE;
  const pageNumber = Math.max(1, Number(params.get('pagina')) || 1);
  const apiParams = new URLSearchParams(params);
  for (const key of VIEW_KEYS) apiParams.delete(key);
  const filterString = apiParams.toString();
  if (sort) apiParams.set('sort', sort);
  if (desc) apiParams.set('desc', 'true');
  apiParams.set('limit', pageSize);
  apiParams.set('offset', String((pageNumber - 1) * Number(pageSize)));
  const queryString = apiParams.toString();

  const setParams = (changes: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(params);
    if (Object.keys(changes).some((key) => key !== 'pagina' && key !== 'ocultar')) next.delete('pagina');
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key);
      for (const v of value === null ? [] : [value].flat()) next.append(key, v);
    }
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  React.useEffect(() => {
    let live = true;
    setError(null);
    api<Datos>(`/datos?${queryString}`).then(
      (d) => { if (live) { setData(d); setLoaded(queryString); } },
      (e) => live && setError((e instanceof ApiError && e.detail) || String(e)),
    );
    return () => { live = false; };
  }, [queryString]);

  const filters = data?.datasets.find((d) => d.key === dataset)?.filters ?? [];
  const chain = params.get('chain');
  const all = DATA_TEXT.all;
  const choose = (key: string) => (value: string) => setParams({ [key]: value || null });

  const header = (c: string) => COLUMN_LABEL[c as keyof typeof COLUMN_LABEL] ?? c;
  const allColumns = data?.rows.length ? Object.keys(data.rows[0]).filter((c) => !HIDDEN.includes(c)) : [];
  const columns = allColumns.filter((c) => !hidden.includes(c));
  const headers = columns.map(header);
  const loading = data !== null && loaded !== queryString;
  const rows = data?.rows ?? [];
  // El CSV trae todo lo filtrado, en el orden de la tabla, hasta `max_rows`: lo pide aparte.
  const download = async () => {
    const all = new URLSearchParams(filterString);
    if (sort) all.set('sort', sort);
    if (desc) all.set('desc', 'true');
    all.set('limit', String(data!.max_rows));
    const full = await api<Datos>(`/datos?${all}`);
    const suffix = full.d0 ? `_${full.d0}_${full.d1}` : '';
    downloadCsv(`${dataset}${suffix}`, headers, full.rows.map((r) => columns.map((c) => cell(c, r[c], false))));
  };

  return (
    <>
      <PageHeader title={DATA_TEXT.title} />

      <div className={s.tabs}>
        <FilterMenu
          label={DATA_TEXT.dataset}
          icon={<Database20Regular />}
          value={dataset}
          options={Object.entries(DATASET_LABEL)}
          tab
          onChange={(value) => setParams({ dataset: value, ...Object.fromEntries(PER_DATASET.map((k) => [k, null])) })}
        />
      </div>
      <div className={s.folder}>
        {/* Este renglón se pinta aunque no haya renglones: el filtro que vació el resultado tiene que poder quitarse. */}
        {data && (
          <div className={s.bar}>
            {allColumns.length > 0 && (
              <>
                <HideFields columns={allColumns.map((c) => [c, header(c)])} hidden={hidden}
                            onChange={(next) => setParams({ ocultar: next.join(',') || null })} />
                <SortFields columns={allColumns.map((c) => [c, header(c)])} sort={sort} desc={desc}
                            onChange={(next, down) => setParams({ orden: next, dir: down ? 'desc' : null })} />
              </>
            )}
            {filters.includes('dates') && data?.d0 && data.d1 && (
              <div className={s.dates}>
                <Input type="date" aria-label={DATA_TEXT.dates} value={data.d0} max={data.d1} onChange={(_, v) => v.value && setParams({ d0: v.value, d1: data.d1 })} />
                <Input type="date" aria-label={DATA_TEXT.dates} value={data.d1} min={data.d0} onChange={(_, v) => v.value && setParams({ d0: data.d0, d1: v.value })} />
              </div>
            )}
            {filters.includes('platform') && (
              <FilterMenu label={DATA_TEXT.platform} value={params.get('platform') ?? ''}
                          options={[['', all], ...Object.entries(PLATFORM_LABEL)]} onChange={choose('platform')} />
            )}
            {filters.includes('chain') && (
              <FilterMenu label={DATA_TEXT.chain} value={chain ?? ''}
                          options={[['', all], ...Object.entries(CHAIN_LABEL)]} onChange={choose('chain')} />
            )}
            {filters.includes('cinema_ids') && data && (
              <FilterChecks
                label={DATA_TEXT.cinemas}
                values={params.getAll('cinema_ids')}
                options={data.cinemas.map((c) => [`${c.chain}:${c.cinema_id}`, chain ? c.cinema_name
                  : fill(DATA_TEXT.cinema_option, { chain: CHAIN_LABEL[c.chain as keyof typeof CHAIN_LABEL] ?? c.chain, cinema: c.cinema_name })])}
                onChange={(values) => setParams({ cinema_ids: values })}
              />
            )}
            {filters.includes('format_bucket') && (
              <FilterMenu label={DATA_TEXT.format} value={params.get('format_bucket') ?? ''}
                          options={[['', all], ...FORMAT_BUCKETS.map((k): [string, string] => [k, FORMAT_LABEL[k]])]}
                          onChange={choose('format_bucket')} />
            )}
            {filters.includes('day_type') && (
              <FilterMenu label={DATA_TEXT.day_type} value={params.get('day_type') ?? ''}
                          options={[['', all], ...Object.entries(DAY_TYPE_LABEL)]} onChange={choose('day_type')} />
            )}
            {filters.includes('category') && data && (
              <FilterMenu label={DATA_TEXT.category} value={params.get('category') ?? ''}
                          options={[['', all], ...data.categories.map((c): [string, string] => [c, c])]} onChange={choose('category')} />
            )}
            {filters.includes('search') && (
              <FilterPopover label={DATA_TEXT.search} icon={<Search20Regular />} text={params.get('search') ?? ''} note={DATA_TEXT.search_help}
                             onClear={() => setParams({ search: null })}>
                {/* La búsqueda se aplica con Enter o al salir del campo. */}
                <Input
                  key={`${dataset}:${params.get('search') ?? ''}`}
                  aria-label={DATA_TEXT.search}
                  defaultValue={params.get('search') ?? ''}
                  onBlur={(e) => setParams({ search: e.currentTarget.value.trim() || null })}
                  onKeyDown={(e) => e.key === 'Enter' && setParams({ search: e.currentTarget.value.trim() || null })}
                />
              </FilterPopover>
            )}
            {filters.includes('only_open') && (
              <Checkbox
                label={DATA_TEXT.only_open}
                checked={params.get('only_open') === 'true'}
                onChange={(_, d) => setParams({ only_open: d.checked ? 'true' : null })}
              />
            )}
            {filters.includes('latest_only') && (
              <Checkbox
                label={DATA_TEXT.latest_only}
                checked={params.get('latest_only') !== 'false'}
                onChange={(_, d) => setParams({ latest_only: d.checked ? null : 'false' })}
              />
            )}
          </div>
        )}

        {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
        {!data && !error && <SkeletonTable rows={12} columns={6} />}
        {data && !data.rows.length && <MessageBar intent="info"><MessageBarBody>{DATA_TEXT.empty}</MessageBarBody></MessageBar>}
        {data && data.rows.length > 0 && (
          <>
            {/* Al cambiar de página u orden, la tabla anterior no se queda: su lugar lo toma el esqueleto. */}
            {loading ? <SkeletonTable rows={12} columns={Math.min(columns.length, 8) || 6} /> : (
              <div className={s.scroll}>
                <Table
                  headers={headers}
                  rows={rows.map((r) => columns.map((c) => cell(c, r[c], true)))}
                  numCols={columns.flatMap((c, i) => (typeof data.rows[0][c] === 'number' ? [i] : []))}
                />
              </div>
            )}
            <div className={s.bar}>
              <Caption1>
                {fill(DATA_TEXT.page, {
                  first: (data.offset + 1).toLocaleString('en-US'),
                  last: (data.offset + data.rows.length).toLocaleString('en-US'),
                  total: data.total.toLocaleString('en-US'),
                })}
              </Caption1>
              <Button appearance="subtle" icon={<ChevronLeft20Regular />} aria-label={DATA_TEXT.previous} disabled={loading || data.offset === 0}
                      onClick={() => setParams({ pagina: pageNumber > 2 ? String(pageNumber - 1) : null })} />
              <Button appearance="subtle" icon={<ChevronRight20Regular />} aria-label={DATA_TEXT.next}
                      disabled={loading || data.offset + data.rows.length >= data.total}
                      onClick={() => setParams({ pagina: String(pageNumber + 1) })} />
              <FilterMenu label={DATA_TEXT.page_size} value={pageSize}
                          options={PAGE_SIZES.map((n) => [n, fill(DATA_TEXT.page_size_value, { n })])}
                          onChange={(value) => setParams({ por_pagina: value === DEFAULT_PAGE_SIZE ? null : value })} />
              {canDownload && <Button icon={<ArrowDownload20Regular />} onClick={download}>{DATA_TEXT.download}</Button>}
            </div>
          </>
        )}
      </div>
    </>
  );
}
