'use client';

// Proveedor de IA y clave de cada organización (solo staff). La API nunca devuelve la clave, solo si hay una.
import * as React from 'react';
import { Badge, Button, Dropdown, Field, Input, MessageBar, MessageBarBody, Option, makeStyles, tokens } from '@fluentui/react-components';
import { PageHeader, Seccion, SkeletonSeccion } from '@/components/common';
import { StatusBar, useAction } from '@/components/configuracion/comunes';
import { api } from '@/lib/api';
import { AGENT_PROVIDER_LABEL, AGENT_UI, AUTH_TEXT } from '@/lib/labels.generated';

type OrgProvider = { id: number; name: string; provider: string | null };

type Provider = keyof typeof AGENT_PROVIDER_LABEL;
const PROVIDERS = Object.keys(AGENT_PROVIDER_LABEL) as Provider[];
// Proveedores sin clave que pegar: usan la del entorno del servidor o el rol de AWS.
const KEYLESS: Provider[] = ['bedrock', 'deepseek-dev'];

// Provisional: los logos viven en `public/` y deben pasar a imágenes en S3 (DESIGN.md, selector de proveedor de IA).
function ProviderName({ provider }: { provider: Provider }) {
  const s = useStyles();
  return (
    <span className={s.provider}>
      <img className={s.logo} src={`/${provider.replace('-dev', '')}.webp`} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      {AGENT_PROVIDER_LABEL[provider]}
    </span>
  );
}

const useStyles = makeStyles({
  list: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXL, marginTop: tokens.spacingVerticalL, maxWidth: '640px' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacingHorizontalM },
  stack: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  provider: { display: 'inline-flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  logo: { width: '20px', height: '20px', objectFit: 'contain' },
  actions: { display: 'flex', gap: tokens.spacingHorizontalS },
});

function OrgSection({ org, onSaved }: { org: OrgProvider; onSaved: (provider: string | null) => void }) {
  const s = useStyles();
  const { busy, status, run } = useAction(AUTH_TEXT.saved);
  const [provider, setProvider] = React.useState<Provider>((org.provider as Provider | null) ?? PROVIDERS[0]);
  const [key, setKey] = React.useState('');
  const needsKey = !KEYLESS.includes(provider);
  const save = () => run(async () => {
    await api(`/agente/proveedores/${org.id}`, { provider, api_key: needsKey ? key.trim() : undefined }, 'PUT');
    setKey('');
    onSaved(provider);
  });
  const remove = () => run(async () => {
    await api(`/agente/proveedores/${org.id}`, {}, 'PUT');
    setKey('');
    onSaved(null);
  });
  return (
    <Seccion slug={`org-${org.id}`}>
      <div className={s.stack}>
        <div className={s.head}>
          <strong>{org.name}</strong>
          <Badge appearance="tint" color={org.provider ? 'success' : 'informative'}>
            {org.provider ? AGENT_UI.keys_configured : AGENT_UI.keys_missing}
          </Badge>
        </div>
        <Field label={AGENT_UI.keys_provider}>
          <Dropdown
            value={AGENT_PROVIDER_LABEL[provider]}
            selectedOptions={[provider]}
            button={{ children: <ProviderName provider={provider} /> }}
            onOptionSelect={(_, d) => setProvider(d.optionValue as Provider)}
          >
            {PROVIDERS.map((p) => <Option key={p} value={p} text={AGENT_PROVIDER_LABEL[p]}><ProviderName provider={p} /></Option>)}
          </Dropdown>
        </Field>
        {needsKey && (
          <Field label={AGENT_UI.keys_key} hint={AGENT_UI.keys_key_hint}>
            <Input type="password" autoComplete="off" value={key} onChange={(_, d) => setKey(d.value)} />
          </Field>
        )}
        <div className={s.actions}>
          <Button appearance="primary" disabled={busy || (needsKey && !key.trim())} onClick={save}>
            {org.provider ? AGENT_UI.keys_replace : AUTH_TEXT.save}
          </Button>
          {org.provider && <Button disabled={busy} onClick={remove}>{AGENT_UI.keys_remove}</Button>}
        </div>
        <StatusBar status={status} />
      </div>
    </Seccion>
  );
}

export default function Page() {
  const s = useStyles();
  const [orgs, setOrgs] = React.useState<OrgProvider[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    api<OrgProvider[]>('/agente/proveedores').then(setOrgs, () => setFailed(true));
  }, []);
  const saved = (id: number) => (provider: string | null) =>
    setOrgs((all) => all && all.map((o) => (o.id === id ? { ...o, provider } : o)));
  return (
    <>
      <PageHeader title={AGENT_UI.keys_section} />
      {failed && <MessageBar intent="error"><MessageBarBody>{AUTH_TEXT.db_unavailable}</MessageBarBody></MessageBar>}
      {!orgs && !failed && <div className={s.list}><SkeletonSeccion /></div>}
      {orgs && (
        <div className={s.list}>
          {orgs.map((o) => <OrgSection key={o.id} org={o} onSaved={saved(o.id)} />)}
        </div>
      )}
    </>
  );
}
