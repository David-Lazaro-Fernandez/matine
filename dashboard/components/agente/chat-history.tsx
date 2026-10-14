'use client';

// Historial del asistente en el panel izquierdo: las conversaciones de la cuenta, de la más reciente a la más antigua,
// agrupadas por fecha. La conversación abierta va en la URL (`?c=`), así se puede recargar o compartir el enlace.
import * as React from 'react';
import { Button, NavSectionHeader, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { Add20Regular, Delete16Regular } from '@fluentui/react-icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { AGENT_UI } from '@/lib/labels.generated';

type Item = { id: number; title: string; updated_at: string };

const HISTORY_EVENT = 'agente-history';
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;

// Avisa al panel que la lista cambió (una pregunta nueva o una conversación borrada).
export function notifyHistory() {
  window.dispatchEvent(new Event(HISTORY_EVENT));
}

function groups(items: Item[]): [string, Item[]][] {
  const midnight = new Date().setHours(0, 0, 0, 0);
  const pick = (from: number, to: number) => items.filter((i) => {
    const at = new Date(i.updated_at).getTime();
    return at >= from && at < to;
  });
  const today = pick(midnight, Infinity);
  const week = pick(midnight - WEEK_DAYS * DAY_MS, midnight);
  const older = pick(-Infinity, midnight - WEEK_DAYS * DAY_MS);
  return ([[AGENT_UI.history_today, today], [AGENT_UI.history_week, week], [AGENT_UI.history_older, older]] as [string, Item[]][])
    .filter(([, list]) => list.length > 0);
}

const useStyles = makeStyles({
  top: { padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}` },
  row: {
    display: 'flex',
    alignItems: 'center',
    borderRadius: tokens.borderRadiusMedium,
    '&:hover [data-delete]': { opacity: 1 },
    '&:focus-within [data-delete]': { opacity: 1 },
  },
  item: {
    flexGrow: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    border: 'none',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: 'transparent',
    color: tokens.colorNeutralForeground1,
    fontFamily: 'inherit',
    fontSize: tokens.fontSizeBase300,
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorSubtleBackgroundHover },
  },
  selected: { backgroundColor: tokens.colorSubtleBackgroundSelected, fontWeight: tokens.fontWeightSemibold },
  delete: { opacity: 0, flexShrink: 0 },
});

export function ChatHistory() {
  const s = useStyles();
  const router = useRouter();
  const selected = useSearchParams().get('c');
  const [items, setItems] = React.useState<Item[]>([]);

  const load = React.useCallback(() => {
    api<Item[]>('/agente/conversaciones').then(setItems, () => setItems([]));
  }, []);
  React.useEffect(() => {
    load();
    window.addEventListener(HISTORY_EVENT, load);
    return () => window.removeEventListener(HISTORY_EVENT, load);
  }, [load]);

  const remove = (item: Item) => {
    if (!window.confirm(AGENT_UI.delete_confirm)) return;
    api(`/agente/conversaciones/${item.id}`, undefined, 'DELETE').then(() => {
      if (selected === String(item.id)) router.push('/agente/');
      load();
    });
  };

  return (
    <>
      <div className={s.top}>
        <Button appearance="subtle" icon={<Add20Regular />} onClick={() => router.push('/agente/')}>{AGENT_UI.new_chat}</Button>
      </div>
      {groups(items).map(([title, list]) => (
        <React.Fragment key={title}>
          <NavSectionHeader>{title}</NavSectionHeader>
          {list.map((item) => (
            <div key={item.id} className={s.row}>
              <button type="button" title={item.title} aria-current={selected === String(item.id) ? 'page' : undefined}
                      className={mergeClasses(s.item, selected === String(item.id) && s.selected)}
                      onClick={() => router.push(`/agente/?c=${item.id}`)}>
                {item.title}
              </button>
              <Button data-delete appearance="subtle" size="small" className={s.delete} icon={<Delete16Regular />}
                      aria-label={AGENT_UI.delete_chat} onClick={() => remove(item)} />
            </div>
          ))}
        </React.Fragment>
      ))}
    </>
  );
}
