'use client';

// Navegación y sesión, como app.py de Streamlit. Las páginas visibles salen del rol de `GET /api/yo`.
// Sin sesión solo existen entrar, olvidé y restablecer. Una ruta que no corresponde al rol manda a la cartelera.
// Escritorio: NavDrawer a la izquierda. Celular: TabList fija abajo, al alcance del pulgar.
import * as React from 'react';
import {
  Button,
  NavDrawer,
  NavDrawerBody,
  NavDrawerFooter,
  NavDrawerHeader,
  NavItem,
  Tab,
  TabList,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import { usePathname, useRouter } from 'next/navigation';
import { LOGIN_PATH, api, isPublicPath, type Me } from '@/lib/api';
import { AUTH_TEXT, GRAY, GRAY_LIGHT, INK, LINE, PAGE_LABEL, PAPER, ROLE_LABEL } from '@/lib/labels.generated';

type PageKey = keyof typeof PAGE_LABEL;
const PAGES: PageKey[] = ['cartelera', 'mapa', 'recomendador', 'dulceria', 'independientes', 'datos'];
const ADMIN_PAGES: PageKey[] = ['usuarios', 'operaciones'];
// Con sesión, entrar y olvidé mandan a la cartelera. Restablecer sigue abierto: el enlace del correo puede ser de otra persona.
const SIGNED_OUT_ONLY = ['/entrar', '/olvide'];

const MOBILE = '@media (max-width: 768px)';

const useStyles = makeStyles({
  page: { backgroundColor: GRAY_LIGHT, minHeight: '100vh' },
  frame: { display: 'flex', minHeight: '100vh' },
  drawer: { position: 'sticky', top: 0, height: '100vh', [MOBILE]: { display: 'none' } },
  brand: { fontWeight: 850, fontStretch: '75%', fontSize: '22px', color: INK },
  account: { fontSize: '13px', color: GRAY, lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  accountName: { color: INK, fontWeight: 700 },
  main: {
    flex: 1,
    minWidth: 0,
    maxWidth: '1120px',
    margin: '0 auto',
    padding: '2.4rem 24px 5rem',
    boxSizing: 'border-box',
    [MOBILE]: { padding: '1.2rem 16px 84px' },
  },
  mobileAccount: { display: 'none', [MOBILE]: { display: 'flex', marginBottom: tokens.spacingVerticalL } },
  tabs: {
    display: 'none',
    [MOBILE]: {
      display: 'flex',
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      overflowX: 'auto',
      backgroundColor: PAPER,
      borderTop: `1px solid ${LINE}`,
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
  return key === 'cartelera' ? '/' : `/${key}/`;
}

function Account({ user, onLogout }: { user: Me; onLogout: () => void }) {
  const s = useStyles();
  return (
    <div className={s.account}>
      <span>
        {AUTH_TEXT.signed_in_as} <span className={s.accountName}>{user.name}</span>
        <br />
        <small>{user.email} · {ROLE_LABEL[user.role as keyof typeof ROLE_LABEL] ?? user.role}</small>
      </span>
      <Button size="small" onClick={onLogout}>{AUTH_TEXT.logout}</Button>
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

  const pages = user?.role === 'admin' ? [...PAGES, ...ADMIN_PAGES] : PAGES;
  const current = (path.slice(1) || 'cartelera') as PageKey;
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

  if (user === undefined || redirect) return null;
  const session = { user, setUser };
  if (!user) {
    return <SessionContext.Provider value={session}><div className={s.page}>{children}</div></SessionContext.Provider>;
  }

  const go = (key: PageKey) => router.push(href(key));
  return (
    <SessionContext.Provider value={session}>
      <div className={mergeClasses(s.page, s.frame)}>
        <NavDrawer open type="inline" selectedValue={current} className={s.drawer}>
          <NavDrawerHeader className={s.brand}>{AUTH_TEXT.app_name}</NavDrawerHeader>
          <NavDrawerBody>
            {pages.map((key) => (
              <NavItem key={key} value={key} href={href(key)} onClick={(e) => { e.preventDefault(); go(key); }}>
                {PAGE_LABEL[key]}
              </NavItem>
            ))}
          </NavDrawerBody>
          <NavDrawerFooter>
            <Account user={user} onLogout={logout} />
          </NavDrawerFooter>
        </NavDrawer>
        <main className={s.main}>
          <div className={s.mobileAccount}>
            <Account user={user} onLogout={logout} />
          </div>
          {children}
        </main>
      </div>
      <TabList className={s.tabs} selectedValue={current} onTabSelect={(_, data) => go(data.value as PageKey)}>
        {pages.map((key) => <Tab key={key} value={key}>{PAGE_LABEL[key]}</Tab>)}
      </TabList>
    </SessionContext.Provider>
  );
}
