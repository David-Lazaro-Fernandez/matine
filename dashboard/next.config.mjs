import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

// En producción, Caddy pasa `/api/*` a la API interna. En `pnpm dev`, Next la reenvía a uvicorn en el puerto 8501, o en el de `AC_API_PORT` si otro worktree usa ese.
// La exportación estática no admite reenvíos, por eso cada fase lleva su configuración.
export default function config(phase) {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      async rewrites() {
        return [{ source: '/api/:path*', destination: `http://127.0.0.1:${process.env.AC_API_PORT ?? 8501}/api/:path*` }];
      },
    };
  }
  return { output: 'export', trailingSlash: true };
}
