'use client';

// Fila de acciones de una gráfica: los botones (descargas) a la izquierda y los enlaces a la derecha, separados.
// Cada acción trae su icono y su texto. Un botón recibe `onClick`; un enlace, `href`. En celular cada acción es solo
// su icono, en un cuadro fijo; el texto queda para escritorio.
import * as React from 'react';
import { Button, Link, Tooltip, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { useRouter } from 'next/navigation';

export type Boton = { label: string; icon: React.ReactElement; onClick: () => void };
export type Enlace = { label: string; icon: React.ReactElement; href: string };

const useStyles = makeStyles({
  fila: {
    '@media print': { display: 'none' },
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    width: '100%',
  },
  grupo: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  // El relleno del botón subtle deja su icono adentro; en escritorio se compensa para que quede en el borde del contenido.
  grupoInicio: { '@media (min-width: 769px)': { marginLeft: `calc(${tokens.spacingHorizontalS} * -1)` } },
  enlace: { display: 'inline-flex', alignItems: 'center', gap: tokens.spacingHorizontalXS, textDecoration: 'none' },
  soloEscritorio: { '@media (max-width: 768px)': { display: 'none' } },
  soloIcono: {
    '@media (max-width: 768px)': {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: '32px',
      height: '32px',
      minWidth: '32px',
      margin: 0,
      padding: '2px 3px',
      color: tokens.colorNeutralForeground1,
      backgroundColor: tokens.colorNeutralBackground2,
      border: 'none',
    },
  },
});

// Clases de un botón de solo icono para celular: `button` lo dibuja y `text` oculta su texto en celular.
export function useIconOnly() {
  const s = useStyles();
  return { button: s.soloIcono, text: s.soloEscritorio };
}

export function Acciones({ botones = [], enlaces = [] }: { botones?: Boton[]; enlaces?: Enlace[] }) {
  const s = useStyles();
  const iconOnly = useIconOnly();
  const router = useRouter();
  if (!botones.length && !enlaces.length) return null;
  return (
    <div className={s.fila}>
      <div className={mergeClasses(s.grupo, botones.length > 0 && s.grupoInicio)}>
        {botones.map((b) => (
          <Tooltip key={b.label} content={b.label} relationship="label">
            <Button className={iconOnly.button} appearance="subtle" size="small" icon={b.icon} aria-label={b.label} onClick={b.onClick}>
              <span className={iconOnly.text}>{b.label}</span>
            </Button>
          </Tooltip>
        ))}
      </div>
      <div className={s.grupo}>
        {enlaces.map((e) => (
          <Link key={e.label} href={e.href} aria-label={e.label} title={e.label} className={mergeClasses(s.enlace, iconOnly.button)}
                onClick={(ev) => { ev.preventDefault(); router.push(e.href); }}>
            {e.icon}
            <span className={iconOnly.text}>{e.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
