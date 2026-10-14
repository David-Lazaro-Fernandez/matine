'use client';

// Uso del asistente de IA de la organización: tokens exactos y costo estimado por persona, día y modelo. Staff ve todas
// las organizaciones o una. Un modelo sin precio verificado dice "Sin precio" en vez de un costo inventado.
import * as React from 'react';
import { Caption1, MessageBar, MessageBarBody, Title3, makeStyles, tokens } from '@fluentui/react-components';
import { FilterMenu } from '@/components/filters';
import { PageHeader, Pregunta, Seccion, SkeletonSeccion, Table, useApi } from '@/components/common';
import { query } from '@/lib/api';
import { fill, n } from '@/lib/format';
import { AGENT_PROVIDER_LABEL, AGENT_USAGE, AUTH_TEXT } from '@/lib/labels.generated';
import { useSession } from '@/lib/session';

type Spend = { questions: number; errors: number; tokens: number; cost_usd: number | null; unpriced_tokens: number };
type Usage = {
  days: number; totals: Spend;
  people: (Spend & { name: string; email: string })[];
  by_day: (Spend & { day: string })[];
  models: (Spend & { provider: string | null; model: string | null })[];
  organizations?: (Spend & { org_id: number | null; name: string | null })[];
};
type OrgOption = { id: number; name: string };

const PERIODS = ['7', '30', '90'];

const useStyles = makeStyles({
  stack: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL, marginTop: tokens.spacingVerticalL },
  totals: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXXL },
  total: { display: 'flex', flexDirection: 'column' },
  note: { color: tokens.colorNeutralForeground3 },
});

// Dólares con los decimales que hagan falta para que una pregunta barata no se vea como cero.
function usd(v: number): string {
  return `US$${n(v, v < 0.01 ? 4 : 2)}`;
}

function cost(spend: Spend): string {
  if (spend.cost_usd === null) return AGENT_USAGE.no_price;
  const base = usd(spend.cost_usd);
  return spend.unpriced_tokens > 0 ? `${base} + ${fill(AGENT_USAGE.unpriced, { tokens: n(spend.unpriced_tokens) })}` : base;
}

const COLUMNS = [AGENT_USAGE.questions, AGENT_USAGE.tokens, AGENT_USAGE.cost];
const figures = (s: Spend) => [n(s.questions), n(s.tokens), cost(s)];

export default function Page() {
  const s = useStyles();
  const { user } = useSession();
  const [days, setDays] = React.useState('30');
  const [org, setOrg] = React.useState('');
  const [orgs, setOrgs] = React.useState<OrgOption[]>([]);
  const isStaff = user?.role === 'staff';
  const stats = useApi<Usage>(`/agente/uso${query({ days, org_id: org })}`);
  const options = useApi<OrgOption[]>(isStaff ? '/agente/proveedores' : null);
  React.useEffect(() => { if (options.data) setOrgs(options.data); }, [options.data]);

  const usage = stats.data;
  return (
    <>
      <PageHeader title={AGENT_USAGE.title}>
        <FilterMenu label={AGENT_USAGE.period} value={days}
                    options={PERIODS.map((d): [string, string] => [d, fill(AGENT_USAGE.period_days, { days: d })])}
                    onChange={setDays} />
        {isStaff && (
          <FilterMenu label={AGENT_USAGE.organization} value={org}
                      options={[['', AGENT_USAGE.all_organizations], ...orgs.map((o): [string, string] => [String(o.id), o.name])]}
                      onChange={setOrg} />
        )}
      </PageHeader>
      {stats.error && <MessageBar intent="error"><MessageBarBody>{AUTH_TEXT.db_unavailable}</MessageBarBody></MessageBar>}
      {!usage && !stats.error && <div className={s.stack}><SkeletonSeccion table /></div>}
      {usage && (
        <div className={s.stack}>
          <div className={s.totals}>
            {[[AGENT_USAGE.questions, n(usage.totals.questions)], [AGENT_USAGE.tokens, n(usage.totals.tokens)],
              [AGENT_USAGE.cost, usage.totals.cost_usd === null ? AGENT_USAGE.no_price : usd(usage.totals.cost_usd)],
              [AGENT_USAGE.errors, n(usage.totals.errors)]].map(([label, value]) => (
              <div key={label} className={s.total}>
                <Title3 as="p">{value}</Title3>
                <Caption1>{label}</Caption1>
                {label === AGENT_USAGE.cost && usage.totals.cost_usd !== null && usage.totals.unpriced_tokens > 0 && (
                  <Caption1 className={s.note}>{fill(AGENT_USAGE.unpriced, { tokens: n(usage.totals.unpriced_tokens) })}</Caption1>
                )}
              </div>
            ))}
          </div>
          <Caption1 className={s.note}>{AGENT_USAGE.estimate_note}</Caption1>
          {usage.totals.questions === 0 && <Caption1>{AGENT_USAGE.empty}</Caption1>}
          {usage.organizations && usage.organizations.length > 0 && (
            <Seccion slug="organizaciones">
              <Pregunta texto={AGENT_USAGE.by_organization} />
              <Table headers={[AGENT_USAGE.organization, ...COLUMNS]} numCols={[1, 2, 3]} wideCols={[0]}
                     rows={usage.organizations.map((o) => [o.name ?? AGENT_USAGE.unregistered, ...figures(o)])} />
            </Seccion>
          )}
          {usage.people.length > 0 && (
            <Seccion slug="personas">
              <Pregunta texto={AGENT_USAGE.by_person} />
              <Table headers={[AGENT_USAGE.person, ...COLUMNS]} numCols={[1, 2, 3]} wideCols={[0]}
                     rows={usage.people.map((p) => [`${p.name} (${p.email})`, ...figures(p)])} />
            </Seccion>
          )}
          {usage.by_day.length > 0 && (
            <Seccion slug="dias">
              <Pregunta texto={AGENT_USAGE.by_day} />
              <Table headers={[AGENT_USAGE.day, ...COLUMNS]} numCols={[1, 2, 3]} wideCols={[0]}
                     rows={usage.by_day.map((d) => [d.day, ...figures(d)])} />
            </Seccion>
          )}
          {usage.models.length > 0 && (
            <Seccion slug="modelos">
              <Pregunta texto={AGENT_USAGE.by_model} />
              <Table headers={[AGENT_USAGE.provider, AGENT_USAGE.model, ...COLUMNS]} numCols={[2, 3, 4]}
                     rows={usage.models.map((m) => [
                       AGENT_PROVIDER_LABEL[m.provider as keyof typeof AGENT_PROVIDER_LABEL] ?? m.provider ?? AGENT_USAGE.unregistered,
                       m.model ?? AGENT_USAGE.unregistered, ...figures(m)])} />
            </Seccion>
          )}
        </div>
      )}
    </>
  );
}
