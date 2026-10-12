'use client';

// Usuarios (solo admin), como views/usuarios.py: quién entra al tablero y con qué rol. Crear una cuenta manda un
// enlace de invitación; las demás acciones operan sobre una cuenta elegida.
import * as React from 'react';
import {
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  PageHeader,
  Pregunta,
  Seccion,
  Table,
  SkeletonSeccion,
  SkeletonTable,
} from '@/components/common';
import { useSession } from '@/lib/session';
import { ApiError, api } from '@/lib/api';
import { fill, localTime } from '@/lib/format';
import { AUTH_TEXT, COLUMN_LABEL, ROLE_HELP, ROLE_LABEL } from '@/lib/labels.generated';

type Role = keyof typeof ROLE_LABEL;
type Account = {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  pending_invite: boolean;
  created_at: string;
  last_login_at: string | null;
};
type AdminResult = { link: string | null; mail_error: string | null };
type Action = 'deactivate' | 'activate' | 'set_role' | 'resend';
type Outcome = { error?: string; success?: string; result?: AdminResult };

// Los roles que asigna un admin. `staff` solo se da por la línea de comandos (`make user-role`).
const ROLES = (Object.keys(ROLE_LABEL) as Role[]).filter((role) => role !== 'staff');
const DEFAULT_ROLE: Role = 'viewer';
const COLUMNS = ['name', 'email', 'role', 'active', 'last_login_at', 'pending_invite', 'created_at'] as const;
const CHECK = '✓';

const useStyles = makeStyles({
  columns: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: tokens.spacingHorizontalXXL,
    marginTop: tokens.spacingVerticalL,
    '@media (max-width: 768px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
  stack: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  pair: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: tokens.spacingHorizontalS },
  roleRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: tokens.spacingHorizontalS },
  // Fluent fija 250 px de ancho mínimo. En dos columnas de tableta no caben.
  dropdown: { minWidth: 0 },
  // Un nombre con su correo no cabe en una columna de tableta: se corta con "…".
  dropdownButton: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  code: { fontFamily: tokens.fontFamilyMonospace, wordBreak: 'break-all', userSelect: 'all' },
});

function cell(account: Account, column: (typeof COLUMNS)[number]): string {
  const value = account[column];
  if (column === 'role') return ROLE_LABEL[account.role];
  if (typeof value === 'boolean') return value ? CHECK : '';
  if (column === 'created_at' || column === 'last_login_at') return localTime(value as string | null);
  return String(value);
}

function errorText(err: unknown): string {
  return (err instanceof ApiError && err.detail) || AUTH_TEXT.db_unavailable;
}

function RoleDropdown({ value, onChange, label }: { value: Role; onChange: (role: Role) => void; label?: string }) {
  const s = useStyles();
  return (
    <Dropdown
      className={s.dropdown}
      aria-label={label}
      value={ROLE_LABEL[value]}
      selectedOptions={[value]}
      onOptionSelect={(_, data) => onChange(data.optionValue as Role)}
    >
      {ROLES.map((role) => <Option key={role} value={role}>{ROLE_LABEL[role]}</Option>)}
    </Dropdown>
  );
}

// El enlace en modo consola y el aviso de correo fallido, como el resultado de `session.invite` y `session.manage`.
function Result({ outcome }: { outcome: Outcome | null }) {
  const s = useStyles();
  if (!outcome) return null;
  const { error, success, result } = outcome;
  return (
    <>
      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {success && <MessageBar intent="success"><MessageBarBody>{success}</MessageBarBody></MessageBar>}
      {result?.link && (
        <>
          <Caption1>{AUTH_TEXT.invite_link_console}</Caption1>
          <code className={s.code}>{result.link}</code>
        </>
      )}
      {result?.mail_error && (
        <MessageBar intent="warning">
          <MessageBarBody>{fill(AUTH_TEXT.mail_failed, { error: result.mail_error })}</MessageBarBody>
        </MessageBar>
      )}
    </>
  );
}

function NewAccount({ onDone }: { onDone: () => void }) {
  const s = useStyles();
  const [role, setRole] = React.useState<Role>(DEFAULT_ROLE);
  const [busy, setBusy] = React.useState(false);
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name')).trim();
    const email = String(data.get('email')).trim();
    if (!name || !email) return;
    setBusy(true);
    try {
      const result = await api<AdminResult>('/usuarios', { name, email, role });
      setOutcome({ success: fill(AUTH_TEXT.invite_sent, { email }), result });
      form.reset();
      setRole(DEFAULT_ROLE);
      onDone();
    } catch (err) {
      setOutcome({ error: errorText(err) });
    }
    setBusy(false);
  };

  return (
    <Seccion slug="nueva-cuenta">
      <Pregunta texto={AUTH_TEXT.new_account} />
      <div className={s.stack}>
        <form className={s.stack} onSubmit={submit}>
          <Field label={AUTH_TEXT.name} required>
            <Input name="name" />
          </Field>
          <Field label={AUTH_TEXT.email} required>
            <Input name="email" type="email" autoComplete="off" />
          </Field>
          <Field label={AUTH_TEXT.role} hint={ROLES.map((r) => `${ROLE_LABEL[r]}: ${ROLE_HELP[r]}`).join(' ')}>
            <RoleDropdown value={role} onChange={setRole} />
          </Field>
          <div>
            <Button type="submit" appearance="primary" disabled={busy}>{AUTH_TEXT.create_and_invite}</Button>
          </div>
        </form>
        <Result outcome={outcome} />
      </div>
    </Seccion>
  );
}

function ManageAccount({ others, onDone }: { others: Account[]; onDone: () => void }) {
  const s = useStyles();
  const [targetId, setTargetId] = React.useState<number | null>(null);
  const target = others.find((a) => a.id === targetId) ?? others[0];
  const [newRole, setNewRole] = React.useState<Role | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);

  if (!target) {
    return (
      <Seccion slug="administrar-cuenta">
        <Pregunta texto={AUTH_TEXT.manage_account} />
        <Caption1>{AUTH_TEXT.done}</Caption1>
      </Seccion>
    );
  }
  // Al cambiar de cuenta, el selector de rol arranca en el rol actual de esa cuenta.
  const role = newRole ?? target.role;
  const label = (a: Account) => `${a.name} · ${a.email}`;

  const run = async (action: Action) => {
    setConfirming(false);
    setBusy(true);
    try {
      const body = action === 'set_role' ? { action, role } : { action };
      const result = await api<AdminResult>(`/usuarios/${target.id}`, body);
      setOutcome({ result });
      if (action !== 'resend') {
        setNewRole(null);
        onDone();
      }
    } catch (err) {
      setOutcome({ error: errorText(err) });
    }
    setBusy(false);
  };

  return (
    <Seccion slug="administrar-cuenta">
      <Pregunta texto={AUTH_TEXT.manage_account} />
      <div className={s.stack}>
        <Field label={AUTH_TEXT.pick_account}>
          <Dropdown
            className={s.dropdown}
            button={{ className: s.dropdownButton }}
            value={label(target)}
            selectedOptions={[String(target.id)]}
            onOptionSelect={(_, data) => {
              setTargetId(Number(data.optionValue));
              setNewRole(null);
              setOutcome(null);
            }}
          >
            {others.map((a) => <Option key={a.id} value={String(a.id)}>{label(a)}</Option>)}
          </Dropdown>
        </Field>
        <div className={s.pair}>
          {target.active
            ? <Button disabled={busy} onClick={() => setConfirming(true)}>{AUTH_TEXT.deactivate}</Button>
            : <Button disabled={busy} onClick={() => run('activate')}>{AUTH_TEXT.activate}</Button>}
          <Button disabled={busy} onClick={() => run('resend')}>{AUTH_TEXT.resend_link}</Button>
        </div>
        <div className={s.roleRow}>
          <RoleDropdown value={role} onChange={setNewRole} label={AUTH_TEXT.change_role} />
          <Button disabled={busy || role === target.role} onClick={() => run('set_role')}>{AUTH_TEXT.change_role}</Button>
        </div>
        <Result outcome={outcome} />
      </div>
      <Dialog open={confirming} onOpenChange={(_, data) => setConfirming(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{AUTH_TEXT.deactivate}</DialogTitle>
            <DialogContent>{fill(AUTH_TEXT.deactivate_confirm, { name: label(target) })}</DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setConfirming(false)}>{AUTH_TEXT.cancel}</Button>
              <Button appearance="primary" onClick={() => run('deactivate')}>{AUTH_TEXT.deactivate}</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </Seccion>
  );
}

export default function Page() {
  const s = useStyles();
  const { user } = useSession();
  const [users, setUsers] = React.useState<Account[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(() => {
    api<Account[]>('/usuarios').then(setUsers, (err) => setError(errorText(err)));
  }, []);
  React.useEffect(reload, [reload]);

  return (
    <>
      <PageHeader title={AUTH_TEXT.users_title} />
      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {!users && !error && (
        <>
          <SkeletonTable rows={4} columns={6} />
          <div className={s.columns}><SkeletonSeccion table /><SkeletonSeccion table /></div>
        </>
      )}
      {users && users.length > 0 && (
        <Table headers={COLUMNS.map((c) => COLUMN_LABEL[c])} rows={users.map((a) => COLUMNS.map((c) => cell(a, c)))} />
      )}
      {users && (
        <div className={s.columns}>
          <NewAccount onDone={reload} />
          <ManageAccount others={users.filter((a) => a.id !== user?.id)} onDone={reload} />
        </div>
      )}
    </>
  );
}
