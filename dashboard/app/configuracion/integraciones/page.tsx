'use client';

// Integraciones del espacio de trabajo (solo admin): el webhook de Slack para las alertas y los correos que reciben el
// resumen semanal. La API nunca devuelve el webhook, solo si hay uno.
import * as React from 'react';
import { Badge, Button, Field, Input, MessageBar, MessageBarBody, makeStyles, tokens } from '@fluentui/react-components';
import { PageHeader, Pregunta, Seccion, SkeletonSeccion } from '@/components/common';
import { StatusBar, useAction } from '@/components/configuracion/comunes';
import { api } from '@/lib/api';
import { AUTH_TEXT } from '@/lib/labels.generated';

type Integrations = { slack_connected: boolean; digest_recipients: string[] };

const useStyles = makeStyles({
  columns: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: tokens.spacingHorizontalXXL,
    marginTop: tokens.spacingVerticalL,
    '@media (max-width: 768px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
  stack: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  actions: { display: 'flex', gap: tokens.spacingHorizontalS },
});

function SlackSection({ state, onSaved }: { state: Integrations; onSaved: (state: Integrations) => void }) {
  const s = useStyles();
  const { busy, status, run } = useAction(AUTH_TEXT.saved);
  const [webhook, setWebhook] = React.useState('');
  const save = (value: string) => run(async () => {
    onSaved(await api<Integrations>('/integraciones', { slack_webhook: value }));
    setWebhook('');
  });
  return (
    <Seccion slug="slack">
      <Pregunta texto={AUTH_TEXT.slack} conclusion={AUTH_TEXT.slack_help} />
      <div className={s.stack}>
        {state.slack_connected && <div><Badge appearance="tint" color="success">{AUTH_TEXT.slack_connected}</Badge></div>}
        <Field label={AUTH_TEXT.slack_webhook}>
          <Input type="password" autoComplete="off" value={webhook} onChange={(_, d) => setWebhook(d.value)} />
        </Field>
        <div className={s.actions}>
          <Button appearance="primary" disabled={busy || !webhook.trim()} onClick={() => save(webhook.trim())}>{AUTH_TEXT.save}</Button>
          {state.slack_connected && <Button disabled={busy} onClick={() => save('')}>{AUTH_TEXT.slack_disconnect}</Button>}
        </div>
        <StatusBar status={status} />
      </div>
    </Seccion>
  );
}

function DigestSection({ state, onSaved }: { state: Integrations; onSaved: (state: Integrations) => void }) {
  const s = useStyles();
  const { busy, status, run } = useAction(AUTH_TEXT.saved);
  const saved = state.digest_recipients.join(', ');
  const [text, setText] = React.useState(saved);
  const recipients = text.split(',').map((e) => e.trim()).filter(Boolean);
  const save = () => run(async () => onSaved(await api<Integrations>('/integraciones', { digest_recipients: recipients })));
  return (
    <Seccion slug="resumen">
      <Pregunta texto={AUTH_TEXT.digest} />
      <div className={s.stack}>
        <Field label={AUTH_TEXT.digest_recipients} hint={AUTH_TEXT.digest_hint}>
          <Input type="text" autoComplete="off" value={text} onChange={(_, d) => setText(d.value)} />
        </Field>
        <div className={s.actions}>
          <Button appearance="primary" disabled={busy || recipients.join(', ') === saved} onClick={save}>{AUTH_TEXT.save}</Button>
        </div>
        <StatusBar status={status} />
      </div>
    </Seccion>
  );
}

export default function Page() {
  const s = useStyles();
  const [state, setState] = React.useState<Integrations | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    api<Integrations>('/integraciones').then(setState, () => setFailed(true));
  }, []);
  return (
    <>
      <PageHeader title={AUTH_TEXT.integrations} />
      {failed && <MessageBar intent="error"><MessageBarBody>{AUTH_TEXT.db_unavailable}</MessageBarBody></MessageBar>}
      {!state && !failed && <div className={s.columns}><SkeletonSeccion /><SkeletonSeccion /></div>}
      {state && (
        <div className={s.columns}>
          <SlackSection state={state} onSaved={setState} />
          <DigestSection state={state} onSaved={setState} />
        </div>
      )}
    </>
  );
}
