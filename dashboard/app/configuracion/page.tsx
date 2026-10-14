'use client';

// Configuración de la propia cuenta: perfil, tema, correo y contraseña.
import * as React from 'react';
import {
  Avatar,
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { PageHeader, Pregunta, Seccion } from '@/components/common';
import { ImagePicker, StatusBar, useAction } from '@/components/configuracion/comunes';
import { useSession } from '@/lib/session';
import { useSetTheme, type ThemeChoice } from '@/app/providers';
import { api, type Profile } from '@/lib/api';
import { AUTH_TEXT, ROLE_HELP, ROLE_LABEL, THEME_LABEL } from '@/lib/labels.generated';

const THEMES = Object.keys(THEME_LABEL) as ThemeChoice[];

const useStyles = makeStyles({
  columns: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: tokens.spacingHorizontalXXL,
    marginTop: tokens.spacingVerticalL,
    '@media (max-width: 768px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
  stack: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  imageRow: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: tokens.spacingHorizontalM },
});

function ProfileSection({ user, save }: { user: Profile; save: (change: Partial<Profile>) => Promise<void> }) {
  const s = useStyles();
  const [name, setName] = React.useState(user.name);
  const [avatar, setAvatar] = React.useState(user.avatar);
  const { busy, status, run } = useAction(AUTH_TEXT.saved);
  const changed = name.trim() !== user.name || avatar !== user.avatar;
  return (
    <Seccion slug="perfil">
      <Pregunta texto={AUTH_TEXT.profile} />
      <form className={s.stack} onSubmit={(e) => { e.preventDefault(); run(() => save({ name, avatar })); }}>
        <Field label={AUTH_TEXT.avatar}>
          <div className={s.imageRow}>
            <Avatar name={name} image={avatar ? { src: avatar } : undefined} size={64} />
            <ImagePicker disabled={busy} onPick={(url) => url && setAvatar(url)} />
            {avatar && <Button appearance="subtle" disabled={busy} onClick={() => setAvatar(null)}>{AUTH_TEXT.remove_image}</Button>}
          </div>
        </Field>
        <Field label={AUTH_TEXT.name} required>
          <Input value={name} onChange={(_, data) => setName(data.value)} />
        </Field>
        <Field label={AUTH_TEXT.role} hint={ROLE_HELP[user.role]}>
          <Text>{ROLE_LABEL[user.role]}</Text>
        </Field>
        <div>
          <Button type="submit" appearance="primary" disabled={busy || !changed || !name.trim()}>{AUTH_TEXT.save}</Button>
        </div>
        <StatusBar status={status} />
      </form>
    </Seccion>
  );
}

function ThemeSection({ user, save }: { user: Profile; save: (change: Partial<Profile>) => Promise<void> }) {
  const { busy, status, run } = useAction(AUTH_TEXT.saved);
  return (
    <Seccion slug="tema">
      <Pregunta texto={AUTH_TEXT.theme} />
      <RadioGroup
        value={user.theme}
        disabled={busy}
        onChange={(_, data) => run(() => save({ theme: data.value as ThemeChoice }))}
      >
        {THEMES.map((t) => <Radio key={t} value={t} label={THEME_LABEL[t]} />)}
      </RadioGroup>
      <StatusBar status={status?.error ? status : null} />
    </Seccion>
  );
}

function EmailSection({ user, onSaved }: { user: Profile; onSaved: (user: Profile) => void }) {
  const s = useStyles();
  const { busy, status, run } = useAction(AUTH_TEXT.saved);
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    run(async () => {
      onSaved(await api<Profile>('/perfil/correo', { email: data.get('email'), password: data.get('password') }));
      form.reset();
    });
  };
  return (
    <Seccion slug="correo">
      <Pregunta texto={AUTH_TEXT.change_email} />
      <form className={s.stack} onSubmit={submit}>
        <Field label={AUTH_TEXT.new_email} required>
          <Input name="email" type="email" autoComplete="email" placeholder={user.email} required />
        </Field>
        <Field label={AUTH_TEXT.current_password} required>
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <div>
          <Button type="submit" appearance="primary" disabled={busy}>{AUTH_TEXT.change_email}</Button>
        </div>
        <StatusBar status={status} />
      </form>
    </Seccion>
  );
}

function PasswordSection() {
  const s = useStyles();
  const { busy, status, run } = useAction(AUTH_TEXT.password_changed);
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    run(async () => {
      if (data.get('new') !== data.get('confirm')) throw new Error(AUTH_TEXT.password_mismatch);
      await api('/perfil/contrasena', { current: data.get('current'), new: data.get('new') });
      form.reset();
    });
  };
  return (
    <Seccion slug="contrasena">
      <Pregunta texto={AUTH_TEXT.change_password} />
      <form className={s.stack} onSubmit={submit}>
        <Field label={AUTH_TEXT.current_password} required>
          <Input name="current" type="password" autoComplete="current-password" required />
        </Field>
        <Field label={AUTH_TEXT.new_password} required>
          <Input name="new" type="password" autoComplete="new-password" required />
        </Field>
        <Field label={AUTH_TEXT.password_confirm} required>
          <Input name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <div>
          <Button type="submit" appearance="primary" disabled={busy}>{AUTH_TEXT.change_password}</Button>
        </div>
        <StatusBar status={status} />
      </form>
    </Seccion>
  );
}

export default function Page() {
  const s = useStyles();
  const { user, setUser } = useSession();
  const setTheme = useSetTheme();
  if (!user) return null;

  const save = async (change: Partial<Profile>) => {
    const next = { name: user.name, theme: user.theme, avatar: user.avatar, ...change };
    if (change.theme) setTheme(change.theme);
    try {
      setUser(await api<Profile>('/perfil', { name: next.name.trim(), theme: next.theme, avatar: next.avatar }));
    } catch (err) {
      setTheme(user.theme);
      throw err;
    }
  };

  return (
    <>
      <PageHeader title={AUTH_TEXT.profile} />
      <div className={s.columns}>
        <ProfileSection user={user} save={save} />
        <ThemeSection user={user} save={save} />
        <EmailSection user={user} onSaved={setUser} />
        <PasswordSection />
      </div>
    </>
  );
}
