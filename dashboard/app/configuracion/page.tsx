'use client';

// Configuración de la propia cuenta: perfil, tema, correo y contraseña. Un admin fija además el logo de la empresa.
// Las imágenes se reducen en el navegador y viajan como URL `data:` PNG; la API rechaza las que pasan de su tope.
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
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { PageHeader, Pregunta, Seccion, errorText } from '@/components/common';
import { useSession } from '@/lib/session';
import { useSetTheme, type ThemeChoice } from '@/app/providers';
import { api, type Profile } from '@/lib/api';
import { AUTH_TEXT, THEME_LABEL } from '@/lib/labels.generated';

// Lado mayor de la imagen guardada. 256 px se ven nítidos al doble de densidad en el riel y en el avatar.
const IMAGE_SIDE = 256;
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
  logo: { width: '120px', height: '48px', objectFit: 'contain' },
  hidden: { display: 'none' },
});

type Status = { error?: string; success?: string } | null;

// PNG de `file` con su lado mayor en `IMAGE_SIDE` o menos. Un SVG también pasa a PNG.
function resized(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(AUTH_TEXT.InvalidImage));
    };
    img.src = url;
  });
}

function StatusBar({ status }: { status: Status }) {
  if (status?.error) return <MessageBar intent="error"><MessageBarBody>{status.error}</MessageBarBody></MessageBar>;
  if (status?.success) return <MessageBar intent="success"><MessageBarBody>{status.success}</MessageBarBody></MessageBar>;
  return null;
}

// `run(fn)` marca ocupado, corre `fn` y guarda el aviso de éxito o el error de la API.
function useAction(success: string) {
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<Status>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
      setStatus({ success });
    } catch (err) {
      setStatus({ error: errorText(err) });
    }
    setBusy(false);
  };
  return { busy, status, run };
}

function ImagePicker({ onPick, disabled }: { onPick: (dataUrl: string) => void; disabled: boolean }) {
  const s = useStyles();
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className={s.hidden}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onPick(await resized(file).catch(() => ''));
        }}
      />
      <Button disabled={disabled} onClick={() => input.current?.click()}>{AUTH_TEXT.upload_image}</Button>
    </>
  );
}

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

function LogoSection({ user, onSaved }: { user: Profile; onSaved: (user: Profile) => void }) {
  const s = useStyles();
  const { busy, status, run } = useAction(AUTH_TEXT.saved);
  const save = (logo: string | null) => run(async () => onSaved(await api<Profile>('/logo', { logo })));
  return (
    <Seccion slug="logo">
      <Pregunta texto={AUTH_TEXT.logo} conclusion={AUTH_TEXT.logo_help} />
      <div className={s.stack}>
        <div className={s.imageRow}>
          {user.logo && <img src={user.logo} alt={AUTH_TEXT.logo} className={s.logo} />}
          <ImagePicker disabled={busy} onPick={(url) => url && save(url)} />
          {user.logo && <Button appearance="subtle" disabled={busy} onClick={() => save(null)}>{AUTH_TEXT.remove_image}</Button>}
        </div>
        <StatusBar status={status} />
      </div>
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
      <PageHeader title={AUTH_TEXT.settings_title} />
      <div className={s.columns}>
        <ProfileSection user={user} save={save} />
        <ThemeSection user={user} save={save} />
        <EmailSection user={user} onSaved={setUser} />
        <PasswordSection />
        {user.can_manage && <LogoSection user={user} onSaved={setUser} />}
      </div>
    </>
  );
}
