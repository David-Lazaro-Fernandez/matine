'use client';

// Historial del asistente en celular: el panel izquierdo no existe en pantallas chicas, así que el mismo historial vive
// en un drawer que se abre desde un botón de la página.
import * as React from 'react';
import { Button, DrawerBody, DrawerHeader, DrawerHeaderTitle, OverlayDrawer } from '@fluentui/react-components';
import { Dismiss24Regular, History20Regular } from '@fluentui/react-icons';
import { ChatHistory } from '@/components/agente/chat-history';
import { AGENT_UI, HELP_TEXT } from '@/lib/labels.generated';

export function HistoryDrawer({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button className={className} appearance="subtle" icon={<History20Regular />} onClick={() => setOpen(true)}>
        {AGENT_UI.history_title}
      </Button>
      <OverlayDrawer position="start" size="small" open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DrawerHeader>
          <DrawerHeaderTitle
            action={<Button appearance="subtle" aria-label={HELP_TEXT.close} icon={<Dismiss24Regular />} onClick={() => setOpen(false)} />}
          >
            {AGENT_UI.history_title}
          </DrawerHeaderTitle>
        </DrawerHeader>
        <DrawerBody>
          <ChatHistory onPick={() => setOpen(false)} />
        </DrawerBody>
      </OverlayDrawer>
    </>
  );
}
