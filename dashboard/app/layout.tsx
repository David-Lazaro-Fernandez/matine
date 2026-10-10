import type { Metadata } from 'next';
import { ZONE_TEXT } from '@/lib/labels.generated';
import { Providers } from './providers';

export const metadata: Metadata = { title: ZONE_TEXT.page_title };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,400..900;1,62..125,400..900&display=swap"
        />
      </head>
      <body style={{ margin: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
