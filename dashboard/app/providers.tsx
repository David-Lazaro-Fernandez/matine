'use client';

// Proveedores de Fluent para el App Router, según la guía de SSR de Fluent v9 para Next.js.
// Los estilos van en el HTML exportado. Sin ellos, la página parpadea al hidratar.
import * as React from 'react';
import {
  FluentProvider,
  RendererProvider,
  SSRProvider,
  createDOMRenderer,
  renderToStyleElements,
} from '@fluentui/react-components';
import { useServerInsertedHTML } from 'next/navigation';
import { theme } from '@/lib/theme';

export function Providers({ children }: { children: React.ReactNode }) {
  const [renderer] = React.useState(() => createDOMRenderer());
  const didRenderRef = React.useRef(false);

  useServerInsertedHTML(() => {
    if (didRenderRef.current) return;
    didRenderRef.current = true;
    return <>{renderToStyleElements(renderer)}</>;
  });

  return (
    <RendererProvider renderer={renderer}>
      <SSRProvider>
        <FluentProvider theme={theme}>{children}</FluentProvider>
      </SSRProvider>
    </RendererProvider>
  );
}
