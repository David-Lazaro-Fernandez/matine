'use client';

// Entrar con correo y contraseña. La API pone la cookie; el cascarón manda a la cartelera al tener usuario.
import * as React from 'react';
import { Button, Field, Input, MessageBar, MessageBarBody } from '@fluentui/react-components';
import { AccessCard, AppLink } from '@/components/common';
import { useSession } from '@/components/shell';
import { ApiError, api, type Me } from '@/lib/api';
import { AUTH_TEXT } from '@/lib/labels.generated';

export default function Page() {
  const { setUser } = useSession();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      setUser(await api<Me>('/login', { email: form.get('email'), password: form.get('password') }));
    } catch (err) {
      setError((err instanceof ApiError && err.detail) || AUTH_TEXT.db_unavailable);
      setBusy(false);
    }
  };

  return (
    <AccessCard lead={AUTH_TEXT.login_lead}>
      <form onSubmit={submit}>
        <Field label={AUTH_TEXT.email} required>
          <Input name="email" type="email" autoComplete="email" />
        </Field>
        <Field label={AUTH_TEXT.password} required>
          <Input name="password" type="password" autoComplete="current-password" />
        </Field>
        {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
        <Button type="submit" appearance="primary" disabled={busy}>{AUTH_TEXT.enter}</Button>
      </form>
      <AppLink href="/olvide/">{AUTH_TEXT.forgot}</AppLink>
    </AccessCard>
  );
}
