'use client';

// Operaciones (solo admin): el estado de la plataforma para quien la opera, sobre `GET /api/operaciones`.
// Es la única página que muestra nombres internos (tablas, logs, módulos) tal cual. Es de lectura: nada escribe.
import * as React from 'react';
import {
  Field,
  MessageBar,
  MessageBarBody,
  SpinButton,
  Subtitle1,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { DocumentText20Regular } from '@fluentui/react-icons';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Leyenda,
  PageHeader,
  Seccion,
  Table,
  type Cell,
  SkeletonSeccion,
} from '@/components/common';
import { FilterMenu } from '@/components/filters';
import { RunsChart, type RecentRun } from '@/components/operaciones/runs-chart';
import { api, ApiError, query } from '@/lib/api';
import { PILOT_TIMEZONE, fill, n } from '@/lib/format';
import {
  CHAIN_COLOR,
  CHAIN_LABEL,
  COLUMN_LABEL,
  OPS_TEXT,
  PLAZA_LABEL,
  WARN,
} from '@/lib/labels.generated';

type Chain = keyof typeof CHAIN_LABEL;
type Row = Record<string, any>;
type ChainReport = Row;

type Operaciones = {
  hours: number;
  thresholds: { max_age_min: number; coverage_min_ratio: number };
  seats_plazas: string[];
  logs: Record<string, string>;
  report: { at: string; ok: boolean; problems: string[]; chains: Record<string, ChainReport> } | null;
  coverage: Row[] | null;
  runs: RecentRun[] | null;
  units: Row[] | null;
  jobs: Row[];
  deployment: { commit: string | null; commit_at: string | null; commit_subject: string | null;
    last_deploy: string | null; last_backup: string | null };
  storage: Record<string, number | string>;
  log: { lines: string[]; size_bytes: number; modified_at: string | null };
};

const DAYS_DEFAULT = 7;
const DAYS_MAX = 30;
const LINE_OPTIONS = ['20', '60', '200', '500'];
const LINES_DEFAULT = '60';
const LOG_DEFAULT = 'run';
const COVERAGE_MAX_HEIGHT = '500px';

const useStyles = makeStyles({
  nota: { fontStyle: 'italic', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  titulo: { display: 'block', margin: `0 0 ${tokens.spacingVerticalXS}` },
  controles: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalL, margin: `0 0 ${tokens.spacingVerticalS}` },
  scroll: { maxHeight: COVERAGE_MAX_HEIGHT, overflowY: 'auto' },
  problemas: { margin: '4px 0 0', paddingLeft: '18px' },
  log: {
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
  },
  pendiente: {
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalXXL}`,
    marginTop: tokens.spacingVerticalL,
  },
  pendienteTitulo: { display: 'block', margin: `0 0 ${tokens.spacingVerticalXS}` },
  pendienteGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
    gap: tokens.spacingHorizontalL,
    marginTop: tokens.spacingVerticalM,
  },
  cuando: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, fontWeight: tokens.fontWeightSemibold },
  que: { fontWeight: tokens.fontWeightSemibold, margin: `${tokens.spacingVerticalXXS} 0 ${tokens.spacingVerticalXS}` },
  pendienteTexto: { margin: 0, fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 },
});

// 'dd/mm h:mm AM' en hora de la plaza, como `local_time` de ui/common.py. Una hora sin zona ya es local.
function localTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const naive = !/(Z|[+-]\d\d:?\d\d)$/.test(iso);
  const date = new Date(naive ? `${iso.slice(0, 19)}Z` : iso);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: naive ? 'UTC' : PILOT_TIMEZONE,
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true,
  }).formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.day}/${parts.month} ${parts.hour}:${parts.minute} ${parts.dayPeriod}`.replace(/^0/, '');
}

function when(iso: string | null | undefined): string {
  return localTime(iso) ?? '—';
}

// Tamaño legible en unidades binarias, como `size_h` de ui/common.py: '85.0 MB'.
function sizeH(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  let v = bytes;
  for (const unit of ['B', 'kB', 'MB', 'GB', 'TB']) {
    if (v < 1024 || unit === 'TB') return `${n(v, unit === 'B' ? 0 : 1)} ${unit}`;
    v /= 1024;
  }
  return '—';
}

function ageText(minutes: number | null | undefined): string {
  if (minutes == null) return OPS_TEXT.never;
  return minutes >= 120 ? fill(OPS_TEXT.ago_h, { hours: n(minutes / 60, 1) }) : fill(OPS_TEXT.ago, { minutes: n(minutes) });
}

function okCell(ok: boolean | number | null): Cell {
  return ok ? OPS_TEXT.ok : [OPS_TEXT.failed, 'mal'];
}

function chainLabel(chain: string): string {
  return CHAIN_LABEL[chain as Chain] ?? chain;
}

function useParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  return { params, set };
}

function Encabezado({ titulo, lead }: { titulo: string; lead: string }) {
  const s = useStyles();
  return (
    <>
      <Subtitle2 as="h3" className={s.titulo}>{titulo}</Subtitle2>
      <p className={s.nota}>{lead}</p>
    </>
  );
}

function Days({ label, param, value, onChange }: {
  label: string; param: string; value: number; onChange: (param: string, value: string) => void;
}) {
  return (
    <Field label={label}>
      <SpinButton
        min={1}
        max={DAYS_MAX}
        value={value}
        onChange={(_, data) => {
          const v = data.value ?? Number(data.displayValue);
          if (Number.isInteger(v) && v >= 1 && v <= DAYS_MAX) onChange(param, String(v));
        }}
      />
    </Field>
  );
}

function intParam(params: URLSearchParams, key: string): number {
  const v = Number(params.get(key));
  return Number.isInteger(v) && v >= 1 && v <= DAYS_MAX ? v : DAYS_DEFAULT;
}

function capturaRows(report: NonNullable<Operaciones['report']>, chains: Chain[], t: Operaciones['thresholds']): Cell[][] {
  const fila = (label: string, value: (c: ChainReport) => string, mal?: (c: ChainReport) => boolean): Cell[] =>
    [label, ...chains.map((chain): Cell => {
      const c = report.chains[chain];
      return mal?.(c) ? [value(c), 'mal'] : value(c);
    })];
  const lowCoverage = (c: ChainReport) =>
    Boolean(c.peak_cinemas_7d) && (c.last_cinemas ?? 0) < t.coverage_min_ratio * c.peak_cinemas_7d;
  return [
    fila(OPS_TEXT.last_at, (c) => when(c.last_at)),
    fila(OPS_TEXT.last_age, (c) => ageText(c.last_age_min), (c) => c.last_age_min > t.max_age_min),
    fila(OPS_TEXT.last_result, (c) => (c.last_ok ? OPS_TEXT.ok : OPS_TEXT.failed), (c) => !c.last_ok),
    fila(OPS_TEXT.last_shows, (c) => n(c.last_shows)),
    fila(OPS_TEXT.last_cinemas,
      (c) => (c.peak_cinemas_7d ? `${n(c.last_cinemas)} (${n(c.peak_cinemas_7d)})` : n(c.last_cinemas)), lowCoverage),
    fila(OPS_TEXT.captures, (c) => n(c.snapshots)),
    fila(OPS_TEXT.expected, (c) => n(c.expected)),
    fila(OPS_TEXT.missing, (c) => (c.missing.length ? c.missing.join(', ') : OPS_TEXT.none), (c) => c.missing.length > 0),
    fila(OPS_TEXT.failed_runs, (c) => n(c.failed), (c) => c.failed > 0),
    fila(OPS_TEXT.occ_t60, (c) => n(c.occupancy_t60)),
    fila(OPS_TEXT.occ_post, (c) => n(c.occupancy_post_start)),
    fila(OPS_TEXT.prices_7d, (c) => n(c.prices_7d)),
    fila(OPS_TEXT.concessions_8d, (c) => n(c.concession_cinemas_8d)),
    fila(OPS_TEXT.delivery_8d, (c) => n(c.delivery_stores_8d)),
    fila(OPS_TEXT.calibration,
      (c) => (c.calibration ? Object.entries(c.calibration).map(([k, v]) => `${k}: ${v}`).join(', ') : '—')),
  ];
}

const cols = (keys: string[]) => keys.map((k) => COLUMN_LABEL[k as keyof typeof COLUMN_LABEL] ?? k);

export default function Page() {
  const s = useStyles();
  const { params, set } = useParams();
  const jobDays = intParam(params, 'job_days');
  const runDays = intParam(params, 'run_days');
  const unitDays = intParam(params, 'unit_days');
  const [data, setData] = React.useState<Operaciones | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const log = params.get('log') ?? LOG_DEFAULT;
  const lines = LINE_OPTIONS.includes(params.get('lines') ?? '') ? params.get('lines')! : LINES_DEFAULT;

  React.useEffect(() => {
    api<Operaciones>(`/operaciones${query({ job_days: jobDays, run_days: runDays, unit_days: unitDays, log, lines })}`)
      .then((d) => { setData(d); setError(null); },
        (e) => setError(e instanceof ApiError && e.detail ? e.detail : String(e)));
  }, [jobDays, runDays, unitDays, log, lines]);

  const header = (
    <>
      <PageHeader title={OPS_TEXT.title} />
    </>
  );
  if (!data) {
    return (
      <>
        {header}
        {error ? <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>
          : [0, 1, 2, 3].map((i) => <SkeletonSeccion key={i} table />)}
      </>
    );
  }

  const { report, hours, deployment: dep, storage: sto, log: tail } = data;
  const chains = report ? (Object.keys(CHAIN_LABEL) as Chain[]).filter((c) => report.chains[c] && Object.keys(report.chains[c]).length) : [];
  const runChains = (Object.keys(CHAIN_LABEL) as Chain[]).filter((c) => data.runs?.some((r) => r.chain === c));
  const commit = dep.commit ? `${dep.commit} · ${when(dep.commit_at)} · ${dep.commit_subject}` : OPS_TEXT.no_git;
  const jobCols = ['key', 'area', 'schedule', 'last_started_at', 'last_status', 'last_duration_s', 'last_max_rss_mb',
    'runs', 'failures', 'peak_rss_mb', 'timeout_min'];
  const covCols = ['chain', 'plaza', 'city_id', 'state_id', 'sample_cinema', 'cinemas', 'shows'];
  const runCols = ['taken_at', 'chain', 'ok', 'n_shows', 'n_cinemas', 'n_events', 'calls', 'duration_s', 'error'];
  const unitCols = ['chain', 'label', 'unit', 'last_at', 'last_ok', 'last_error', 'runs', 'failures', 'avg_shows',
    'avg_calls', 'avg_duration_s'];

  return (
    <>
      {header}
      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}

      {!report ? (
        <MessageBar intent="warning"><MessageBarBody>{OPS_TEXT.no_snapshots}</MessageBarBody></MessageBar>
      ) : (
        <>
          {report.ok ? (
            <MessageBar intent="success"><MessageBarBody>{fill(OPS_TEXT.all_ok, { hours })}</MessageBarBody></MessageBar>
          ) : (
            <MessageBar intent="warning" layout="multiline">
              <MessageBarBody>
                {fill(OPS_TEXT.problems, { n: report.problems.length, hours })}
                <ul className={s.problemas}>{report.problems.map((p) => <li key={p}>{p}</li>)}</ul>
              </MessageBarBody>
            </MessageBar>
          )}
          <p className={s.nota}>
            {OPS_TEXT.checked_at}: {when(report.at)} · {OPS_TEXT.window}: {fill(OPS_TEXT.hours, { n: hours })}
          </p>

          <Seccion slug="captura">
            <Encabezado titulo={OPS_TEXT.capture} lead={OPS_TEXT.capture_lead} />
            <Table headers={[OPS_TEXT.signal, ...chains.map((c) => CHAIN_LABEL[c])]}
                   rows={capturaRows(report, chains, data.thresholds)} />
          </Seccion>
        </>
      )}

      <Seccion slug="trabajos">
        <Encabezado titulo={OPS_TEXT.jobs} lead={OPS_TEXT.jobs_lead} />
        <div className={s.controles}>
          <Days label={OPS_TEXT.jobs_days} param="job_days" value={jobDays} onChange={set} />
        </div>
        <Table
          headers={cols(jobCols)}
          numCols={[5, 6, 7, 8, 9, 10]}
          rows={data.jobs.map((j): Cell[] => [
            j.key,
            j.area,
            j.enabled ? j.schedule : `${j.schedule} · ${OPS_TEXT.jobs_off}`,
            when(j.last_started_at),
            OPS_TEXT.jobs_status[j.last_status as keyof typeof OPS_TEXT.jobs_status] ?? '—',
            n(j.last_duration_s),
            n(j.last_max_rss_mb),
            n(j.runs),
            n(j.failures),
            n(j.peak_rss_mb),
            n(j.timeout_min),
          ])}
        />
      </Seccion>

      {report && (
        <Seccion slug="cobertura">
          <Encabezado titulo={OPS_TEXT.coverage} lead={OPS_TEXT.coverage_lead} />
          <p className={s.nota}>
            {fill(OPS_TEXT.coverage_seats, {
              plazas: data.seats_plazas.map((p) => PLAZA_LABEL[p as keyof typeof PLAZA_LABEL] ?? p).join(', '),
            })}
          </p>
          {data.coverage && data.coverage.length > 0 && (
            <div className={s.scroll}>
              <Table
                headers={cols(covCols)}
                numCols={[5, 6]}
                rows={data.coverage.map((r): Cell[] => [
                  chainLabel(r.chain),
                  r.plaza ? PLAZA_LABEL[r.plaza as keyof typeof PLAZA_LABEL] ?? r.plaza : OPS_TEXT.coverage_no_plaza,
                  r.city_id ?? '—',
                  r.state_id ?? '—',
                  r.sample_cinema ?? '—',
                  n(r.cinemas),
                  n(r.shows),
                ])}
              />
            </div>
          )}
        </Seccion>
      )}

      {report && (
        <Seccion slug="corridas">
          <Encabezado titulo={OPS_TEXT.runs} lead={OPS_TEXT.runs_lead} />
          <div className={s.controles}>
            <Days label={OPS_TEXT.runs_days} param="run_days" value={runDays} onChange={set} />
          </div>
          {!data.runs?.length ? (
            <MessageBar intent="info"><MessageBarBody>{OPS_TEXT.runs_empty}</MessageBarBody></MessageBar>
          ) : (
            <>
              <Leyenda items={[...runChains.map((c) => [CHAIN_LABEL[c], CHAIN_COLOR[c]] as const),
                [OPS_TEXT.runs_failed_legend, WARN] as const]} />
              <RunsChart runs={data.runs} />
              <Table
                headers={cols(runCols)}
                numCols={[3, 4, 5, 6, 7]}
                rows={data.runs.map((r): Cell[] => [
                  when(r.taken_at),
                  chainLabel(r.chain),
                  okCell(r.ok),
                  n(r.n_shows),
                  n(r.n_cinemas),
                  n(r.n_events),
                  n(r.calls),
                  n(r.duration_s),
                  r.error ?? '',
                ])}
              />
            </>
          )}
        </Seccion>
      )}

      {report && (
        <Seccion slug="unidades">
          <Encabezado titulo={OPS_TEXT.units} lead={OPS_TEXT.units_lead} />
          <div className={s.controles}>
            <Days label={OPS_TEXT.runs_days} param="unit_days" value={unitDays} onChange={set} />
          </div>
          {!data.units?.length ? (
            <MessageBar intent="info"><MessageBarBody>{OPS_TEXT.units_empty}</MessageBarBody></MessageBar>
          ) : (
            <Table
              headers={cols(unitCols)}
              numCols={[6, 7, 8, 9, 10]}
              rows={data.units.map((u): Cell[] => [
                chainLabel(u.chain),
                u.label ?? '',
                u.unit ?? '',
                when(u.last_at),
                okCell(u.last_ok),
                u.last_error ?? '',
                n(u.runs),
                n(u.failures),
                n(u.avg_shows),
                n(u.avg_calls, 1),
                n(u.avg_duration_s),
              ])}
            />
          )}
        </Seccion>
      )}

      <Seccion slug="servidor">
        <Encabezado titulo={OPS_TEXT.server} lead={OPS_TEXT.server_lead} />
        <Table headers={['', '']} rows={[
          [OPS_TEXT.commit, commit],
          [OPS_TEXT.last_deploy, dep.last_deploy ?? OPS_TEXT.no_line],
          [OPS_TEXT.last_backup, dep.last_backup ?? OPS_TEXT.no_line],
          [OPS_TEXT.db_file, sizeH(sto.db_bytes as number)],
          [OPS_TEXT.wal_file, sizeH(sto.wal_bytes as number)],
          [OPS_TEXT.app_db_file, sizeH(sto.app_db_bytes as number)],
          [OPS_TEXT.raw_dir, sizeH(sto.raw_bytes as number)],
          [OPS_TEXT.backups_dir, sizeH(sto.backups_bytes as number)],
          [OPS_TEXT.disk_free, fill(OPS_TEXT.disk_free_value, {
            free: sizeH(sto.disk_free_bytes as number), total: sizeH(sto.disk_total_bytes as number), dir: sto.data_dir,
          })],
        ]} />
      </Seccion>

      <Seccion slug="logs">
        <Encabezado titulo={OPS_TEXT.logs} lead={OPS_TEXT.logs_lead} />
        <div className={s.controles}>
          <FilterMenu label={OPS_TEXT.log} icon={<DocumentText20Regular />} value={log}
                      options={Object.entries(data.logs)} onChange={(value) => set('log', value)} />
          <FilterMenu label={OPS_TEXT.lines} value={lines} short={`${OPS_TEXT.lines}: ${lines}`}
                      options={LINE_OPTIONS.map((v) => [v, v])} onChange={(value) => set('lines', value)} />
        </div>
        {!tail.lines.length ? (
          <MessageBar intent="info"><MessageBarBody>{OPS_TEXT.log_empty}</MessageBarBody></MessageBar>
        ) : (
          <>
            <p className={s.nota}>{fill(OPS_TEXT.log_meta, { size: sizeH(tail.size_bytes), when: when(tail.modified_at) })}</p>
            <pre className={s.log}>{tail.lines.join('\n')}</pre>
          </>
        )}
      </Seccion>

      <div className={s.pendiente}>
        <Subtitle1 as="h3" className={s.pendienteTitulo}>{OPS_TEXT.pending}</Subtitle1>
        <p className={s.pendienteTexto}>{OPS_TEXT.pending_lead}</p>
        <div className={s.pendienteGrid}>
          {OPS_TEXT.pending_items.map(([cuando, que, texto]) => (
            <div key={que}>
              <div className={s.cuando}>{cuando}</div>
              <div className={s.que}>{que}</div>
              <p className={s.pendienteTexto}>{texto}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
