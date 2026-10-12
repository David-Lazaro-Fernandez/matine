// Tema claro de Fluent tal cual (webLightTheme): marca azul, neutros y tipografía Segoe de Fluent.
// El oscuro usa la marca roja clara de `DARK_BRAND`. Los colores de las gráficas siguen en analytics/labels.py (DESIGN.md).
import { createDarkTheme, webLightTheme, type BrandVariants, type Theme } from '@fluentui/react-components';
import { DARK_BRAND, DARK_NAV_ITEM } from './labels.generated';

const darkBrand = Object.fromEntries(DARK_BRAND.map((hex, i) => [(i + 1) * 10, hex])) as unknown as BrandVariants;

export const theme: Theme = webLightTheme;
// Los renglones del panel de navegación usan `colorNeutralBackground4`.
export const darkTheme: Theme = { ...createDarkTheme(darkBrand), colorNeutralBackground4: DARK_NAV_ITEM };
