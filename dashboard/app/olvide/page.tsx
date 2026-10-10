'use client';

// Olvidé mi contraseña: pide el correo y manda el enlace. La API responde lo mismo exista o no la cuenta.
import * as React from 'react';
import { Button, Field, Input, MessageBar, MessageBarBody } from '@fluentui/react-components';
import { AccessCard, AppLink } from '@/components/common';
import { ApiError, LOGIN_PATH, api } from '@/lib/api';
import { AUTH_TEXT } from '@/lib/labels.generated';

export default function Page() {
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email')).trim();
    if (!email) return;
    try {
      await api('/olvide', { email });
      setSent(true);
    } catch (err) {
      setError((err instanceof ApiError && err.detail) || AUTH_TEXT.db_unavailable);
    }
  };

  return (
    <AccessCard title={AUTH_TEXT.forgot_title} lead={AUTH_TEXT.forgot_lead}>
      {sent ? (
        <MessageBar intent="success"><MessageBarBody>{AUTH_TEXT.forgot_done}</MessageBarBody></MessageBar>
      ) : (
        <form onSubmit={submit}>
          <Field label={AUTH_TEXT.email} required>
            <Input name="email" type="email" autoComplete="email" />
          </Field>
          {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
          <Button type="submit" appearance="primary">{AUTH_TEXT.send_link}</Button>
        </form>
      )}
      <AppLink href={LOGIN_PATH}>{AUTH_TEXT.back_to_login}</AppLink>
    </AccessCard>
  );
}
