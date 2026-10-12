'use client';

// Fijar una contraseña nueva desde el enlace del correo (`?token=`). Sirve para aceptar una invitación y para
// restablecer; el texto cambia según el propósito del enlace. Funciona con o sin sesión abierta.
import * as React from 'react';
import { Button, Field, Input, MessageBar, MessageBarBody } from '@fluentui/react-components';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessCard, AppLink } from '@/components/common';
import { useSession } from '@/lib/session';
import { ApiError, LOGIN_PATH, api, type TokenInfo } from '@/lib/api';
import { fill } from '@/lib/format';
import { AUTH_TEXT } from '@/lib/labels.generated';

function errorText(err: unknown): string {
  return (err instanceof ApiError && err.detail) || AUTH_TEXT.db_unavailable;
}

function Failure({ text }: { text: string }) {
  return <MessageBar intent="error"><MessageBarBody>{text}</MessageBarBody></MessageBar>;
}

export default function Page() {
  const router = useRouter();
  const { setUser } = useSession();
  const token = useSearchParams().get('token');
  // undefined mientras la API revisa el enlace; null si no sirve.
  const [info, setInfo] = React.useState<TokenInfo | null | undefined>(token ? undefined : null);
  const [tokenError, setTokenError] = React.useState(AUTH_TEXT.token_missing as string);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    api<TokenInfo>(`/restablecer?token=${encodeURIComponent(token)}`).then(setInfo, (err) => {
      setTokenError(errorText(err));
      setInfo(null);
    });
  }, [token]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password'));
    if (password !== form.get('password_confirm')) {
      setError(AUTH_TEXT.password_mismatch);
      return;
    }
    try {
      await api('/restablecer', { token, password });
    } catch (err) {
      setError(errorText(err));
      return;
    }
    setSaved(true);
    // La API cierra todas las sesiones de la cuenta y borra la cookie.
    setUser(null);
    router.replace('/restablecer/');
  };

  if (saved) {
    return (
      <AccessCard>
        <MessageBar intent="success"><MessageBarBody>{AUTH_TEXT.reset_done}</MessageBarBody></MessageBar>
        <AppLink href={LOGIN_PATH}>{AUTH_TEXT.back_to_login}</AppLink>
      </AccessCard>
    );
  }
  if (info === undefined) return <AccessCard>{null}</AccessCard>;
  if (info === null) {
    return (
      <AccessCard>
        <Failure text={tokenError} />
        <AppLink href="/olvide/">{AUTH_TEXT.forgot_title}</AppLink>
      </AccessCard>
    );
  }
  return (
    <AccessCard
      title={info.purpose === 'invite' ? AUTH_TEXT.invite_title : AUTH_TEXT.reset_title}
      lead={fill(AUTH_TEXT.reset_lead, { email: info.email })}
    >
      <form onSubmit={submit}>
        <Field label={AUTH_TEXT.password} required>
          <Input name="password" type="password" autoComplete="new-password" />
        </Field>
        <Field label={AUTH_TEXT.password_confirm} required>
          <Input name="password_confirm" type="password" autoComplete="new-password" />
        </Field>
        {error && <Failure text={error} />}
        <Button type="submit" appearance="primary">{AUTH_TEXT.save_password}</Button>
      </form>
    </AccessCard>
  );
}
