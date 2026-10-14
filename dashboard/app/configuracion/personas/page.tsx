'use client';

// Personas del espacio de trabajo (solo admin): asientos pagados, miembros y próximo cobro, y las cuentas de la
// organización. Agregar un miembro manda un enlace de invitación; el rol se cambia en la fila.
import * as React from 'react';
import {
  Avatar,
  Body1,
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
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  Option,
  Subtitle1,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  TableHeaderCell,
  TableRow,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Add20Regular, MoreHorizontal20Regular } from '@fluentui/react-icons';
import { PageHeader, SkeletonTable } from '@/components/common';
import { useSession } from '@/lib/session';
import { ApiError, api } from '@/lib/api';
import { date_es, fill, localTime } from '@/lib/format';
import { AUTH_TEXT, COLUMN_LABEL, ROLE_HELP, ROLE_LABEL } from '@/lib/labels.generated';

type Role = keyof typeof ROLE_LABEL;
type Account = {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  pending_invite: boolean;
  last_login_at: string | null;
};
type Workspace = { name: string; seats: number | null; members: number; next_billing_at: string | null };
type AdminResult = { link: string | null; mail_error: string | null };
type Action = 'deactivate' | 'activate' | 'set_role' | 'resend';
type Outcome = { error?: string; success?: string; result?: AdminResult };

// Los roles que asigna un admin. `staff` solo se da por la línea de comandos (`make user-role`).
const ROLES = (Object.keys(ROLE_LABEL) as Role[]).filter((role) => role !== 'staff');
const DEFAULT_ROLE: Role = 'viewer';
const MOBILE = '@media (max-width: 768px)';

const useStyles = makeStyles({
  stack: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  toolbar: { display: 'flex', justifyContent: 'flex-end', margin: `${tokens.spacingVerticalM} 0` },
  cards: {
    display: 'grid',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    marginBottom: tokens.spacingVerticalL,
    [MOBILE]: { gridTemplateColumns: 'minmax(0, 1fr) !important' },
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalL,
    ':not(:first-child)': {
      borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
      [MOBILE]: { borderLeft: 'none', borderTop: `1px solid ${tokens.colorNeutralStroke2}` },
    },
  },
  tableScroll: { overflowX: 'auto' },
  // Con menos ancho las columnas se encimarían; la tabla se desplaza dentro de su contenedor.
  table: { minWidth: '640px' },
  muted: { color: tokens.colorNeutralForeground3 },
  // Fluent fija 250 px de ancho mínimo y la celda de una fila es más angosta.
  dropdown: { minWidth: 0, width: '170px' },
  code: { fontFamily: tokens.fontFamilyMonospace, wordBreak: 'break-all', userSelect: 'all' },
});

function errorText(err: unknown): string {
  return (err instanceof ApiError && err.detail) || AUTH_TEXT.db_unavailable;
}

function RoleDropdown({ value, onChange, disabled, label }: { value: Role; onChange: (role: Role) => void; disabled?: boolean; label?: string }) {
  const s = useStyles();
  return (
    <Dropdown
      className={s.dropdown}
      aria-label={label}
      disabled={disabled}
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

function Summary({ space }: { space: Workspace }) {
  const s = useStyles();
  const { seats, members, next_billing_at } = space;
  const cards: [string, string][] = [
    [AUTH_TEXT.paid_seats, seats === null ? AUTH_TEXT.no_subscription : String(seats)],
    [AUTH_TEXT.current_members, String(members)],
  ];
  if (next_billing_at) cards.push([AUTH_TEXT.next_billing, date_es(next_billing_at.slice(0, 10))]);
  return (
    <>
      <div className={s.cards} style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}>
        {cards.map(([label, value]) => (
          <div key={label} className={s.card}>
            <Caption1 className={s.muted}>{label}</Caption1>
            <Subtitle1>{value}</Subtitle1>
          </div>
        ))}
      </div>
      {seats !== null && members > seats && (
        <MessageBar intent="warning"><MessageBarBody>{AUTH_TEXT.seats_exceeded}</MessageBarBody></MessageBar>
      )}
    </>
  );
}

function AddMember({ onDone }: { onDone: () => void }) {
  const s = useStyles();
  const [open, setOpen] = React.useState(false);
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
    <>
      <Button appearance="primary" icon={<Add20Regular />} onClick={() => setOpen(true)}>{AUTH_TEXT.add_member}</Button>
      <Dialog open={open} onOpenChange={(_, data) => { setOpen(data.open); if (!data.open) setOutcome(null); }}>
        <DialogSurface>
          <form onSubmit={submit}>
            <DialogBody>
              <DialogTitle>{AUTH_TEXT.add_member}</DialogTitle>
              <DialogContent className={s.stack}>
                <Field label={AUTH_TEXT.name} required><Input name="name" /></Field>
                <Field label={AUTH_TEXT.email} required><Input name="email" type="email" autoComplete="off" /></Field>
                <Field label={AUTH_TEXT.role} hint={ROLES.map((r) => `${ROLE_LABEL[r]}: ${ROLE_HELP[r]}`).join(' ')}>
                  <RoleDropdown value={role} onChange={setRole} />
                </Field>
                <Result outcome={outcome} />
              </DialogContent>
              <DialogActions>
                <Button appearance="secondary" onClick={() => setOpen(false)}>{AUTH_TEXT.cancel}</Button>
                <Button type="submit" appearance="primary" disabled={busy}>{AUTH_TEXT.create_and_invite}</Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>
    </>
  );
}

function statusOf(account: Account): string {
  if (!account.active) return AUTH_TEXT.status_inactive;
  return account.pending_invite ? COLUMN_LABEL.pending_invite : AUTH_TEXT.status_active;
}

function Members({ accounts, onDone }: { accounts: Account[]; onDone: () => void }) {
  const s = useStyles();
  const { user } = useSession();
  const [confirming, setConfirming] = React.useState<Account | null>(null);
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);

  const run = async (account: Account, action: Action, role?: Role) => {
    setConfirming(null);
    try {
      const result = await api<AdminResult>(`/usuarios/${account.id}`, action === 'set_role' ? { action, role } : { action });
      setOutcome({ result });
      if (action !== 'resend') onDone();
    } catch (err) {
      setOutcome({ error: errorText(err) });
    }
  };

  return (
    <div className={s.stack}>
      <Result outcome={outcome} />
      <div className={s.tableScroll}>
        <Table size="small" className={s.table}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>{AUTH_TEXT.member}</TableHeaderCell>
              <TableHeaderCell>{COLUMN_LABEL.status}</TableHeaderCell>
              <TableHeaderCell>{AUTH_TEXT.role}</TableHeaderCell>
              <TableHeaderCell>{COLUMN_LABEL.last_login_at}</TableHeaderCell>
              <TableHeaderCell aria-label={AUTH_TEXT.more_actions} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => {
              const isSelf = a.id === user?.id;
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <TableCellLayout media={<Avatar name={a.name} size={28} />} description={a.email}>{a.name}</TableCellLayout>
                  </TableCell>
                  <TableCell><TableCellLayout><Body1 className={a.active ? undefined : s.muted}>{statusOf(a)}</Body1></TableCellLayout></TableCell>
                  <TableCell>
                    <RoleDropdown value={a.role} label={AUTH_TEXT.change_role} disabled={isSelf || !(ROLES as Role[]).includes(a.role)}
                      onChange={(role) => run(a, 'set_role', role)} />
                  </TableCell>
                  <TableCell><TableCellLayout>{localTime(a.last_login_at)}</TableCellLayout></TableCell>
                  <TableCell>
                    {!isSelf && (
                      <Menu>
                        <MenuTrigger disableButtonEnhancement>
                          <Button appearance="subtle" icon={<MoreHorizontal20Regular />} aria-label={AUTH_TEXT.more_actions} />
                        </MenuTrigger>
                        <MenuPopover>
                          <MenuList>
                            <MenuItem onClick={() => run(a, 'resend')}>{AUTH_TEXT.resend_link}</MenuItem>
                            {a.active
                              ? <MenuItem onClick={() => setConfirming(a)}>{AUTH_TEXT.deactivate}</MenuItem>
                              : <MenuItem onClick={() => run(a, 'activate')}>{AUTH_TEXT.activate}</MenuItem>}
                          </MenuList>
                        </MenuPopover>
                      </Menu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Dialog open={confirming !== null} onOpenChange={(_, data) => !data.open && setConfirming(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{AUTH_TEXT.deactivate}</DialogTitle>
            <DialogContent>{confirming && fill(AUTH_TEXT.deactivate_confirm, { name: `${confirming.name} · ${confirming.email}` })}</DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setConfirming(null)}>{AUTH_TEXT.cancel}</Button>
              <Button appearance="primary" onClick={() => confirming && run(confirming, 'deactivate')}>{AUTH_TEXT.deactivate}</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

export default function Page() {
  const s = useStyles();
  const [accounts, setAccounts] = React.useState<Account[] | null>(null);
  const [space, setSpace] = React.useState<Workspace | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(() => {
    api<Account[]>('/usuarios').then(setAccounts, (err) => setError(errorText(err)));
    api<Workspace>('/espacio').then(setSpace, (err) => setError(errorText(err)));
  }, []);
  React.useEffect(reload, [reload]);

  return (
    <>
      <PageHeader title={AUTH_TEXT.people} />
      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {!accounts && !error && <SkeletonTable rows={4} columns={5} />}
      {accounts && space && (
        <>
          <div className={s.toolbar}><AddMember onDone={reload} /></div>
          <Summary space={space} />
          <Members accounts={accounts} onDone={reload} />
        </>
      )}
    </>
  );
}
