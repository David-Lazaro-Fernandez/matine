'use client';

// Piezas compartidas de las páginas de configuración. Las imágenes se reducen en el navegador y viajan como URL
// `data:` PNG; la API rechaza las que pasan de su tope.
import * as React from 'react';
import { Button, MessageBar, MessageBarBody, makeStyles } from '@fluentui/react-components';
import { errorText } from '@/components/common';
import { AUTH_TEXT } from '@/lib/labels.generated';

// Lado mayor de la imagen guardada. 256 px se ven nítidos al doble de densidad en el riel y en el avatar.
const IMAGE_SIDE = 256;

const useStyles = makeStyles({
  hidden: { display: 'none' },
});

type Status = { error?: string; success?: string } | null;


// PNG de `file` con su lado mayor en `IMAGE_SIDE` o menos. Un SVG también pasa a PNG.
function resized(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(AUTH_TEXT.InvalidImage));
    };
    img.src = url;
  });
}

export function StatusBar({ status }: { status: Status }) {
  if (status?.error) return <MessageBar intent="error"><MessageBarBody>{status.error}</MessageBarBody></MessageBar>;
  if (status?.success) return <MessageBar intent="success"><MessageBarBody>{status.success}</MessageBarBody></MessageBar>;
  return null;
}

// `run(fn)` marca ocupado, corre `fn` y guarda el aviso de éxito o el error de la API.
export function useAction(success: string) {
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<Status>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
      setStatus({ success });
    } catch (err) {
      setStatus({ error: errorText(err) });
    }
    setBusy(false);
  };
  return { busy, status, run };
}

export function ImagePicker({ onPick, disabled }: { onPick: (dataUrl: string) => void; disabled: boolean }) {
  const s = useStyles();
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className={s.hidden}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onPick(await resized(file).catch(() => ''));
        }}
      />
      <Button disabled={disabled} onClick={() => input.current?.click()}>{AUTH_TEXT.upload_image}</Button>
    </>
  );
}
