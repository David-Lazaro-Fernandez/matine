'use client';

// Búsqueda de secciones con ⌘K o Ctrl K. El botón parece un campo; el diálogo filtra las páginas que la cuenta puede ver.
// Escribir varias palabras busca cada una en el nombre de la página o de su módulo, sin importar acentos ni mayúsculas.
import * as React from 'react';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  Input,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import { Search20Regular } from '@fluentui/react-icons';
import { SHELL_TEXT } from '@/lib/labels.generated';

export type Entry<K extends string> = { key: K; label: string; group: string };

const useStyles = makeStyles({
  trigger: {
    width: '100%',
    maxWidth: '420px',
    justifyContent: 'flex-start',
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground3,
    fontWeight: tokens.fontWeightRegular,
    minWidth: 0,
    '@media (max-width: 768px)': { width: 'auto', maxWidth: 'none' },
  },
  triggerLabel: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' },
  shortcut: {
    flexShrink: 0,
    padding: '0 6px',
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: tokens.fontSizeBase100,
    fontVariantNumeric: 'tabular-nums',
    '@media (max-width: 768px)': { display: 'none' },
  },
  // En celular solo queda la lupa: el campo ocupa lo que sobra de la barra.
  // En celular el campo se reduce a la lupa, para que quede justo al centro de la barra.
  triggerText: { '@media (max-width: 768px)': { display: 'none' } },
  dialog: { maxWidth: '560px', width: 'calc(100vw - 32px)' },
  list: { display: 'flex', flexDirection: 'column', gap: '2px', marginTop: tokens.spacingVerticalS, maxHeight: '60vh', overflowY: 'auto' },
  option: { justifyContent: 'flex-start', minWidth: 0, fontWeight: tokens.fontWeightRegular },
  optionActive: { backgroundColor: tokens.colorNeutralBackground1Hover },
  optionLabel: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' },
  group: { flexShrink: 0, color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, paddingLeft: tokens.spacingHorizontalM },
  empty: { color: tokens.colorNeutralForeground3, padding: tokens.spacingVerticalS },
});

// Minúsculas y sin acentos: "a donde ir" encuentra "¿A dónde ir?".
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function matches<K extends string>(entry: Entry<K>, query: string): boolean {
  const haystack = normalize(`${entry.label} ${entry.group}`);
  return normalize(query).split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

export function CommandPalette<K extends string>({ entries, onPick }: { entries: Entry<K>[]; onPick: (key: K) => void }) {
  const s = useStyles();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  // Mac muestra ⌘K. El valor inicial sirve al renderizar en el servidor, sin `navigator`.
  const [shortcut, setShortcut] = React.useState<string>(SHELL_TEXT.shortcut_other);
  React.useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut(SHELL_TEXT.shortcut_mac);
  }, []);

  React.useEffect(() => {
    const toggle = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setOpen((isOpen) => !isOpen);
    };
    window.addEventListener('keydown', toggle);
    return () => window.removeEventListener('keydown', toggle);
  }, []);

  const results = entries.filter((entry) => matches(entry, query));
  const changeOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    setQuery('');
    setActive(0);
  };
  const pick = (key: K) => {
    changeOpen(false);
    onPick(key);
  };
  const moveActive = (step: number) => {
    if (!results.length) return;
    setActive((index) => (index + step + results.length) % results.length);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') moveActive(1);
    else if (e.key === 'ArrowUp') moveActive(-1);
    else if (e.key === 'Enter' && results[active]) pick(results[active].key);
    else return;
    e.preventDefault();
  };

  return (
    <>
      <Button
        appearance="subtle"
        className={s.trigger}
        icon={<Search20Regular />}
        aria-label={SHELL_TEXT.search}
        onClick={() => setOpen(true)}
      >
        <span className={mergeClasses(s.triggerLabel, s.triggerText)}>{SHELL_TEXT.search}</span>
        <span className={s.shortcut} aria-hidden>{shortcut}</span>
      </Button>
      <Dialog open={open} onOpenChange={(_, data) => changeOpen(data.open)}>
        <DialogSurface className={s.dialog} aria-label={SHELL_TEXT.search}>
          <DialogBody>
            <DialogContent>
              <Input
                autoFocus
                placeholder={SHELL_TEXT.search}
                contentBefore={<Search20Regular />}
                value={query}
                onChange={(_, data) => {
                  setQuery(data.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                role="combobox"
                aria-expanded
                aria-controls="command-palette-list"
                aria-activedescendant={results[active] ? `command-palette-${results[active].key}` : undefined}
              />
              <div id="command-palette-list" role="listbox" className={s.list}>
                {results.length === 0 && <Text className={s.empty}>{SHELL_TEXT.no_results}</Text>}
                {results.map((entry, index) => (
                  <Button
                    key={entry.key}
                    id={`command-palette-${entry.key}`}
                    role="option"
                    aria-selected={index === active}
                    appearance="subtle"
                    className={mergeClasses(s.option, index === active && s.optionActive)}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => pick(entry.key)}
                  >
                    <span className={s.optionLabel}>{entry.label}</span>
                    <span className={s.group}>{entry.group}</span>
                  </Button>
                ))}
              </div>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
