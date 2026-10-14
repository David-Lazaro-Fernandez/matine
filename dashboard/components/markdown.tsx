'use client';

// Texto en Markdown de una respuesta del asistente. `react-markdown` no interpreta HTML crudo: lo que escriba el modelo
// solo puede ser formato, nunca etiquetas.
import * as React from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AGENT_UI } from '@/lib/labels.generated';

const useStyles = makeStyles({
  root: {
    overflowWrap: 'anywhere',
    '& > :first-child': { marginTop: 0 },
    '& > :last-child': { marginBottom: 0 },
    '& p, & ul, & ol': { margin: `${tokens.spacingVerticalS} 0` },
    '& ul, & ol': { paddingLeft: tokens.spacingHorizontalXXL },
    '& table': { borderCollapse: 'collapse', display: 'block', overflowX: 'auto', margin: `${tokens.spacingVerticalS} 0` },
    '& th, & td': { padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`, border: `1px solid ${tokens.colorNeutralStroke2}`, textAlign: 'left' },
    '& th': { backgroundColor: tokens.colorNeutralBackground3, fontWeight: tokens.fontWeightSemibold },
    '& .window': {
      fontWeight: 300,
      fontSize: tokens.fontSizeBase200,
      color: tokens.colorNeutralForeground4,
      '& strong, & em': { fontWeight: 'inherit' },
    },
    '& code': { fontFamily: tokens.fontFamilyMonospace, backgroundColor: tokens.colorNeutralBackground3, padding: '0 4px', borderRadius: tokens.borderRadiusSmall },
  },
});

function textOf(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

// La línea "Ventana medida: …" va aparte y con menos peso: es contexto de la cifra, no la respuesta.
const components = {
  p: ({ children }: { children?: React.ReactNode }) =>
    <p className={textOf(children).trimStart().startsWith(AGENT_UI.window_label) ? 'window' : undefined}>{children}</p>,
};

export function Markdown({ children }: { children: string }) {
  return <div className={useStyles().root}><ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children}</ReactMarkdown></div>;
}
