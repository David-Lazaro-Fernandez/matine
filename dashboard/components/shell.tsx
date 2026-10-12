'use client';

// Navegación y sesión, como app.py de Streamlit. Las páginas visibles salen del rol de `GET /api/yo`.
// Sin sesión solo existen entrar, olvidé y restablecer. Una ruta que no corresponde al rol manda a la cartelera.
// Escritorio: riel de módulos con iconos y panel con las páginas del módulo. Celular: módulos abajo, páginas arriba.
import * as React from 'react';
import {
  Avatar,
  Button,
  NavDrawer,
  NavDrawerBody,
  NavDrawerHeader,
  NavItem,
  Popover,
  Skeleton,
  SkeletonItem,
  PopoverSurface,
  PopoverTrigger,
  Tab,
  TabList,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import {
  BuildingShop20Regular,
  DataBarVertical20Regular,
  Database20Regular,
  Database24Filled,
  Database24Regular,
  Food24Filled,
  Food24Regular,
  HeartPulse20Regular,
  Location20Regular,
  Map20Regular,
  MoviesAndTv24Filled,
  MoviesAndTv24Regular,
  Organization20Regular,
  People20Regular,
  Settings24Filled,
  Settings24Regular,
  VehicleTruckProfile20Regular,
  VideoClip20Regular,
} from '@fluentui/react-icons';
import { usePathname, useRouter } from 'next/navigation';
import { SkeletonCapas, SkeletonLines } from '@/components/common';
import { LOGIN_PATH, api, isPublicPath, type Me } from '@/lib/api';
import { AUTH_TEXT, MODULE_LABEL, NAV_LABEL, ROLE_LABEL } from '@/lib/labels.generated';

type PageKey = keyof typeof NAV_LABEL;
type ModuleKey = keyof typeof MODULE_LABEL;
type Icon = React.ComponentType<{ className?: string }>;

// Cada módulo es un plan: Cartelera trae las páginas de películas, Dulcería las de precios de dulcería.
const MODULES: { key: ModuleKey; icon: Icon; iconSelected: Icon; pages: PageKey[]; admin?: boolean }[] = [
  { key: 'cartelera', icon: MoviesAndTv24Regular, iconSelected: MoviesAndTv24Filled, pages: ['cartelera', 'mapa', 'recomendador', 'independientes', 'proveedores'] },
  { key: 'dulceria', icon: Food24Regular, iconSelected: Food24Filled, pages: ['dulceria', 'domicilio'] },
  { key: 'datos', icon: Database24Regular, iconSelected: Database24Filled, pages: ['datos'] },
  { key: 'admin', icon: Settings24Regular, iconSelected: Settings24Filled, pages: ['usuarios', 'operaciones'], admin: true },
];
const PAGE_ICON: Partial<Record<PageKey, Icon>> = {
  cartelera: DataBarVertical20Regular,
  mapa: Map20Regular,
  recomendador: Location20Regular,
  independientes: VideoClip20Regular,
  proveedores: Organization20Regular,
  dulceria: BuildingShop20Regular,
  domicilio: VehicleTruckProfile20Regular,
  datos: Database20Regular,
  usuarios: People20Regular,
  operaciones: HeartPulse20Regular,
};
const HREF: Partial<Record<PageKey, string>> = { cartelera: '/', domicilio: '/dulceria/domicilio/' };
const ADMIN_PAGES = MODULES.filter((m) => m.admin).flatMap((m) => m.pages);
// Con sesión, entrar y olvidé mandan a la cartelera. Restablecer sigue abierto: el enlace del correo puede ser de otra persona.
const SIGNED_OUT_ONLY = ['/entrar', '/olvide'];

const MOBILE = '@media (max-width: 768px)';

const useStyles = makeStyles({
  page: { backgroundColor: tokens.colorNeutralBackground2, minHeight: '100vh' },
  frame: { display: 'flex', minHeight: '100vh', backgroundColor: tokens.colorNeutralBackground3 },
  // El contenido es la superficie elevada (depth 16) sobre el panel y el riel, como en las consolas de Microsoft.
  surface: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    [MOBILE]: { boxShadow: 'none' },
  },
  rail: {
    position: 'sticky',
    top: 0,
    height: '100vh',
    width: '56px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalL} 0`,
    boxSizing: 'border-box',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    [MOBILE]: { display: 'none' },
  },
  railSpacer: { flex: 1 },
  railSelected: { color: tokens.colorBrandForeground1, backgroundColor: tokens.colorBrandBackground2 },
  panel: {
    position: 'sticky',
    top: 0,
    height: '100vh',
    width: '220px',
    backgroundColor: tokens.colorNeutralBackground3,
    [MOBILE]: { display: 'none' },
  },
  panelTitle: { fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  account: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS, fontSize: tokens.fontSizeBase200 },
  accountName: { fontWeight: tokens.fontWeightSemibold },
  accountMeta: { color: tokens.colorNeutralForeground3 },
  main: {
    flex: 1,
    minWidth: 0,
    maxWidth: '1120px',
    margin: '0 auto',
    padding: '2rem 32px 5rem',
    boxSizing: 'border-box',
    [MOBILE]: { padding: '1rem 16px 84px' },
  },
  mobilePages: { display: 'none', [MOBILE]: { display: 'flex', overflowX: 'auto', marginBottom: tokens.spacingVerticalL } },
  mobileAccount: { display: 'none', [MOBILE]: { display: 'flex', marginBottom: tokens.spacingVerticalL } },
  tabs: {
    display: 'none',
    [MOBILE]: {
      display: 'flex',
      justifyContent: 'space-around',
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      backgroundColor: tokens.colorNeutralBackground1,
      borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
      padding: '4px 0 8px',
    },
  },
});

const SessionContext = React.createContext<{ user: Me | null; setUser: (user: Me | null) => void }>({
  user: null,
  setUser: () => {},
});

// La cuenta de la sesión, o null. Las pantallas de acceso la cambian con `setUser` al entrar o salir.
export function useSession() {
  return React.useContext(SessionContext);
}

function href(key: PageKey): string {
  return HREF[key] ?? `/${key}/`;
}

function pageAt(path: string): PageKey {
  const keys = Object.keys(NAV_LABEL) as PageKey[];
  return keys.find((key) => href(key).replace(/\/$/, '') === path) ?? 'cartelera';
}

function Account({ user, onLogout }: { user: Me; onLogout: () => void }) {
  const s = useStyles();
  return (
    <div className={s.account}>
      <span>
        {AUTH_TEXT.signed_in_as} <span className={s.accountName}>{user.name}</span>
        <br />
        <span className={s.accountMeta}>{user.email} · {ROLE_LABEL[user.role as keyof typeof ROLE_LABEL] ?? user.role}</span>
      </span>
      <Button size="small" onClick={onLogout}>{AUTH_TEXT.logout}</Button>
    </div>
  );
}

// El marco mientras `GET /api/yo` no responde: riel, panel y una página de capas.
function ShellSkeleton() {
  const s = useStyles();
  return (
    <div className={s.frame}>
      <Skeleton className={s.rail} aria-busy>
        {MODULES.map((m) => <SkeletonItem key={m.key} shape="square" size={40} />)}
      </Skeleton>
      <div className={s.panel} style={{ padding: tokens.spacingHorizontalL, boxSizing: 'border-box' }}>
        <SkeletonLines lines={5} />
      </div>
      <div className={s.surface}>
        <main className={s.main}>
          <SkeletonLines lines={2} />
          <SkeletonCapas />
        </main>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const s = useStyles();
  const router = useRouter();
  const path = usePathname().replace(/\/$/, '') || '/';
  // undefined mientras `GET /api/yo` no responde.
  const [user, setUser] = React.useState<Me | null | undefined>(undefined);

  React.useEffect(() => {
    api<Me>('/yo').then(setUser, () => setUser(null));
  }, []);

  const modules = MODULES.filter((m) => !m.admin || user?.role === 'admin');
  const current = pageAt(path);
  const active = MODULES.find((m) => m.pages.includes(current)) ?? MODULES[0];
  const isPublic = isPublicPath(path);
  const redirect =
    user === null && !isPublic ? LOGIN_PATH
      : user && SIGNED_OUT_ONLY.includes(path) ? '/'
        : user && ADMIN_PAGES.includes(current) && user.role !== 'admin' ? '/'
          : null;

  React.useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  // Al quedar sin usuario, el efecto de arriba manda a entrar.
  const logout = () => api('/logout', {}).finally(() => setUser(null));

  if (user === undefined && !isPublic) return <ShellSkeleton />;
  if (user === undefined || redirect) return null;
  const session = { user, setUser };
  if (!user) {
    return <SessionContext.Provider value={session}><div className={s.page}>{children}</div></SessionContext.Provider>;
  }

  const go = (key: PageKey) => router.push(href(key));
  const initials = user.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2);
  return (
    <SessionContext.Provider value={session}>
      <div className={s.frame}>
        <nav className={s.rail}>
          {modules.map((m) => {
            const selected = m.key === active.key;
            const ModuleIcon = selected ? m.iconSelected : m.icon;
            return (
              <Tooltip key={m.key} content={MODULE_LABEL[m.key]} relationship="label" positioning="after">
                <Button
                  appearance="subtle"
                  size="large"
                  icon={<ModuleIcon />}
                  aria-current={selected ? 'page' : undefined}
                  className={mergeClasses(selected && s.railSelected)}
                  onClick={() => go(m.pages[0])}
                />
              </Tooltip>
            );
          })}
          <div className={s.railSpacer} />
          <Popover positioning="after-bottom">
            <PopoverTrigger disableButtonEnhancement>
              <Button appearance="transparent" aria-label={user.name} icon={<Avatar name={user.name} initials={initials} size={32} />} />
            </PopoverTrigger>
            <PopoverSurface>
              <Account user={user} onLogout={logout} />
            </PopoverSurface>
          </Popover>
        </nav>
        <NavDrawer open type="inline" selectedValue={current} className={s.panel}>
          <NavDrawerHeader className={s.panelTitle}>{MODULE_LABEL[active.key]}</NavDrawerHeader>
          <NavDrawerBody>
            {active.pages.map((key) => {
              const PageIcon = PAGE_ICON[key];
              return (
                <NavItem
                  key={key}
                  value={key}
                  href={href(key)}
                  icon={PageIcon && <PageIcon />}
                  onClick={(e) => { e.preventDefault(); go(key); }}
                >
                  {NAV_LABEL[key]}
                </NavItem>
              );
            })}
          </NavDrawerBody>
        </NavDrawer>
        <div className={s.surface}>
        <main className={s.main}>
          <div className={s.mobileAccount}>
            <Account user={user} onLogout={logout} />
          </div>
          {active.pages.length > 1 && (
            <TabList className={s.mobilePages} size="small" selectedValue={current} onTabSelect={(_, data) => go(data.value as PageKey)}>
              {active.pages.map((key) => <Tab key={key} value={key}>{NAV_LABEL[key]}</Tab>)}
            </TabList>
          )}
          {children}
        </main>
        </div>
      </div>
      <TabList className={s.tabs} selectedValue={active.key} onTabSelect={(_, data) => go(MODULES.find((m) => m.key === data.value)!.pages[0])}>
        {modules.map((m) => {
          const ModuleIcon = m.key === active.key ? m.iconSelected : m.icon;
          return <Tab key={m.key} value={m.key} icon={<ModuleIcon />}>{MODULE_LABEL[m.key]}</Tab>;
        })}
      </TabList>
    </SessionContext.Provider>
  );
}
