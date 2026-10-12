'use client';

// La cuenta de la sesión, compartida por el marco (`components/shell.tsx`) y las páginas. Lo que muestra o esconde es
// solo comodidad: la API vuelve a revisar el rol y los módulos en cada petición.
import * as React from 'react';
import type { Profile } from '@/lib/api';

export const SessionContext = React.createContext<{ user: Profile | null; setUser: (user: Profile | null) => void }>({
  user: null,
  setUser: () => {},
});

// La cuenta de la sesión, o null. Las pantallas de acceso la cambian con `setUser` al entrar o salir.
export function useSession() {
  return React.useContext(SessionContext);
}

// Si la cuenta puede descargar CSV y PNG e imprimir.
export function useCanDownload() {
  return React.useContext(SessionContext).user?.can_download ?? false;
}
