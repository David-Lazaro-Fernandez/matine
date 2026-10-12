'use client';

// Navegación y sesión, como app.py de Streamlit. Lo visible sale de `GET /api/yo`: los módulos de la organización y el rol.
// Un módulo no contratado se ve con candado y abre el diálogo de mejora; su página muestra el mismo aviso.
// Sin sesión solo existen entrar, olvidé y restablecer. Una página de administración que no corresponde al rol manda a la cartelera.
// Escritorio: riel de módulos con iconos y panel con las páginas del módulo. Celular: módulos abajo, páginas arriba.
import * as React from 'react';
import {
  Button,
  NavDrawer,
  NavDrawerBody,
  NavDrawerHeader,
  NavItem,
  Skeleton,
  SkeletonItem,
  Tab,
  TabList,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import {
  BuildingMultiple20Regular,
  BuildingShop20Regular,
  DataBarVertical20Regular,
  Database20Regular,
  Database24Filled,
  Database24Regular,
  Food24Filled,
  Food24Regular,
  HeartPulse20Regular,
  LockClosed12Filled,
  History20Regular,
  Lightbulb20Regular,
  Location20Regular,
  Map20Regular,
  MoviesAndTv24Filled,
  MoviesAndTv24Regular,
  Money20Regular,
  People20Regular,
  Settings20Regular,
  Settings24Filled,
  Settings24Regular,
  TicketDiagonal20Regular,
  VehicleTruckProfile20Regular,
  VideoClip20Regular,
} from '@fluentui/react-icons';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SkeletonCapas, SkeletonLines } from '@/components/common';
import { useSetTheme } from '@/app/providers';
import { type Entry } from '@/components/command-palette';
import { BAR_HEIGHT, Topbar, TopbarSkeleton } from '@/components/topbar';
import { UpgradeDialog, LockedPage } from '@/components/upgrade';
import { LOGIN_PATH, api, isPublicPath, type Module, type Profile } from '@/lib/api';
import { AUTH_TEXT, MODULE_LABEL, NAV_LABEL, UPGRADE_TEXT } from '@/lib/labels.generated';
import { SessionContext } from '@/lib/session';

type PageKey = keyof typeof NAV_LABEL;
type ModuleKey = keyof typeof MODULE_LABEL;
type Icon = React.ComponentType<{ className?: string }>;

// Cada módulo se contrata aparte: Cartelera trae las páginas de películas, Dulcería las de precios de dulcería.
const MODULES: { key: ModuleKey; icon: Icon; iconSelected: Icon; pages: PageKey[] }[] = [
  { key: 'cartelera', icon: MoviesAndTv24Regular, iconSelected: MoviesAndTv24Filled, pages: ['cartelera', 'programacion', 'preventa', 'precios', 'cines', 'historial', 'mapa', 'recomendador', 'independientes'] },
  { key: 'dulceria', icon: Food24Regular, iconSelected: Food24Filled, pages: ['dulceria', 'domicilio'] },
  { key: 'datos', icon: Database24Regular, iconSelected: Database24Filled, pages: ['datos'] },
  { key: 'admin', icon: Settings24Regular, iconSelected: Settings24Filled, pages: ['usuarios', 'operaciones'] },
];
const PAGE_ICON: Partial<Record<PageKey, Icon>> = {
  cartelera: Lightbulb20Regular,
  programacion: DataBarVertical20Regular,
  preventa: TicketDiagonal20Regular,
  precios: Money20Regular,
  cines: BuildingMultiple20Regular,
  historial: History20Regular,
  mapa: Map20Regular,
  recomendador: Location20Regular,
  independientes: VideoClip20Regular,
  dulceria: BuildingShop20Regular,
  domicilio: VehicleTruckProfile20Regular,
  datos: Database20Regular,
  usuarios: People20Regular,
  operaciones: HeartPulse20Regular,
  configuracion: Settings20Regular,
};
const HREF: Partial<Record<PageKey, string>> = { cartelera: '/', domicilio: '/dulceria/domicilio/' };
// Usuarios es de quien gestiona cuentas; Operaciones, solo del equipo de la plataforma.
function canSee(user: Profile, key: PageKey): boolean {
  if (key === 'usuarios') return user.can_manage;
  if (key === 'operaciones') return user.role === 'staff';
  return true;
}
function isLocked(user: Profile, key: ModuleKey): boolean {
  return key !== 'admin' && !user.modules.includes(key as Module);
}
// Las páginas de Cartelera y Dulcería comparten zona, periodo y franja: el menú los lleva de una a otra.
const FILTER_PAGES = MODULES.filter((m) => m.key === 'cartelera' || m.key === 'dulceria').flatMap((m) => m.pages);
const FILTER_KEYS = ['plaza', 'periodo', 'd0', 'd1', 'h0', 'h1', 'franja'];
// Con sesión, entrar y olvidé mandan a la cartelera. Restablecer sigue abierto: el enlace del correo puede ser de otra persona.
const SIGNED_OUT_ONLY = ['/entrar', '/olvide'];

const MOBILE = '@media (max-width: 768px)';

const useStyles = makeStyles({
  page: { backgroundColor: tokens.colorNeutralBackground2, minHeight: '100vh' },
  frame: { display: 'flex', minHeight: `calc(100vh - ${BAR_HEIGHT})`, backgroundColor: tokens.colorNeutralBackground3 },
  // El contenido es la superficie elevada (depth 16) sobre el panel y el riel, como en las consolas de Microsoft.
  surface: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    [MOBILE]: { boxShadow: 'none' },
    '@media print': { boxShadow: 'none' },
  },
  rail: {
    position: 'sticky',
    top: BAR_HEIGHT,
    height: `calc(100vh - ${BAR_HEIGHT})`,
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
    '@media print': { display: 'none' },
  },
  railSelected: { color: tokens.colorBrandForeground1, backgroundColor: tokens.colorBrandBackground2 },
  railLocked: { color: tokens.colorNeutralForegroundDisabled },
  // El candado va sobre la esquina del icono del módulo.
  lockable: { position: 'relative', display: 'inline-flex' },
  lock: {
    position: 'absolute',
    right: '-4px',
    bottom: '-4px',
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusCircular,
  },
  panel: {
    position: 'sticky',
    top: BAR_HEIGHT,
    height: `calc(100vh - ${BAR_HEIGHT})`,
    width: '220px',
    backgroundColor: tokens.colorNeutralBackground3,
    [MOBILE]: { display: 'none' },
    '@media print': { display: 'none' },
  },
  panelTitle: { fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  main: {
    flex: 1,
    minWidth: 0,
    maxWidth: '1120px',
    margin: '0 auto',
    padding: '2rem 32px 5rem',
    boxSizing: 'border-box',
    [MOBILE]: { padding: '1rem 16px 84px' },
  },
  mobilePages: { display: 'none', [MOBILE]: { display: 'flex', overflowX: 'auto', marginBottom: tokens.spacingVerticalL }, '@media print': { display: 'none' } },
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
    '@media print': { display: 'none' },
  },
  // En celular los módulos se reparten el ancho: icono arriba y nombre abajo, con "…" si no cabe.
  tab: {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    rowGap: '2px',
    padding: '6px 2px',
    // Fluent reserva el ancho del nombre en negritas. Aquí cada módulo ya tiene un ancho fijo.
    '& .fui-Tab__content--reserved-space': { display: 'none' },
    '& .fui-Tab__content': {
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontSize: tokens.fontSizeBase100,
    },
  },
});

function ModuleGlyph({ Icon, locked }: { Icon: Icon; locked: boolean }) {
  const s = useStyles();
  if (!locked) return <Icon />;
  return <span className={s.lockable}><Icon /><LockClosed12Filled className={s.lock} /></span>;
}

function href(key: PageKey): string {
  return HREF[key] ?? `/${key}/`;
}

function pageAt(path: string): PageKey {
  const keys = Object.keys(NAV_LABEL) as PageKey[];
  return keys.find((key) => href(key).replace(/\/$/, '') === path) ?? 'cartelera';
}

// El marco mientras `GET /api/yo` no responde: barra, riel, panel y una página de capas.
function ShellSkeleton() {
  const s = useStyles();
  return (
    <>
      <TopbarSkeleton />
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
    </>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const s = useStyles();
  const router = useRouter();
  const path = usePathname().replace(/\/$/, '') || '/';
  // undefined mientras `GET /api/yo` no responde.
  const [user, setUser] = React.useState<Profile | null | undefined>(undefined);
  // El módulo del diálogo de mejora; null es "Comunicarse con Ventas" y undefined, cerrado.
  const [upgrade, setUpgrade] = React.useState<Module | null | undefined>(undefined);
  const setTheme = useSetTheme();

  React.useEffect(() => {
    api<Profile>('/yo').then(setUser, () => setUser(null));
  }, []);
  React.useEffect(() => {
    if (user) setTheme(user.theme);
  }, [user, setTheme]);

  const modules = user
    ? MODULES.map((m) => ({ ...m, pages: m.pages.filter((key) => canSee(user, key)) })).filter((m) => m.pages.length)
    : [];
  const search = useSearchParams();
  const current = pageAt(path);
  // Configuración no pertenece a ningún módulo: no lleva panel.
  const active = modules.find((m) => m.pages.includes(current));
  const isPublic = isPublicPath(path);
  const redirect =
    user === null && !isPublic ? LOGIN_PATH
      : user && SIGNED_OUT_ONLY.includes(path) ? '/'
        : user && !canSee(user, current) ? '/'
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

  const link = (key: PageKey) => {
    const filters = new URLSearchParams();
    if (FILTER_PAGES.includes(current) && FILTER_PAGES.includes(key)) {
      for (const name of FILTER_KEYS) {
        const value = search.get(name);
        if (value !== null) filters.set(name, value);
      }
    }
    return filters.size ? `${href(key)}?${filters}` : href(key);
  };
  const go = (key: PageKey) => router.push(link(key));
  const open = (m: (typeof modules)[number]) => (isLocked(user, m.key) ? setUpgrade(m.key as Module) : go(m.pages[0]));
  const settings = () => go('configuracion');
  const firstLocked = (modules.find((m) => isLocked(user, m.key))?.key ?? null) as Module | null;
  const lockedHere = active && isLocked(user, active.key) ? (active.key as Module) : null;
  // La búsqueda lista las páginas de los módulos contratados y Configuración, que no está en ningún módulo.
  const entries: Entry<PageKey>[] = [
    ...modules.filter((m) => !isLocked(user, m.key))
      .flatMap((m) => m.pages.map((key) => ({ key, label: NAV_LABEL[key], group: MODULE_LABEL[m.key] }))),
    { key: 'configuracion', label: NAV_LABEL.configuracion, group: AUTH_TEXT.settings_title },
  ];
  return (
    <SessionContext.Provider value={session}>
      <Topbar user={user} entries={entries} onPick={go} onLogout={logout} onSettings={settings}
        onUpgrade={() => setUpgrade(firstLocked)} onSales={() => setUpgrade(null)} />
      <UpgradeDialog module={upgrade} onClose={() => setUpgrade(undefined)} />
      <div className={s.frame}>
        <nav className={s.rail}>
          {modules.map((m) => {
            const selected = m.key === active?.key;
            const locked = isLocked(user, m.key);
            const label = locked ? `${MODULE_LABEL[m.key]} · ${UPGRADE_TEXT.locked}` : MODULE_LABEL[m.key];
            return (
              <Tooltip key={m.key} content={label} relationship="label" positioning="after">
                <Button
                  appearance="subtle"
                  size="large"
                  icon={<ModuleGlyph Icon={selected ? m.iconSelected : m.icon} locked={locked} />}
                  aria-current={selected ? 'page' : undefined}
                  className={mergeClasses(locked && s.railLocked, selected && s.railSelected)}
                  onClick={() => open(m)}
                />
              </Tooltip>
            );
          })}
        </nav>
        {active && (
          <NavDrawer open type="inline" selectedValue={current} className={s.panel}>
            <NavDrawerHeader className={s.panelTitle}>{MODULE_LABEL[active.key]}</NavDrawerHeader>
            <NavDrawerBody>
              {active.pages.map((key) => {
                const PageIcon = PAGE_ICON[key];
                return (
                  <NavItem
                    key={key}
                    value={key}
                    href={link(key)}
                    icon={PageIcon && <PageIcon />}
                    onClick={(e) => { e.preventDefault(); go(key); }}
                  >
                    {NAV_LABEL[key]}
                  </NavItem>
                );
              })}
            </NavDrawerBody>
          </NavDrawer>
        )}
        <div className={s.surface}>
        <main className={s.main}>
          {active && active.pages.length > 1 && (
            <TabList className={s.mobilePages} size="small" selectedValue={current} onTabSelect={(_, data) => go(data.value as PageKey)}>
              {active.pages.map((key) => <Tab key={key} value={key}>{NAV_LABEL[key]}</Tab>)}
            </TabList>
          )}
          {lockedHere ? <LockedPage module={lockedHere} /> : children}
        </main>
        </div>
      </div>
      <TabList className={s.tabs} selectedValue={active?.key ?? null} onTabSelect={(_, data) => open(modules.find((m) => m.key === data.value)!)}>
        {modules.map((m) => {
          const ModuleIcon = m.key === active?.key ? m.iconSelected : m.icon;
          return <Tab key={m.key} value={m.key} icon={<ModuleGlyph Icon={ModuleIcon} locked={isLocked(user, m.key)} />} className={s.tab}>{MODULE_LABEL[m.key]}</Tab>;
        })}
      </TabList>
    </SessionContext.Provider>
  );
}
