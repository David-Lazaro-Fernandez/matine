'use client';

// General del espacio de trabajo (solo admin): el logo que ven todas las cuentas de la organización.
import * as React from 'react';
import { Button, makeStyles, tokens } from '@fluentui/react-components';
import { PageHeader, Pregunta, Seccion } from '@/components/common';
import { ImagePicker, StatusBar, useAction } from '@/components/configuracion/comunes';
import { useSession } from '@/lib/session';
import { api, type Profile } from '@/lib/api';
import { AUTH_TEXT } from '@/lib/labels.generated';

const useStyles = makeStyles({
  stack: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  imageRow: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: tokens.spacingHorizontalM },
  logo: { width: '120px', height: '48px', objectFit: 'contain' },
});

export default function Page() {
  const s = useStyles();
  const { user, setUser } = useSession();
  const { busy, status, run } = useAction(AUTH_TEXT.saved);
  if (!user) return null;
  const save = (logo: string | null) => run(async () => setUser(await api<Profile>('/logo', { logo })));
  return (
    <>
      <PageHeader title={AUTH_TEXT.workspace_general} />
      <Seccion slug="logo">
        <Pregunta texto={AUTH_TEXT.logo} conclusion={AUTH_TEXT.logo_help} />
        <div className={s.stack}>
          <div className={s.imageRow}>
            {user.logo && <img src={user.logo} alt={AUTH_TEXT.logo} className={s.logo} />}
            <ImagePicker disabled={busy} onPick={(url) => url && save(url)} />
            {user.logo && <Button appearance="subtle" disabled={busy} onClick={() => save(null)}>{AUTH_TEXT.remove_image}</Button>}
          </div>
          <StatusBar status={status} />
        </div>
      </Seccion>
    </>
  );
}
