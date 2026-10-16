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
import { ArrowDown16Regular, ArrowEnter16Regular, ArrowUp16Regular, QuestionCircle20Regular, Search20Regular } from '@fluentui/react-icons';
import type { Icon } from '@/components/navigation';
import { HELP_TEXT, HELP_TOPICS, SHELL_TEXT } from '@/lib/labels.generated';

export type Entry<K extends string> = { key: K; label: string; group: string; icon?: Icon };

// Una fila del diálogo: una página o una guía de ayuda. `section` agrupa y `tag` va a la derecha.
type Row = { id: string; label: string; section: string; tag?: string; icon?: Icon; run: () => void };

const HELP_EVENT = 'help-open';

// Abre el centro de ayuda en una guía; el cajón de `help-drawer.tsx` escucha este aviso.
export function openHelp(guideKey: string) {
  window.dispatchEvent(new CustomEvent(HELP_EVENT, { detail: guideKey }));
}
export { HELP_EVENT };

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
  dialog: { maxWidth: '600px', width: 'calc(100vw - 32px)', padding: 0, borderRadius: tokens.borderRadiusXLarge, overflow: 'hidden' },
  body: { display: 'flex', flexDirection: 'column', padding: 0, gap: 0 },
  input: {
    width: '100%',
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXL}`,
    border: 'none',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: 0,
    backgroundColor: 'transparent',
    fontSize: tokens.fontSizeBase400,
    '::after': { display: 'none' },
  },
  list: { display: 'flex', flexDirection: 'column', gap: '2px', padding: tokens.spacingHorizontalS, maxHeight: '60vh', overflowY: 'auto' },
  option: {
    justifyContent: 'flex-start',
    minWidth: 0,
    minHeight: '40px',
    gap: tokens.spacingHorizontalM,
    padding: `0 ${tokens.spacingHorizontalM}`,
    fontWeight: tokens.fontWeightSemibold,
  },
  optionActive: { backgroundColor: tokens.colorNeutralBackground1Hover },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalXL}`,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    '@media (max-width: 768px)': { display: 'none' },
  },
  hint: { display: 'inline-flex', alignItems: 'center', gap: tokens.spacingHorizontalXS },
  key: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 6px',
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  optionLabel: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' },
  section: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM} ${tokens.spacingVerticalXXS}`,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  sectionDivider: { marginTop: tokens.spacingVerticalXS, borderTop: `1px solid ${tokens.colorNeutralStroke2}`, paddingTop: tokens.spacingVerticalS },
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

function matchesWords(haystack: string, query: string): boolean {
  const text = normalize(haystack);
  return normalize(query).split(/\s+/).filter(Boolean).every((word) => text.includes(word));
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

  const results: Row[] = [
    ...entries.filter((entry) => matches(entry, query))
      .map((entry) => ({ id: entry.key, label: entry.label, section: entry.group, icon: entry.icon, run: () => onPick(entry.key) })),
    ...HELP_TOPICS.flatMap((topic) => topic.guides
      .filter((guide) => matchesWords(`${guide.title} ${guide.summary} ${('steps' in guide ? guide.steps : []).join(' ')}`, query))
      .map((guide) => ({
        id: `help-${guide.key}`, label: guide.title, section: HELP_TEXT.open, tag: topic.title, icon: QuestionCircle20Regular,
        run: () => openHelp(guide.key),
      }))),
  ];
  const changeOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    setQuery('');
    setActive(0);
  };
  const pick = (row: Row) => {
    changeOpen(false);
    row.run();
  };
  const moveActive = (step: number) => {
    if (!results.length) return;
    setActive((index) => (index + step + results.length) % results.length);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') moveActive(1);
    else if (e.key === 'ArrowUp') moveActive(-1);
    else if (e.key === 'Enter' && results[active]) pick(results[active]);
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
          <DialogBody className={s.body}>
            <DialogContent className={s.body}>
              <Input
                autoFocus
                className={s.input}
                appearance="filled-lighter"
                placeholder={SHELL_TEXT.palette_placeholder}
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
                aria-activedescendant={results[active] ? `command-palette-${results[active].id}` : undefined}
              />
              <div id="command-palette-list" role="listbox" className={s.list}>
                {results.length === 0 && <Text className={s.empty}>{SHELL_TEXT.no_results}</Text>}
                {results.map((row, index) => (
                  <React.Fragment key={row.id}>
                    {row.section !== results[index - 1]?.section && (
                      <div role="presentation" className={mergeClasses(s.section, index > 0 && s.sectionDivider)}>{row.section}</div>
                    )}
                    <Button
                      id={`command-palette-${row.id}`}
                      role="option"
                      aria-selected={index === active}
                      appearance="subtle"
                      className={mergeClasses(s.option, index === active && s.optionActive)}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => pick(row)}
                    >
                      {row.icon && <row.icon />}
                      <span className={s.optionLabel}>{row.label}</span>
                      {row.tag && <span className={s.group}>{row.tag}</span>}
                    </Button>
                  </React.Fragment>
                ))}
              </div>
              <div className={s.footer} aria-hidden>
                <span className={s.hint}><span className={s.key}><ArrowUp16Regular /></span><span className={s.key}><ArrowDown16Regular /></span>{SHELL_TEXT.hint_navigate}</span>
                <span className={s.hint}><span className={s.key}><ArrowEnter16Regular /></span>{SHELL_TEXT.hint_select}</span>
                <span className={s.hint}><span className={s.key}>esc</span>{SHELL_TEXT.hint_close}</span>
              </div>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
