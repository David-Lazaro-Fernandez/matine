'use client';

// Barra horizontal del marco: logo de la empresa a la izquierda, búsqueda de secciones al centro, e impresión, ayuda y cuenta a la derecha.
// Vive sobre el riel y el panel, así que su altura (`BAR_HEIGHT`) es el desplazamiento de los dos.
import * as React from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import { AccountMenu } from '@/components/account-menu';
import { CommandPalette, type Entry } from '@/components/command-palette';
import { HelpDrawer } from '@/components/help-drawer';
import { PrintButton } from '@/components/print-button';
import type { Profile } from '@/lib/api';

export const BAR_HEIGHT = '56px';

const useStyles = makeStyles({
  bar: {
    position: 'sticky',
    top: 0,
    zIndex: 900,
    height: BAR_HEIGHT,
    boxSizing: 'border-box',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 420px) minmax(0, 1fr)',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: `0 ${tokens.spacingHorizontalL}`,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    '@media print': { display: 'none' },
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr auto 1fr',
      padding: `0 ${tokens.spacingHorizontalM}`,
    },
  },
  brand: { display: 'flex', alignItems: 'center', minWidth: 0 },
  home: { display: 'flex', minWidth: 0 },
  logo: { height: '48px', maxWidth: 'min(240px, 100%)', objectFit: 'contain' },
  search: { display: 'flex', justifyContent: 'center', minWidth: 0 },
  end: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: tokens.spacingHorizontalXS },
});

export function TopbarSkeleton() {
  const s = useStyles();
  return <div className={s.bar} aria-busy />;
}

export function Topbar<K extends string>({
  user,
  entries,
  onPick,
  onLogout,
  onSettings,
  onUpgrade,
  onSales,
}: {
  user: Profile;
  entries: Entry<K>[];
  onPick: (key: K) => void;
  onLogout: () => void;
  onSettings: () => void;
  onUpgrade: () => void;
  onSales: () => void;
}) {
  const s = useStyles();
  return (
    <header className={s.bar}>
      <div className={s.brand}>{user.logo && <a href="/" aria-label={user.org} className={s.home}><img src={user.logo} alt="" className={s.logo} /></a>}</div>
      <div className={s.search}>
        <CommandPalette entries={entries} onPick={onPick} />
      </div>
      <div className={s.end}>
        {user.can_download && <PrintButton />}
        <HelpDrawer />
        <AccountMenu user={user} onLogout={onLogout} onSettings={onSettings} onUpgrade={onUpgrade} onSales={onSales} />
      </div>
    </header>
  );
}
