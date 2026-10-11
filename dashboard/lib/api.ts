// Llamadas a la API interna (`api/internal.py`), servida en el mismo dominio bajo `/api`.
// La cookie de sesión es HttpOnly: el navegador la manda solo y aquí nunca se lee.
// ponytail: tipos escritos a mano. Pasan a `api.generated.ts` (openapi-typescript) cuando el paquete esté instalado.

export type Me = { id: number; email: string; name: string; role: string };
export type TokenInfo = { purpose: 'invite' | 'reset'; email: string };

// Las páginas que existen sin sesión. Las demás mandan a entrar si la API responde 401.
export const PUBLIC_PATHS = ['/entrar', '/olvide', '/restablecer'];
export const LOGIN_PATH = '/entrar/';

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

// `detail` es el texto para el usuario que pone la API (sale de AUTH_TEXT), o null si la respuesta no trae uno.
export class ApiError extends Error {
  status: number;
  detail: string | null;

  constructor(status: number, detail: string | null) {
    super(detail ?? String(status));
    this.status = status;
    this.detail = detail;
  }
}

// Parámetros de consulta sin los vacíos: query({ plaza: null, d0: '2026-10-10' }) → '?d0=2026-10-10'.
// Así nacional viaja como la ausencia de `plaza`, la convención de todos los endpoints.
export function query(params: Record<string, string | number | null | undefined>): string {
  const kept = Object.entries(params).filter(([, v]) => v != null && v !== '') as [string, string][];
  return kept.length ? `?${new URLSearchParams(kept)}` : '';
}

// GET a `/api{path}`, o POST con `body` en JSON. Devuelve el JSON de la respuesta, o undefined si es 204.
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401 && !isPublicPath(window.location.pathname)) {
    window.location.assign(LOGIN_PATH);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, typeof data?.detail === 'string' ? data.detail : null);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
