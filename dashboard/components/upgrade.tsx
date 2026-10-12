'use client';

// Un módulo que la organización no contrató: el diálogo que abre su candado en la navegación y el panel que ocupa la
// página si se entra por su dirección. Ambos mandan `POST /api/interes` para que Ventas escriba.
// Sin módulo, es el diálogo de "Comunicarse con Ventas".
import * as React from 'react';
import {
  Body1,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { LockClosed24Regular } from '@fluentui/react-icons';
import { api, type Module } from '@/lib/api';
import { fill } from '@/lib/format';
import { MODULE_LABEL, UPGRADE_TEXT } from '@/lib/labels.generated';

const useStyles = makeStyles({
  locked: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: tokens.spacingVerticalM,
    maxWidth: '560px',
    paddingTop: tokens.spacingVerticalXXL,
  },
  icon: { color: tokens.colorNeutralForeground3 },
});

function texts(module: Module | null) {
  return module
    ? { title: fill(UPGRADE_TEXT.title, { module: MODULE_LABEL[module] }), body: UPGRADE_TEXT.body[module] }
    : { title: UPGRADE_TEXT.sales_title, body: UPGRADE_TEXT.sales_body };
}

function useInterest(module: Module | null) {
  const [state, setState] = React.useState<'idle' | 'sending' | 'sent'>('idle');
  React.useEffect(() => setState('idle'), [module]);
  const send = () => {
    setState('sending');
    api('/interes', { module }).then(() => setState('sent'), () => setState('idle'));
  };
  return { state, send };
}

function Cta({ state, send }: ReturnType<typeof useInterest>) {
  if (state === 'sent') {
    return <MessageBar intent="success"><MessageBarBody>{UPGRADE_TEXT.sent}</MessageBarBody></MessageBar>;
  }
  return <Button appearance="primary" disabled={state === 'sending'} onClick={send}>{UPGRADE_TEXT.cta}</Button>;
}

// `module` undefined cierra el diálogo; null lo abre para hablar con Ventas.
export function UpgradeDialog({ module, onClose }: { module: Module | null | undefined; onClose: () => void }) {
  const interest = useInterest(module ?? null);
  const { title, body } = texts(module ?? null);
  return (
    <Dialog open={module !== undefined} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>{body}</DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>{UPGRADE_TEXT.close}</Button>
            <Cta {...interest} />
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export function LockedPage({ module }: { module: Module }) {
  const s = useStyles();
  const interest = useInterest(module);
  const { title, body } = texts(module);
  return (
    <div className={s.locked}>
      <LockClosed24Regular className={s.icon} />
      <Title3 as="h1">{title}</Title3>
      <Body1>{body}</Body1>
      <Cta {...interest} />
    </div>
  );
}
