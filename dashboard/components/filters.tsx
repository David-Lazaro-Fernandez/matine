'use client';

// Filtros de zona y periodo, como `plaza_selector` de ui/common.py y el periodo de views/cartelera.py.
// La elección vive en la URL (`?plaza=`, `?periodo=`, `?d0=`, `?d1=`): sobrevive a una recarga y se comparte entre páginas.
import * as React from 'react';
import { Field, Input, Radio, RadioGroup, makeStyles, tokens } from '@fluentui/react-components';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { addDays, cinemaWeek, date_es, fill } from '@/lib/format';
import { NATIONAL_LABEL, PERIOD_TEXT, PLAZA_LABEL, ZONE_TEXT } from '@/lib/labels.generated';

// Valor de `?plaza=` para todo el país. `usePlaza` lo devuelve como null: los endpoints toman nacional sin `plaza`.
const NATIONAL = 'nacional';
const DEFAULT_PLAZA = 'cdmx';
// La zona horaria de `analytics.today()` (config.PILOT_TIMEZONE).
const PILOT_TIMEZONE = 'America/Mexico_City';
type PeriodKey = 'hoy' | 'manana' | 'semana' | 'siguiente' | 'fechas';
const DEFAULT_PERIOD = 'semana';

const useStyles = makeStyles({
  dates: { display: 'flex', gap: tokens.spacingHorizontalS },
});

function useSetParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
}

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PILOT_TIMEZONE }).format(new Date());
}

// La plaza elegida, clave de scraper/plazas.py, o null para nacional. CDMX por defecto, como Streamlit.
// Para la API: query({ plaza: usePlaza(), ...usePeriod() }) omite `plaza` en nacional.
export function usePlaza(): string | null {
  const plaza = useSearchParams().get('plaza') ?? DEFAULT_PLAZA;
  return plaza === NATIONAL ? null : plaza;
}

// "Zona": las plazas con cines en la base (`GET /api/plazas`) y Nacional. Una plaza que ya no está cae en la primera.
export function PlazaSelector() {
  const setParams = useSetParams();
  const plaza = usePlaza();
  const [plazas, setPlazas] = React.useState<string[] | null>(null);
  React.useEffect(() => {
    api<{ plaza: string }[]>('/plazas').then((rows) => setPlazas(rows.map((r) => r.plaza)), () => setPlazas([]));
  }, []);
  const options = [...(plazas ?? []), NATIONAL];
  const selected = plaza ?? NATIONAL;
  const valid = plazas === null || options.includes(selected);
  React.useEffect(() => {
    if (!valid) setParams({ plaza: options[0] });
  });
  if (plazas === null) return null;
  return (
    <Field label={ZONE_TEXT.header} hint={ZONE_TEXT.caption}>
      <RadioGroup aria-label={ZONE_TEXT.select} value={selected} onChange={(_, data) => setParams({ plaza: data.value })}>
        {options.map((key) => (
          <Radio key={key} value={key} label={key === NATIONAL ? NATIONAL_LABEL : PLAZA_LABEL[key as keyof typeof PLAZA_LABEL] ?? key} />
        ))}
      </RadioGroup>
    </Field>
  );
}

function periods(day: string): Record<Exclude<PeriodKey, 'fechas'>, [string, string]> {
  const week = cinemaWeek(day);
  return {
    hoy: [day, day],
    manana: [addDays(day, 1), addDays(day, 1)],
    semana: [day, week[1]],
    siguiente: cinemaWeek(addDays(week[1], 1)),
  };
}

// El periodo elegido como rango ISO inclusivo. Por defecto, el resto de la semana de cine.
export function usePeriod(): { d0: string; d1: string } {
  const params = useSearchParams();
  const day = today();
  const fixedRanges = periods(day);
  const key = (params.get('periodo') ?? DEFAULT_PERIOD) as PeriodKey;
  if (key === 'fechas') {
    return { d0: params.get('d0') ?? day, d1: params.get('d1') ?? fixedRanges.semana[1] };
  }
  const [d0, d1] = fixedRanges[key] ?? fixedRanges[DEFAULT_PERIOD];
  return { d0, d1 };
}

// "Periodo": hoy, mañana, la semana de cine en curso o la siguiente, o un rango libre.
// `nextState` es el sufijo de PUBLICATION_LABEL para la semana siguiente, si la página lo conoce.
export function PeriodSelector({ nextState = '' }: { nextState?: string }) {
  const s = useStyles();
  const setParams = useSetParams();
  const params = useSearchParams();
  const { d0, d1 } = usePeriod();
  const day = today();
  const ranges = periods(day);
  const short = (iso: string) => date_es(iso, false);
  const labels: Record<PeriodKey, string> = {
    hoy: PERIOD_TEXT.today,
    manana: PERIOD_TEXT.tomorrow,
    semana: fill(PERIOD_TEXT.week, { d1: short(ranges.semana[1]) }),
    siguiente: fill(PERIOD_TEXT.next_week, { d0: short(ranges.siguiente[0]), d1: short(ranges.siguiente[1]), state: nextState }),
    fechas: PERIOD_TEXT.custom,
  };
  const key = (params.get('periodo') ?? DEFAULT_PERIOD) as PeriodKey;
  const [min, max] = [addDays(day, -1), addDays(day, 35)];
  return (
    <>
      <Field label={PERIOD_TEXT.header}>
        <RadioGroup
          aria-label={PERIOD_TEXT.select}
          value={key in labels ? key : DEFAULT_PERIOD}
          onChange={(_, data) => setParams(data.value === 'fechas'
            ? { periodo: data.value, d0, d1 }
            : { periodo: data.value, d0: null, d1: null })}
        >
          {(Object.keys(labels) as PeriodKey[]).map((k) => <Radio key={k} value={k} label={labels[k]} />)}
        </RadioGroup>
      </Field>
      {key === 'fechas' && (
        <Field label={PERIOD_TEXT.custom_range}>
          <div className={s.dates}>
            <Input type="date" aria-label={PERIOD_TEXT.from} value={d0} min={min} max={d1}
                   onChange={(_, data) => data.value && setParams({ d0: data.value })} />
            <Input type="date" aria-label={PERIOD_TEXT.to} value={d1} min={d0} max={max}
                   onChange={(_, data) => data.value && setParams({ d1: data.value })} />
          </div>
        </Field>
      )}
    </>
  );
}
