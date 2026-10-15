'use client';

// Menú del avatar en la barra superior: la identidad de la cuenta y sus opciones. "Cuenta" abre Configuración, "Aspecto"
// cambia el tema en una vista dentro del mismo menú, "Mejorar" y "Comunicarse con Ventas" abren el diálogo de mejora y "Cerrar sesión" sale.
// El resto se muestra deshabilitado hasta que tenga destino.
import * as React from 'react';
import {
  Avatar,
  Badge,
  Button,
  Menu,
  MenuDivider,
  MenuGroup,
  MenuItem,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Text,
  createMotionComponent,
  makeStyles,
  motionTokens,
  tokens,
} from '@fluentui/react-components';
import {
  Alert20Regular,
  ArrowLeft20Regular,
  Color20Regular,
  Desktop20Regular,
  Keyboard20Regular,
  Mail20Regular,
  Person20Regular,
  SignOut20Regular,
  Sparkle20Regular,
  Translate20Regular,
  WeatherMoon20Regular,
  WeatherSunny20Regular,
} from '@fluentui/react-icons';
import type { Profile } from '@/lib/api';
import { useSaveProfile } from '@/lib/session';
import { AUTH_TEXT, HELP_TEXT, ROLE_LABEL, SHELL_TEXT, THEME_LABEL } from '@/lib/labels.generated';

export const THEME_ICON = { light: WeatherSunny20Regular, dark: WeatherMoon20Regular, system: Desktop20Regular } as const;

// La vista de Aspecto entra desde la derecha y el menú inicial vuelve desde la izquierda, en la misma posición.
const slideFrom = (x: number) => createMotionComponent({
  keyframes: [
    { opacity: 0, transform: `translateX(${x}px)` },
    { opacity: 1, transform: 'translateX(0)' },
  ],
  duration: motionTokens.durationFast,
  easing: motionTokens.curveDecelerateMid,
});
const FromRight = slideFrom(12);
const FromLeft = slideFrom(-12);

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
  help: { color: tokens.colorNeutralForeground3, padding: `0 ${tokens.spacingHorizontalM} ${tokens.spacingVerticalS}`, margin: 0, maxWidth: '240px' },
  role: { alignSelf: 'flex-start', marginTop: tokens.spacingVerticalXS },
});

export function AccountMenu({ user, onLogout, onSettings, onUpgrade, onSales }: {
  user: Profile;
  onLogout: () => void;
  onSettings: () => void;
  onUpgrade: () => void;
  onSales: () => void;
}) {
  const s = useStyles();
  const saveProfile = useSaveProfile();
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<'main' | 'appearance'>('main');
  const initials = user.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2);
  return (
    <Menu
      positioning="below-end"
      open={open}
      onOpenChange={(_, data) => { setOpen(data.open); if (!data.open) setView('main'); }}
      checkedValues={{ theme: [user.theme] }}
      onCheckedValueChange={(_, data) => { saveProfile({ theme: data.checkedItems[0] as Profile['theme'] }).catch(() => {}); }}
    >
      <MenuTrigger disableButtonEnhancement>
        <Button appearance="transparent" aria-label={user.name} icon={<Avatar name={user.name} initials={initials} image={user.avatar ? { src: user.avatar } : undefined} size={32} />} />
      </MenuTrigger>
      <MenuPopover>
        {view === 'main' ? (
          <FromLeft>
            <div>
              <div className={s.identity}>
                <Text className={s.name}>{user.name}</Text>
                <Text size={200} className={s.email}>{user.email}</Text>
                <Badge appearance="tint" color="informative" className={s.role}>{ROLE_LABEL[user.role]}</Badge>
              </div>
              <MenuList>
                <MenuItem icon={<Person20Regular />} onClick={onSettings}>{SHELL_TEXT.account}</MenuItem>
                <MenuItem icon={<Alert20Regular />} disabled>{SHELL_TEXT.notifications}</MenuItem>
                <MenuItem icon={<Translate20Regular />} disabled>{SHELL_TEXT.language}</MenuItem>
                <MenuItem icon={<Color20Regular />} persistOnClick onClick={() => setView('appearance')}>{SHELL_TEXT.appearance}</MenuItem>
                <MenuItem icon={<Keyboard20Regular />} disabled>{SHELL_TEXT.shortcuts}</MenuItem>
                <MenuDivider />
                <MenuItem icon={<Mail20Regular />} onClick={onSales}>{SHELL_TEXT.sales}</MenuItem>
                <MenuItem icon={<Sparkle20Regular />} onClick={onUpgrade}>{SHELL_TEXT.upgrade}</MenuItem>
                <MenuItem icon={<Mail20Regular />} disabled>{SHELL_TEXT.invite}</MenuItem>
                <MenuDivider />
                <MenuItem icon={<SignOut20Regular />} onClick={onLogout}>{AUTH_TEXT.logout}</MenuItem>
              </MenuList>
            </div>
          </FromLeft>
        ) : (
          <FromRight>
            <MenuList>
              <MenuItem icon={<ArrowLeft20Regular />} persistOnClick aria-label={HELP_TEXT.back} onClick={() => setView('main')}>
                {SHELL_TEXT.appearance}
              </MenuItem>
              <MenuDivider />
              <Text size={200} className={s.help} as="p">{SHELL_TEXT.appearance_help}</Text>
              <MenuGroup>
                {(Object.keys(THEME_ICON) as (keyof typeof THEME_ICON)[]).map((choice) => {
                  const Icon = THEME_ICON[choice];
                  return <MenuItemRadio key={choice} name="theme" value={choice} icon={<Icon />}>{THEME_LABEL[choice]}</MenuItemRadio>;
                })}
              </MenuGroup>
            </MenuList>
          </FromRight>
        )}
      </MenuPopover>
    </Menu>
  );
}
