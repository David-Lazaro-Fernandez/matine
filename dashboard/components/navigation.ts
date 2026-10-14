// Qué páginas hay, cómo se agrupan en módulos y quién las ve. Lo comparten el marco de la sesión, el de los módulos y el
// de Configuración.
import type * as React from 'react';
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
  History20Regular,
  Lightbulb20Regular,
  Location20Regular,
  Map20Regular,
  MoviesAndTv24Filled,
  MoviesAndTv24Regular,
  Money20Regular,
  Organization20Regular,
  Building20Regular,
  People20Regular,
  Person20Regular,
  PlugConnected20Regular,
  Settings20Regular,
  Settings24Filled,
  Settings24Regular,
  TicketDiagonal20Regular,
  VehicleTruckProfile20Regular,
  VideoClip20Regular,
} from '@fluentui/react-icons';
import type { Module, Profile } from '@/lib/api';
import { AUTH_TEXT, MODULE_LABEL, NAV_LABEL } from '@/lib/labels.generated';

export type PageKey = keyof typeof NAV_LABEL;
export type ModuleKey = keyof typeof MODULE_LABEL;
export type Icon = React.ComponentType<{ className?: string }>;
type SettingsSection = { path: string; label: string; icon: Icon };

// Cada módulo se contrata aparte: Cartelera trae las páginas de películas, Dulcería las de precios de dulcería.
// Las páginas van por valor para el negocio: primero lo que decide la programación de la semana, al final las consultas.
// ¿A dónde ir? no va en el menú porque es la demo para el público. Su página sigue en /recomendador/.
export const MODULES: { key: ModuleKey; icon: Icon; iconSelected: Icon; pages: PageKey[] }[] = [
  { key: 'cartelera', icon: MoviesAndTv24Regular, iconSelected: MoviesAndTv24Filled, pages: ['cartelera', 'programacion', 'preventa', 'cines', 'precios', 'distribuidoras', 'mapa', 'independientes', 'historial'] },
  { key: 'dulceria', icon: Food24Regular, iconSelected: Food24Filled, pages: ['dulceria', 'domicilio'] },
  { key: 'datos', icon: Database24Regular, iconSelected: Database24Filled, pages: ['datos'] },
  { key: 'admin', icon: Settings24Regular, iconSelected: Settings24Filled, pages: ['operaciones'] },
];
// Configuración lleva su propio panel: las secciones de la cuenta y, para un admin, las del espacio de trabajo.
const SETTINGS: { title: string; admin: boolean; sections: SettingsSection[] }[] = [
  { title: AUTH_TEXT.settings_account, admin: false, sections: [{ path: '/configuracion', label: AUTH_TEXT.profile, icon: Person20Regular }] },
  {
    title: AUTH_TEXT.settings_workspace,
    admin: true,
    sections: [
      { path: '/configuracion/general', label: AUTH_TEXT.workspace_general, icon: Building20Regular },
      { path: '/configuracion/personas', label: AUTH_TEXT.people, icon: People20Regular },
      { path: '/configuracion/integraciones', label: AUTH_TEXT.integrations, icon: PlugConnected20Regular },
    ],
  },
];
export const PAGE_ICON: Partial<Record<PageKey, Icon>> = {
  cartelera: Lightbulb20Regular,
  programacion: DataBarVertical20Regular,
  preventa: TicketDiagonal20Regular,
  precios: Money20Regular,
  cines: BuildingMultiple20Regular,
  historial: History20Regular,
  mapa: Map20Regular,
  recomendador: Location20Regular,
  independientes: VideoClip20Regular,
  distribuidoras: Organization20Regular,
  dulceria: BuildingShop20Regular,
  domicilio: VehicleTruckProfile20Regular,
  datos: Database20Regular,
  operaciones: HeartPulse20Regular,
  configuracion: Settings20Regular,
};
export const HREF: Partial<Record<PageKey, string>> = { cartelera: '/', domicilio: '/dulceria/domicilio/' };
// Operaciones y Distribuidoras son solo del equipo de la plataforma: Distribuidoras todavía no se vende.
export function canSee(user: Profile, key: PageKey): boolean {
  if (key === 'operaciones' || key === 'distribuidoras') return user.role === 'staff';
  return true;
}
export function isLocked(user: Profile, key: ModuleKey): boolean {
  return key !== 'admin' && !user.modules.includes(key as Module);
}
// Las páginas de Cartelera y Dulcería comparten zona, periodo y franja: el menú los lleva de una a otra.
export const FILTER_PAGES = MODULES.filter((m) => m.key === 'cartelera' || m.key === 'dulceria').flatMap((m) => m.pages);
export const FILTER_KEYS = ['plaza', 'periodo', 'd0', 'd1', 'h0', 'h1', 'franja'];

export function href(key: PageKey): string {
  return HREF[key] ?? `/${key}/`;
}

export function pageAt(path: string): PageKey {
  const keys = Object.keys(NAV_LABEL) as PageKey[];
  return keys.find((key) => href(key).replace(/\/$/, '') === path) ?? 'cartelera';
}

// Enlace a una página que lleva los filtros de la URL cuando se pasa de una página de Cartelera o Dulcería a otra.
export function pageLink(key: PageKey, current: PageKey, search: URLSearchParams): string {
  const filters = new URLSearchParams();
  if (FILTER_PAGES.includes(current) && FILTER_PAGES.includes(key)) {
    for (const name of FILTER_KEYS) {
      const value = search.get(name);
      if (value !== null) filters.set(name, value);
    }
  }
  return filters.size ? `${href(key)}?${filters}` : href(key);
}

// Las secciones de Configuración que ve la cuenta, agrupadas.
export function settingsGroups(user: Profile) {
  return SETTINGS.filter((g) => !g.admin || user.can_manage);
}
