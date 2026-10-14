'use client';

// Marco de las páginas de los módulos. Escritorio: riel de módulos con iconos y panel con las páginas del módulo.
// Celular: módulos abajo, páginas arriba. Un módulo no contratado se ve con candado y abre el diálogo de mejora; su
// página muestra el mismo aviso.
import * as React from 'react';
import { Button, NavDrawer, NavDrawerBody, NavDrawerHeader, NavItem, Tab, TabList, Tooltip, mergeClasses } from '@fluentui/react-components';
import { LockClosed12Filled } from '@fluentui/react-icons';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFrameStyles } from '@/components/frame-styles';
import { MODULES, PAGE_ICON, canSee, isLocked, pageAt, pageLink, type Icon, type PageKey } from '@/components/navigation';
import { LockedPage } from '@/components/upgrade';
import type { Module } from '@/lib/api';
import { MODULE_LABEL, NAV_LABEL, UPGRADE_TEXT } from '@/lib/labels.generated';
import { useSession, useUpgrade } from '@/lib/session';

function ModuleGlyph({ Icon, locked }: { Icon: Icon; locked: boolean }) {
  const s = useFrameStyles();
  if (!locked) return <Icon />;
  return <span className={s.lockable}><Icon /><LockClosed12Filled className={s.lock} /></span>;
}

export function ModuleFrame({ children }: { children: React.ReactNode }) {
  const s = useFrameStyles();
  const router = useRouter();
  const search = useSearchParams();
  const setUpgrade = useUpgrade();
  const { user } = useSession();
  const path = usePathname().replace(/\/$/, '') || '/';
  if (!user) return null;

  const modules = MODULES.map((m) => ({ ...m, pages: m.pages.filter((key) => canSee(user, key)) })).filter((m) => m.pages.length);
  const current = pageAt(path);
  const active = modules.find((m) => m.pages.includes(current));
  const link = (key: PageKey) => pageLink(key, current, search);
  const go = (key: PageKey) => router.push(link(key));
  const open = (m: (typeof modules)[number]) => (isLocked(user, m.key) ? setUpgrade(m.key as Module) : go(m.pages[0]));
  const lockedHere = active && isLocked(user, active.key) ? (active.key as Module) : null;
  return (
    <>
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
    </>
  );
}
