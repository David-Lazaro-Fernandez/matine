'use client';

// La cuenta de la sesión, compartida por el marco (`components/shell.tsx`) y las páginas. Lo que muestra o esconde es
// solo comodidad: la API vuelve a revisar el rol y los módulos en cada petición.
import * as React from 'react';
import { useSetTheme } from '@/app/providers';
import { api, type Module, type Profile } from '@/lib/api';

export const SessionContext = React.createContext<{ user: Profile | null; setUser: (user: Profile | null) => void }>({
  user: null,
  setUser: () => {},
});

// La cuenta de la sesión, o null. Las pantallas de acceso la cambian con `setUser` al entrar o salir.
export function useSession() {
  return React.useContext(SessionContext);
}

// Guarda un cambio del perfil de la cuenta. El tema se aplica antes de la respuesta y se revierte si la API falla.
export function useSaveProfile() {
  const { user, setUser } = useSession();
  const setTheme = useSetTheme();
  return async (change: Partial<Profile>) => {
    if (!user) return;
    const next = { name: user.name, theme: user.theme, avatar: user.avatar, ...change };
    if (change.theme) setTheme(change.theme);
    try {
      setUser(await api<Profile>('/perfil', { name: next.name.trim(), theme: next.theme, avatar: next.avatar }));
    } catch (err) {
      setTheme(user.theme);
      throw err;
    }
  };
}

// Si la cuenta puede descargar CSV y PNG e imprimir.
export function useCanDownload() {
  return React.useContext(SessionContext).user?.can_download ?? false;
}

// Abre el diálogo de mejora de un módulo; null es "Comunicarse con Ventas". Lo provee el marco de la sesión.
export const UpgradeContext = React.createContext<(module: Module | null) => void>(() => {});

export function useUpgrade() {
  return React.useContext(UpgradeContext);
}
