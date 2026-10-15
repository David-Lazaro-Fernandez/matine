// Estilos de los marcos de la aplicación: barra, riel, panel y superficie elevada (depth 16) con el contenido.
import { makeStyles, tokens } from '@fluentui/react-components';
import { BAR_HEIGHT } from '@/components/topbar';

const MOBILE = '@media (max-width: 768px)';

export const useFrameStyles = makeStyles({
  page: { backgroundColor: tokens.colorNeutralBackground2, minHeight: '100vh' },
  frame: { display: 'flex', minHeight: `calc(100vh - ${BAR_HEIGHT})`, backgroundColor: tokens.colorNeutralBackground3 },
  // El contenido es la superficie elevada (depth 16) sobre el panel y el riel, como en las consolas de Microsoft.
  surface: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    [MOBILE]: { boxShadow: 'none' },
    '@media print': { boxShadow: 'none' },
  },
  rail: {
    position: 'sticky',
    top: BAR_HEIGHT,
    height: `calc(100vh - ${BAR_HEIGHT})`,
    width: '56px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalL} 0`,
    boxSizing: 'border-box',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    [MOBILE]: { display: 'none' },
    '@media print': { display: 'none' },
  },
  railSelected: { color: tokens.colorBrandForeground1, backgroundColor: tokens.colorBrandBackground2 },
  railLocked: { color: tokens.colorNeutralForegroundDisabled },
  // El candado va sobre la esquina del icono del módulo.
  lockable: { position: 'relative', display: 'inline-flex' },
  lock: {
    position: 'absolute',
    right: '-4px',
    bottom: '-4px',
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusCircular,
  },
  panel: {
    position: 'sticky',
    top: BAR_HEIGHT,
    height: `calc(100vh - ${BAR_HEIGHT})`,
    width: '220px',
    backgroundColor: tokens.colorNeutralBackground3,
    [MOBILE]: { display: 'none' },
    '@media print': { display: 'none' },
  },
  panelTitle: { fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  main: {
    flex: 1,
    minWidth: 0,
    maxWidth: '1120px',
    margin: '0 auto',
    padding: '2rem 32px 5rem',
    boxSizing: 'border-box',
    [MOBILE]: { padding: '1rem 16px 84px' },
  },
  // Configuración pega el contenido al panel en vez de centrarlo.
  mainStart: { margin: 0 },
  mobilePages: { display: 'none', [MOBILE]: { display: 'flex', overflowX: 'auto', marginBottom: tokens.spacingVerticalL }, '@media print': { display: 'none' } },
  tabs: {
    display: 'none',
    [MOBILE]: {
      display: 'flex',
      justifyContent: 'space-around',
      gap: 0,
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      backgroundColor: tokens.colorNeutralBackground1,
      borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
      padding: '4px 0 8px',
    },
    '@media print': { display: 'none' },
  },
  // En celular los módulos se reparten el ancho: icono arriba y nombre abajo, con "…" si no cabe.
  tab: {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    rowGap: '2px',
    padding: '6px 0',
    // El nombre en negritas del módulo activo es más ancho que su casilla; se recorta en vez de salirse.
    '&.fui-Tab': { overflow: 'hidden' },
    // Fluent reserva el ancho del nombre en negritas. Aquí cada módulo ya tiene un ancho fijo.
    '& .fui-Tab__content--reserved-space': { display: 'none' },
    '& .fui-Tab__content': {
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontSize: '10px',
    },
  },
});
