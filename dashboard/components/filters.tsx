'use client';

// Filtros de zona y periodo, como `plaza_selector` de ui/common.py y el periodo de views/cartelera.py.
// La elección vive en la URL (`?plaza=`, `?periodo=`, `?d0=`, `?d1=`): sobrevive a una recarga y se comparte entre páginas.
import * as React from 'react';
import {
  Button, Checkbox, Input, Menu, MenuItemCheckbox, MenuItemRadio, MenuList, MenuPopover, MenuTrigger, Popover, PopoverSurface,
  PopoverTrigger, SearchBox, Switch, ToggleButton, makeStyles, mergeClasses, tokens,
} from '@fluentui/react-components';
import {
  ArrowSort20Regular, CalendarLtr20Regular, Checkmark16Regular, ChevronDown20Regular, Dismiss16Regular, EyeOff20Regular,
  Filter20Regular, Location20Regular,
} from '@fluentui/react-icons';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useIconOnly } from '@/components/acciones';
import { api } from '@/lib/api';
import { PILOT_TIMEZONE, addDays, cinemaWeek, date_es, fill, fold } from '@/lib/format';
import { FILTER_TEXT, NATIONAL_LABEL, PERIOD_TEXT, PLAZA_LABEL, ZONE_TEXT } from '@/lib/labels.generated';

// Valor de `?plaza=` para todo el país. `usePlaza` lo devuelve como null: los endpoints toman nacional sin `plaza`.
const NATIONAL = 'nacional';
const DEFAULT_PLAZA = 'cdmx';
type PeriodKey = 'hoy' | 'manana' | 'semana' | 'siguiente' | 'fechas';
const DEFAULT_PERIOD = 'semana';

const useStyles = makeStyles({
  dates: { display: 'flex', gap: tokens.spacingHorizontalS },
  filterButton: { fontWeight: tokens.fontWeightRegular, minWidth: 0, maxWidth: '100%' },
  // Borde arriba y a los lados; el de abajo toma el fondo y tapa la línea de la caja, como la pestaña de una carpeta.
  tab: {
    position: 'relative',
    zIndex: 1,
    marginBottom: '-1px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderBottomColor: tokens.colorNeutralBackground1,
    borderRadius: `${tokens.borderRadiusLarge} ${tokens.borderRadiusLarge} 0 0`,
    backgroundColor: tokens.colorNeutralBackground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  filterText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '360px' },
  filterList: { maxHeight: '60vh', overflowY: 'auto' },
  panel: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS, width: 'min(420px, 80vw)' },
  panelTitle: {
    margin: 0, paddingBottom: tokens.spacingVerticalS, borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    fontWeight: tokens.fontWeightSemibold,
  },
  panelClear: { alignSelf: 'flex-start' },
  checklist: { display: 'flex', flexDirection: 'column', maxHeight: '240px', overflowY: 'auto' },
  fieldButton: { justifyContent: 'flex-start', fontWeight: tokens.fontWeightRegular, flexShrink: 0 },
  panelActions: { display: 'flex', gap: tokens.spacingHorizontalS, '& > *': { flexGrow: 1 } },
  filterNote: {
    maxWidth: '320px', margin: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200,
  },
});

export function useSetParams() {
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

// Botón de filtro con el valor elegido; abre un menú con las opciones. `options` son pares [valor, texto].
// Sin `icon`, el botón lleva una flecha al final. `short` reemplaza el texto del botón; `note` va arriba de las opciones.
// La opción con valor '' ("todas") muestra `label` en el botón, como un filtro sin aplicar. `tab` lo pinta como la pestaña
// de una carpeta, pegada a la caja de abajo: es la elección que define la pantalla, no un filtro.
export function FilterMenu({ label, icon, value, options, short, note, tab = false, onChange }: {
  label: string; icon?: React.ReactElement; value: string; options: [string, string][]; short?: string; note?: string;
  tab?: boolean; onChange: (value: string) => void;
}) {
  const text = short ?? (value ? options.find(([key]) => key === value)?.[1] : label) ?? label;
  return (
    <ChoiceMenu label={label} icon={icon} text={text} note={note} options={options} checked={[value]} tab={tab}
                onChange={(values) => values[0] !== undefined && onChange(values[0])} />
  );
}

// Como FilterMenu, con varias opciones a la vez. Sin ninguna elegida, el botón muestra `label`.
export function FilterChecks({ label, icon, values, options, note, onChange }: {
  label: string; icon?: React.ReactElement; values: string[]; options: [string, string][]; note?: string;
  onChange: (values: string[]) => void;
}) {
  const names = options.filter(([key]) => values.includes(key)).map(([, name]) => name);
  return (
    <ChoiceMenu multiple label={label} icon={icon} text={names.length ? names.join(', ') : label} note={note}
                options={options} checked={values} onChange={onChange} />
  );
}

// Botón "Filtro" que abre un panel con un control de búsqueda (`children`), como el filtro de una vista de Airtable.
// `text` es el filtro aplicado; vacío muestra `label`. `onClear` quita el filtro. `icon` reemplaza al del filtro.
export function FilterPopover({ label, text, note, icon, onClear, children }: {
  label: string; text: string; note?: string; icon?: React.ReactElement; onClear: () => void; children: React.ReactNode;
}) {
  const s = useStyles();
  const shown = text || label;
  return (
    <Popover positioning="below-start" trapFocus>
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="subtle" className={s.filterButton} icon={icon ?? <Filter20Regular />} aria-label={`${label}: ${shown}`} title={shown}>
          <span className={s.filterText}>{shown}</span>
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={s.panel}>
        <p className={s.panelTitle}>{label}</p>
        {children}
        {note && <p className={s.filterNote}>{note}</p>}
        {text && (
          <Button appearance="subtle" size="small" icon={<Dismiss16Regular />} className={s.panelClear} onClick={onClear}>
            {FILTER_TEXT.clear}
          </Button>
        )}
      </PopoverSurface>
    </Popover>
  );
}

// Buscador con una lista de casillas, para un `FilterPopover` con muchas opciones. `options` son pares [valor, texto].
export function SearchChecklist({ label, values, options, onChange }: {
  label: string; values: string[]; options: [string, string][]; onChange: (values: string[]) => void;
}) {
  const s = useStyles();
  const [search, setSearch] = React.useState('');
  const query = fold(search);
  const shown = options.filter(([, name]) => fold(name).includes(query));
  const toggle = (key: string, on: boolean) =>
    onChange(options.map(([k]) => k).filter((k) => (k === key ? on : values.includes(k))));
  return (
    <>
      <SearchBox size="small" aria-label={label} placeholder={FILTER_TEXT.search} value={search}
                 onChange={(_, data) => setSearch(data.value)} />
      <div className={s.checklist} role="group" aria-label={label}>
        {shown.length ? shown.map(([key, name]) => (
          <Checkbox key={key} size="medium" label={name} checked={values.includes(key)}
                    onChange={(_, data) => toggle(key, Boolean(data.checked))} />
        )) : <p className={s.filterNote}>{FILTER_TEXT.no_matches}</p>}
      </div>
    </>
  );
}

// "Ocultar campos" de una tabla: buscador, un interruptor por columna y botones para ocultar o mostrar todas.
// `columns` son pares [columna, encabezado]; `hidden` son las columnas ocultas.
export function HideFields({ columns, hidden, onChange }: {
  columns: [string, string][]; hidden: string[]; onChange: (hidden: string[]) => void;
}) {
  const s = useStyles();
  const [search, setSearch] = React.useState('');
  const query = fold(search);
  const shown = columns.filter(([, name]) => fold(name).includes(query));
  const count = columns.filter(([key]) => hidden.includes(key)).length;
  const text = count === 0 ? FILTER_TEXT.hide_fields : count === 1 ? FILTER_TEXT.hidden_one : fill(FILTER_TEXT.hidden_many, { n: count });
  const toggle = (key: string, visible: boolean) =>
    onChange(columns.map(([k]) => k).filter((k) => (k === key ? !visible : hidden.includes(k))));
  return (
    <Popover positioning="below-start" trapFocus>
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="subtle" className={s.filterButton} icon={<EyeOff20Regular />}>{text}</Button>
      </PopoverTrigger>
      <PopoverSurface className={s.panel}>
        <SearchBox size="small" aria-label={FILTER_TEXT.find_field} placeholder={FILTER_TEXT.find_field} value={search}
                   onChange={(_, data) => setSearch(data.value)} />
        <div className={s.checklist} role="group" aria-label={FILTER_TEXT.hide_fields}>
          {shown.length ? shown.map(([key, name]) => (
            <Switch key={key} label={name} checked={!hidden.includes(key)} onChange={(_, data) => toggle(key, data.checked)} />
          )) : <p className={s.filterNote}>{FILTER_TEXT.no_matches}</p>}
        </div>
        <div className={s.panelActions}>
          <Button size="small" onClick={() => onChange(columns.map(([key]) => key))}>{FILTER_TEXT.hide_all}</Button>
          <Button size="small" onClick={() => onChange([])}>{FILTER_TEXT.show_all}</Button>
        </div>
      </PopoverSurface>
    </Popover>
  );
}

// "Clasificar" de una tabla: buscador, la lista de columnas y la dirección. `columns` son pares [columna, encabezado].
// `sort` es la columna elegida o null; `onChange(null, false)` quita el orden.
export function SortFields({ columns, sort, desc, onChange }: {
  columns: [string, string][]; sort: string | null; desc: boolean; onChange: (sort: string | null, desc: boolean) => void;
}) {
  const s = useStyles();
  const [search, setSearch] = React.useState('');
  const query = fold(search);
  const shown = columns.filter(([, name]) => fold(name).includes(query));
  const name = columns.find(([key]) => key === sort)?.[1];
  return (
    <Popover positioning="below-start" trapFocus>
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="subtle" className={s.filterButton} icon={<ArrowSort20Regular />}>
          {name ? fill(FILTER_TEXT.sorted_by, { field: name }) : FILTER_TEXT.sort}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={s.panel}>
        <p className={s.panelTitle}>{FILTER_TEXT.sort_by}</p>
        <SearchBox size="small" aria-label={FILTER_TEXT.find_field} placeholder={FILTER_TEXT.find_field} value={search}
                   onChange={(_, data) => setSearch(data.value)} />
        <div className={s.checklist} role="group" aria-label={FILTER_TEXT.sort_by}>
          {shown.length ? shown.map(([key, label]) => (
            <Button key={key} appearance="subtle" size="small" className={s.fieldButton} aria-pressed={key === sort}
                    icon={key === sort ? <Checkmark16Regular /> : <span />} onClick={() => onChange(key, desc)}>
              {label}
            </Button>
          )) : <p className={s.filterNote}>{FILTER_TEXT.no_matches}</p>}
        </div>
        {sort && (
          <>
            <div className={s.panelActions}>
              <ToggleButton size="small" checked={!desc} onClick={() => onChange(sort, false)}>{FILTER_TEXT.ascending}</ToggleButton>
              <ToggleButton size="small" checked={desc} onClick={() => onChange(sort, true)}>{FILTER_TEXT.descending}</ToggleButton>
            </div>
            <Button appearance="subtle" size="small" icon={<Dismiss16Regular />} className={s.panelClear} onClick={() => onChange(null, false)}>
              {FILTER_TEXT.clear_sort}
            </Button>
          </>
        )}
      </PopoverSurface>
    </Popover>
  );
}

function ChoiceMenu({ label, icon, text, note, options, checked, multiple = false, tab = false, onChange }: {
  label: string; icon?: React.ReactElement; text: string; note?: string; options: [string, string][]; checked: string[];
  multiple?: boolean; tab?: boolean; onChange: (values: string[]) => void;
}) {
  const s = useStyles();
  const iconOnly = useIconOnly();
  const Item = multiple ? MenuItemCheckbox : MenuItemRadio;
  return (
    <Menu checkedValues={{ [label]: checked }} onCheckedValueChange={(_, data) => onChange(data.checkedItems)}>
      <MenuTrigger disableButtonEnhancement>
        <Button appearance="subtle" className={mergeClasses(s.filterButton, tab && s.tab, icon && iconOnly.button)}
                aria-label={`${label}: ${text}`} title={text}
                icon={icon ?? <ChevronDown20Regular />} iconPosition={icon ? 'before' : 'after'}>
          <span className={mergeClasses(s.filterText, icon && iconOnly.text)}>{text}</span>
        </Button>
      </MenuTrigger>
      <MenuPopover>
        {note && <p className={s.filterNote}>{note}</p>}
        <MenuList className={s.filterList}>
          {options.map(([key, name]) => <Item key={key} name={label} value={key}>{name}</Item>)}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}

export function today(): string {
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
    <FilterMenu
      label={ZONE_TEXT.header}
      icon={<Location20Regular />}
      value={selected}
      options={options.map((key) => [key, key === NATIONAL ? NATIONAL_LABEL : PLAZA_LABEL[key as keyof typeof PLAZA_LABEL] ?? key])}
      onChange={(value) => setParams({ plaza: value })}
    />
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
  const shortLabels: Partial<Record<PeriodKey, string>> = { semana: PERIOD_TEXT.week_short, siguiente: PERIOD_TEXT.next_week_short };
  const raw = (params.get('periodo') ?? DEFAULT_PERIOD) as PeriodKey;
  const key = raw in labels ? raw : DEFAULT_PERIOD;
  const [min, max] = [addDays(day, -1), addDays(day, 35)];
  return (
    <>
      <FilterMenu
        label={PERIOD_TEXT.header}
        icon={<CalendarLtr20Regular />}
        value={key}
        options={(Object.keys(labels) as PeriodKey[]).map((k) => [k, labels[k]])}
        short={shortLabels[key]}
        onChange={(value) => setParams(value === 'fechas' ? { periodo: value, d0, d1 } : { periodo: value, d0: null, d1: null })}
      />
      {key === 'fechas' && (
        <div className={s.dates}>
          <Input type="date" aria-label={PERIOD_TEXT.from} value={d0} min={min} max={d1}
                 onChange={(_, data) => data.value && setParams({ d0: data.value })} />
          <Input type="date" aria-label={PERIOD_TEXT.to} value={d1} min={d0} max={max}
                 onChange={(_, data) => data.value && setParams({ d1: data.value })} />
        </div>
      )}
    </>
  );
}
