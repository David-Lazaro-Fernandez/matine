'use client';

// Marco de Configuración: sin riel de módulos. A la izquierda, el panel con las secciones de la cuenta y, para un admin,
// las del espacio de trabajo; a la derecha, la superficie elevada con la sección. En celular las secciones pasan a pestañas.
import * as React from 'react';
import { Divider, NavDrawer, NavDrawerBody, NavDrawerHeader, NavItem, NavSectionHeader, Tab, TabList, mergeClasses } from '@fluentui/react-components';
import { usePathname, useRouter } from 'next/navigation';
import { useFrameStyles } from '@/components/frame-styles';
import { settingsGroups } from '@/components/navigation';
import { AUTH_TEXT } from '@/lib/labels.generated';
import { useSession } from '@/lib/session';

export function SettingsFrame({ children }: { children: React.ReactNode }) {
  const s = useFrameStyles();
  const router = useRouter();
  const { user } = useSession();
  const path = usePathname().replace(/\/$/, '');
  if (!user) return null;

  const groups = settingsGroups(user);
  const sections = groups.flatMap((g) => g.sections);
  const go = (section: string) => router.push(`${section}/`);
  return (
    <div className={s.frame}>
      <NavDrawer open type="inline" selectedValue={path} className={s.panel}>
        <NavDrawerHeader className={s.panelTitle}>{AUTH_TEXT.settings_title}</NavDrawerHeader>
        <NavDrawerBody>
          {groups.map((g, i) => (
            <React.Fragment key={g.title}>
              {i > 0 && <Divider />}
              <NavSectionHeader>{g.title}</NavSectionHeader>
              {g.sections.map((section) => (
                <NavItem key={section.path} value={section.path} href={`${section.path}/`} icon={<section.icon />}
                  onClick={(e) => { e.preventDefault(); go(section.path); }}>
                  {section.label}
                </NavItem>
              ))}
            </React.Fragment>
          ))}
        </NavDrawerBody>
      </NavDrawer>
      <div className={s.surface}>
        <main className={mergeClasses(s.main, s.mainStart)}>
          {sections.length > 1 && (
            <TabList className={s.mobilePages} size="small" selectedValue={path} onTabSelect={(_, data) => go(data.value as string)}>
              {sections.map((section) => <Tab key={section.path} value={section.path}>{section.label}</Tab>)}
            </TabList>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
