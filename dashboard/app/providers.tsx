'use client';

// Proveedores de Fluent para el App Router, según la guía de SSR de Fluent v9 para Next.js.
// Los estilos van en el HTML exportado. Sin ellos, la página parpadea al hidratar.
import * as React from 'react';
import {
  FluentProvider,
  RendererProvider,
  SSRProvider,
  createDOMRenderer,
  makeStaticStyles,
  renderToStyleElements,
} from '@fluentui/react-components';
import { useServerInsertedHTML } from 'next/navigation';
import { DARK_DATA_COLOR } from '@/lib/labels.generated';
import { darkTheme, theme } from '@/lib/theme';

export type ThemeChoice = 'system' | 'light' | 'dark';
// El último tema de la cuenta, para pintar la primera vista con él antes de que responda `GET /api/yo`.
const THEME_KEY = 'ac_theme';

const ThemeContext = React.createContext<{ setTheme: (choice: ThemeChoice) => void; dark: boolean }>({
  setTheme: () => {},
  dark: false,
});

// Cambia el tema de toda la app. El shell lo llama con el tema de la cuenta y la configuración al elegir otro.
export function useSetTheme() {
  return React.useContext(ThemeContext).setTheme;
}

// Traduce un color de dato de `labels.py` al del tema actual, para lo que se pinta sobre el fondo de la interfaz.
// No se usa en las gráficas de Vega-Lite: van sobre `PAPER` también en tema oscuro.
export function useDataColor(): (color: string) => string {
  const { dark } = React.useContext(ThemeContext);
  return React.useCallback(
    (color: string) => (dark ? (DARK_DATA_COLOR as Record<string, string>)[color] ?? color : color),
    [dark],
  );
}

function readStoredTheme(): ThemeChoice {
  try {
    return (localStorage.getItem(THEME_KEY) as ThemeChoice | null) ?? 'system';
  } catch {
    return 'system';
  }
}

function usePrefersDark(): boolean {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    setDark(query.matches);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return dark;
}

// Un nombre de cine o un título sin espacios se parte antes de salirse de su caja.
// Fluent no deja que un RadioGroup horizontal pase a otro renglón. Con muchas opciones se sale de la pantalla.
// Un MessageBar empieza en un renglón sin cortes y se acomoda después. En celular, ese primer cuadro aleja la página.
const useGlobalStyles = makeStaticStyles({
  body: { overflowWrap: 'break-word' },
  '[role="radiogroup"]': { flexWrap: 'wrap' },
  '.fui-FluentProvider .fui-MessageBar': { whiteSpace: 'normal' },
});

function GlobalStyles() {
  useGlobalStyles();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [renderer] = React.useState(() => createDOMRenderer());
  const didRenderRef = React.useRef(false);
  const [choice, setChoice] = React.useState<ThemeChoice>('system');
  const prefersDark = usePrefersDark();
  React.useEffect(() => setChoice(readStoredTheme()), []);
  const setTheme = React.useCallback((next: ThemeChoice) => {
    setChoice(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  }, []);
  const dark = choice === 'dark' || (choice === 'system' && prefersDark);
  const themeValue = React.useMemo(() => ({ setTheme, dark }), [setTheme, dark]);

  useServerInsertedHTML(() => {
    if (didRenderRef.current) return;
    didRenderRef.current = true;
    return <>{renderToStyleElements(renderer)}</>;
  });

  return (
    <RendererProvider renderer={renderer}>
      <SSRProvider>
        <FluentProvider theme={dark ? darkTheme : theme}>
          <ThemeContext.Provider value={themeValue}>
            <GlobalStyles />
            {children}
          </ThemeContext.Provider>
        </FluentProvider>
      </SSRProvider>
    </RendererProvider>
  );
}
