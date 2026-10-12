'use client';

// Imprime la pantalla. El diálogo del navegador también guarda en PDF. Las secciones diferidas solo se piden al
// acercarse a la pantalla: el botón las pide todas y espera a que ningún esqueleto (`aria-busy`) siga en la página.
import * as React from 'react';
import { Button, Spinner, Tooltip } from '@fluentui/react-components';
import { Print24Regular } from '@fluentui/react-icons';
import { LOAD_ALL_EVENT } from '@/components/common';
import { HELP_TEXT } from '@/lib/labels.generated';

const POLL_MS = 250;
// Una sección que no llega en este tiempo se imprime con su esqueleto.
const MAX_WAIT_MS = 20000;

export function PrintButton() {
  const [waiting, setWaiting] = React.useState(false);
  const print = () => {
    setWaiting(true);
    window.dispatchEvent(new Event(LOAD_ALL_EVENT));
    const started = Date.now();
    const poll = window.setInterval(() => {
      if (document.querySelector('main [aria-busy]') && Date.now() - started < MAX_WAIT_MS) return;
      window.clearInterval(poll);
      setWaiting(false);
      window.print();
    }, POLL_MS);
  };
  return (
    <Tooltip content={HELP_TEXT.print} relationship="label">
      <Button appearance="subtle" icon={waiting ? <Spinner size="tiny" /> : <Print24Regular />} disabled={waiting} onClick={print} />
    </Tooltip>
  );
}
