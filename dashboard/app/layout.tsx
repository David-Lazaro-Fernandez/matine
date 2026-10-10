import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ZONE_TEXT } from '@/lib/labels.generated';
import { Shell } from '@/components/shell';
import { Providers } from './providers';

export const metadata: Metadata = { title: ZONE_TEXT.page_title };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>
        <Providers>
          {/* Los filtros leen la URL con useSearchParams. La exportación estática pide un Suspense arriba. */}
          <Suspense>
            <Shell>{children}</Shell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
