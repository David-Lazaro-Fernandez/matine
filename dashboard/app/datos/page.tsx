'use client';

// Explorador de datos: tablas curadas de `snapshots.db` (`GET /api/datos`) y descarga en CSV.
// Los parámetros de la URL se llaman como los de la API y viajan tal cual; la API ignora los que el conjunto no declara.
import * as React from 'react';
import {
  Button,
  Caption1,
  Checkbox,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  PageHeader,
  Table,
  SkeletonTable,
} from '@/components/common';
import { ApiError, api } from '@/lib/api';
import { PILOT_TIMEZONE, fill, fixed } from '@/lib/format';
import {
  AVAILABILITY_LABEL,
  CHAIN_LABEL,
  COLUMN_LABEL,
  DATASET_HELP,
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
  max_rows: number;
  truncated: boolean;
};

const DEFAULT_DATASET = 'cinemas';
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
const PER_DATASET = ['category', 'search', 'latest_only'];

const useStyles = makeStyles({
  bar: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalL, alignItems: 'flex-end', marginBottom: tokens.spacingVerticalM },
  wide: { minWidth: '220px' },
  dates: { display: 'flex', gap: tokens.spacingHorizontalS },
  scroll: { maxHeight: '560px', overflow: 'auto' },
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

function csv(headers: string[], rows: string[][]): string {
  const quote = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return `﻿${[headers, ...rows].map((r) => r.map(quote).join(',')).join('\r\n')}\r\n`;
}

export default function Page() {
  const s = useStyles();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [data, setData] = React.useState<Datos | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const dataset = (params.get('dataset') ?? DEFAULT_DATASET) as keyof typeof DATASET_LABEL;
  const queryString = params.toString();

  const setParams = (changes: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(params);
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
      (d) => live && setData(d),
      (e) => live && setError((e instanceof ApiError && e.detail) || String(e)),
    );
    return () => { live = false; };
  }, [queryString]);

  const filters = data?.datasets.find((d) => d.key === dataset)?.filters ?? [];
  const chain = params.get('chain');
  const all = DATA_TEXT.all;
  const choose = (key: string) => (_: unknown, o: { optionValue?: string }) => setParams({ [key]: o.optionValue || null });

  const columns = data?.rows.length ? Object.keys(data.rows[0]).filter((c) => !HIDDEN.includes(c)) : [];
  const headers = columns.map((c) => COLUMN_LABEL[c as keyof typeof COLUMN_LABEL] ?? c);
  const download = () => {
    const rows = data!.rows.map((r) => columns.map((c) => cell(c, r[c], false)));
    const suffix = data!.d0 ? `_${data!.d0}_${data!.d1}` : '';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv(headers, rows)], { type: 'text/csv' }));
    link.download = `${dataset}${suffix}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <>
      <PageHeader title={DATA_TEXT.title} meta={[DATA_TEXT.lead]} />

      <div className={s.bar}>
        <Field label={DATA_TEXT.dataset}>
          <Dropdown
            className={s.wide}
            value={DATASET_LABEL[dataset]}
            selectedOptions={[dataset]}
            onOptionSelect={(_, o) => setParams({ dataset: o.optionValue ?? null, ...Object.fromEntries(PER_DATASET.map((k) => [k, null])) })}
          >
            {(Object.keys(DATASET_LABEL) as (keyof typeof DATASET_LABEL)[]).map((k) => (
              <Option key={k} value={k}>{DATASET_LABEL[k]}</Option>
            ))}
          </Dropdown>
        </Field>
        {filters.includes('dates') && data?.d0 && data.d1 && (
          <Field label={DATA_TEXT.dates}>
            <div className={s.dates}>
              <Input type="date" value={data.d0} max={data.d1} onChange={(_, v) => v.value && setParams({ d0: v.value, d1: data.d1 })} />
              <Input type="date" value={data.d1} min={data.d0} onChange={(_, v) => v.value && setParams({ d0: data.d0, d1: v.value })} />
            </div>
          </Field>
        )}
        {filters.includes('platform') && (
          <Field label={DATA_TEXT.platform}>
            <Dropdown
              value={PLATFORM_LABEL[params.get('platform') as keyof typeof PLATFORM_LABEL] ?? all}
              selectedOptions={[params.get('platform') ?? '']}
              onOptionSelect={choose('platform')}
            >
              <Option value="">{all}</Option>
              {Object.entries(PLATFORM_LABEL).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
            </Dropdown>
          </Field>
        )}
        {filters.includes('chain') && (
          <Field label={DATA_TEXT.chain}>
            <RadioGroup layout="horizontal" value={chain ?? ''} onChange={(_, d) => setParams({ chain: d.value || null })}>
              <Radio value="" label={all} />
              {Object.entries(CHAIN_LABEL).map(([k, v]) => <Radio key={k} value={k} label={v} />)}
            </RadioGroup>
          </Field>
        )}
        {filters.includes('cinema_ids') && data && (
          <Field label={DATA_TEXT.cinemas}>
            <Dropdown
              className={s.wide}
              multiselect
              selectedOptions={params.getAll('cinema_ids')}
              value={data.cinemas.filter((c) => params.getAll('cinema_ids').includes(c.cinema_id)).map((c) => c.cinema_name).join(', ')}
              onOptionSelect={(_, o) => setParams({ cinema_ids: o.selectedOptions })}
            >
              {data.cinemas.map((c) => (
                <Option key={`${c.chain}:${c.cinema_id}`} value={c.cinema_id}>
                  {chain ? c.cinema_name : fill(DATA_TEXT.cinema_option, { chain: CHAIN_LABEL[c.chain as keyof typeof CHAIN_LABEL] ?? c.chain, cinema: c.cinema_name })}
                </Option>
              ))}
            </Dropdown>
          </Field>
        )}
        {filters.includes('format_bucket') && (
          <Field label={DATA_TEXT.format}>
            <Dropdown
              value={FORMAT_LABEL[params.get('format_bucket') as keyof typeof FORMAT_LABEL] ?? all}
              selectedOptions={[params.get('format_bucket') ?? '']}
              onOptionSelect={choose('format_bucket')}
            >
              <Option value="">{all}</Option>
              {FORMAT_BUCKETS.map((k) => <Option key={k} value={k}>{FORMAT_LABEL[k]}</Option>)}
            </Dropdown>
          </Field>
        )}
        {filters.includes('day_type') && (
          <Field label={DATA_TEXT.day_type}>
            <Dropdown
              value={DAY_TYPE_LABEL[params.get('day_type') as keyof typeof DAY_TYPE_LABEL] ?? all}
              selectedOptions={[params.get('day_type') ?? '']}
              onOptionSelect={choose('day_type')}
            >
              <Option value="">{all}</Option>
              {Object.entries(DAY_TYPE_LABEL).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
            </Dropdown>
          </Field>
        )}
        {filters.includes('category') && data && (
          <Field label={DATA_TEXT.category}>
            <Dropdown
              className={s.wide}
              value={params.get('category') ?? all}
              selectedOptions={[params.get('category') ?? '']}
              onOptionSelect={choose('category')}
            >
              <Option value="">{all}</Option>
              {data.categories.map((c) => <Option key={c} value={c}>{c}</Option>)}
            </Dropdown>
          </Field>
        )}
        {filters.includes('search') && (
          <Field label={DATA_TEXT.search} hint={DATA_TEXT.search_help}>
            {/* Como el text_input de Streamlit: la búsqueda se aplica con Enter o al salir del campo. */}
            <Input
              key={`${dataset}:${params.get('search') ?? ''}`}
              defaultValue={params.get('search') ?? ''}
              onBlur={(e) => setParams({ search: e.currentTarget.value.trim() || null })}
              onKeyDown={(e) => e.key === 'Enter' && setParams({ search: e.currentTarget.value.trim() || null })}
            />
          </Field>
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

      <Caption1 className={s.caption}>{DATASET_HELP[dataset]}</Caption1>

      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {!data && !error && <SkeletonTable rows={12} columns={6} />}
      {data && !data.rows.length && <MessageBar intent="info"><MessageBarBody>{DATA_TEXT.empty}</MessageBarBody></MessageBar>}
      {data && data.rows.length > 0 && (
        <>
          {data.truncated
            ? <MessageBar intent="warning"><MessageBarBody>{fill(DATA_TEXT.truncated, { n: data.max_rows.toLocaleString('en-US') })}</MessageBarBody></MessageBar>
            : <Caption1 className={s.caption}>{fill(DATA_TEXT.rows, { n: data.rows.length.toLocaleString('en-US') })}</Caption1>}
          <div className={s.scroll}>
            <Table
              headers={headers}
              rows={data.rows.map((r) => columns.map((c) => cell(c, r[c], true)))}
              numCols={columns.flatMap((c, i) => (typeof data.rows[0][c] === 'number' ? [i] : []))}
            />
          </div>
          <Button onClick={download}>{DATA_TEXT.download}</Button>
        </>
      )}
    </>
  );
}
