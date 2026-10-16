'use client';

// Sesión y barra, como app.py de Streamlit. Lo visible sale de `GET /api/yo`: los módulos de la organización y el rol.
// Sin sesión solo existen entrar, olvidé y restablecer. Una página de administración que no corresponde al rol manda a la
// cartelera. El marco de cada zona (módulos o Configuración) es el layout de su ruta: `module-frame.tsx` y `settings-frame.tsx`.
import * as React from 'react';
import { Skeleton, SkeletonItem, tokens } from '@fluentui/react-components';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SkeletonCapas, SkeletonLines } from '@/components/common';
import { useSetTheme } from '@/app/providers';
import { type Entry } from '@/components/command-palette';
import { useFrameStyles } from '@/components/frame-styles';
import { MODULES, PAGE_ICON, canSee, isLocked, pageAt, pageLink, settingsGroups, type PageKey } from '@/components/navigation';
import { Topbar, TopbarSkeleton } from '@/components/topbar';
import { UpgradeDialog } from '@/components/upgrade';
import { LOGIN_PATH, api, isPublicPath, type Module, type Profile } from '@/lib/api';
import { AUTH_TEXT, MODULE_LABEL, NAV_LABEL } from '@/lib/labels.generated';
import { SessionContext, UpgradeContext } from '@/lib/session';

// Con sesión, entrar y olvidé mandan a la cartelera. Restablecer sigue abierto: el enlace del correo puede ser de otra persona.
const SIGNED_OUT_ONLY = ['/entrar', '/olvide'];

// El marco mientras `GET /api/yo` no responde: barra, riel, panel y una página de capas.
function ShellSkeleton() {
  const s = useFrameStyles();
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
  const s = useFrameStyles();
  const router = useRouter();
  const path = usePathname().replace(/\/$/, '') || '/';
  const search = useSearchParams();
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
  const current = pageAt(path);
  const inSettings = path.startsWith('/configuracion');
  const isPublic = isPublicPath(path);
  const redirect =
    user === null && !isPublic ? LOGIN_PATH
      : user && SIGNED_OUT_ONLY.includes(path) ? '/'
        : user && !inSettings && !canSee(user, current) ? '/'
          : user && inSettings && path !== '/configuracion'
            && !settingsGroups(user).some((g) => g.sections.some((section) => section.path === path)) ? '/configuracion/'
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

  const go = (key: PageKey) => router.push(pageLink(key, current, search));
  const firstLocked = (modules.find((m) => isLocked(user, m.key))?.key ?? null) as Module | null;
  // La búsqueda lista las páginas de los módulos contratados y Configuración, que no está en ningún módulo.
  const entries: Entry<PageKey>[] = [
    ...modules.filter((m) => !isLocked(user, m.key))
      .flatMap((m) => m.pages.map((key) => ({ key, label: NAV_LABEL[key], group: MODULE_LABEL[m.key], icon: PAGE_ICON[key] }))),
    { key: 'configuracion', label: NAV_LABEL.configuracion, group: AUTH_TEXT.settings_title, icon: PAGE_ICON.configuracion },
  ];
  return (
    <SessionContext.Provider value={session}>
      <UpgradeContext.Provider value={setUpgrade}>
        <Topbar user={user} entries={entries} onPick={go} onLogout={logout} onSettings={() => go('configuracion')}
          onUpgrade={() => setUpgrade(firstLocked)} onSales={() => setUpgrade(null)} />
        <UpgradeDialog module={upgrade} onClose={() => setUpgrade(undefined)} />
        {children}
      </UpgradeContext.Provider>
    </SessionContext.Provider>
  );
}
