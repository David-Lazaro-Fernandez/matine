'use client';

// Menú del avatar en la barra superior: la identidad de la cuenta y sus opciones. "Cuenta" y "Aspecto" abren Configuración,
// "Mejorar" y "Comunicarse con Ventas" abren el diálogo de mejora y "Cerrar sesión" sale. El resto se muestra
// deshabilitado hasta que tenga destino.
import * as React from 'react';
import {
  Avatar,
  Button,
  Menu,
  MenuDivider,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  Alert20Regular,
  Color20Regular,
  Keyboard20Regular,
  Mail20Regular,
  Person20Regular,
  SignOut20Regular,
  Sparkle20Regular,
  Translate20Regular,
} from '@fluentui/react-icons';
import type { Profile } from '@/lib/api';
import { AUTH_TEXT, SHELL_TEXT } from '@/lib/labels.generated';

const useStyles = makeStyles({
  identity: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    minWidth: '240px',
  },
  name: { fontWeight: tokens.fontWeightSemibold },
  email: { color: tokens.colorNeutralForeground3, overflowWrap: 'anywhere' },
});

export function AccountMenu({ user, onLogout, onSettings, onUpgrade, onSales }: {
  user: Profile;
  onLogout: () => void;
  onSettings: () => void;
  onUpgrade: () => void;
  onSales: () => void;
}) {
  const s = useStyles();
  const initials = user.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2);
  return (
    <Menu positioning="below-end">
      <MenuTrigger disableButtonEnhancement>
        <Button appearance="transparent" aria-label={user.name} icon={<Avatar name={user.name} initials={initials} image={user.avatar ? { src: user.avatar } : undefined} size={32} />} />
      </MenuTrigger>
      <MenuPopover>
        <div className={s.identity}>
          <Text className={s.name}>{user.name}</Text>
          <Text size={200} className={s.email}>{user.email}</Text>
        </div>
        <MenuList>
          <MenuItem icon={<Person20Regular />} onClick={onSettings}>{SHELL_TEXT.account}</MenuItem>
          <MenuItem icon={<Alert20Regular />} disabled>{SHELL_TEXT.notifications}</MenuItem>
          <MenuItem icon={<Translate20Regular />} disabled>{SHELL_TEXT.language}</MenuItem>
          <MenuItem icon={<Color20Regular />} onClick={onSettings}>{SHELL_TEXT.appearance}</MenuItem>
          <MenuItem icon={<Keyboard20Regular />} disabled>{SHELL_TEXT.shortcuts}</MenuItem>
          <MenuDivider />
          <MenuItem icon={<Mail20Regular />} onClick={onSales}>{SHELL_TEXT.sales}</MenuItem>
          <MenuItem icon={<Sparkle20Regular />} onClick={onUpgrade}>{SHELL_TEXT.upgrade}</MenuItem>
          <MenuItem icon={<Mail20Regular />} disabled>{SHELL_TEXT.invite}</MenuItem>
          <MenuDivider />
          <MenuItem icon={<SignOut20Regular />} onClick={onLogout}>{AUTH_TEXT.logout}</MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
