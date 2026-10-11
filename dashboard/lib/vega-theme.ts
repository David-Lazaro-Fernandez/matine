// Estilo común de las gráficas de Vega-Lite. Es el mismo que `chart()` de ui/common.py aplica a Altair.
import type { Config } from 'vega-lite';
import { GRAY, GRID, LINE, PAPER } from './labels.generated';
import { theme } from './theme';

export const vegaConfig: Config = {
  font: theme.fontFamilyBase,
  background: PAPER,
  view: { strokeWidth: 0 },
  axis: {
    labelColor: GRAY,
    titleColor: GRAY,
    gridColor: GRID,
    domainColor: LINE,
    tickColor: LINE,
    labelFontSize: 12,
    titleFontSize: 12,
    titleFontWeight: 'normal',
  },
  legend: { labelColor: GRAY, labelFontSize: 12.5, symbolSize: 70 },
};
