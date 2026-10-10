// Formato de números, fechas y horas para directivos. Equivale a `date_es`, `range_es` y `time_12` de
// analytics/labels.py y a `n` y `pp` de ui/common.py; tests/test_format_parity.py compara las dos versiones.
// La extensión `.ts` en el import deja que Node cargue este archivo en esa prueba, sin compilar.
import { DATE_TEXT } from './labels.generated.ts';

// La zona horaria de `analytics.today()` (config.PILOT_TIMEZONE).
export const PILOT_TIMEZONE = 'America/Mexico_City';

// Como `local_time` de ui/common.py: '2026-10-09T01:05:00Z' → '8/10 07:05 PM' en hora de CDMX.
export function localTime(iso: string | null): string {
  if (!iso) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: PILOT_TIMEZONE, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true,
    }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${Number(parts.day)}/${parts.month} ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

// Llena una plantilla de labels.py: fill('{sold} de {seats}', { sold: '3', seats: '9' }) → '3 de 9'.
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

// Redondea como `f"{v:.{digits}f}"` de Python: fixed(30.5, 0) → '30', fixed(1.85, 1) → '1.9'.
export function fixed(v: number, digits: number): string {
  // Python y `toFixed` redondean el valor binario exacto. Solo difieren en un empate exacto: Python va al par.
  const [whole, fraction] = Math.abs(v).toFixed(100).split('.');
  const exactTie = fraction[digits] === '5' && /^0*$/.test(fraction.slice(digits + 1));
  const kept = digits ? `${whole}.${fraction.slice(0, digits)}` : whole;
  if (!exactTie || Number(kept.at(-1)) % 2) return v.toFixed(digits);
  return `${v < 0 ? '-' : ''}${kept}`;
}

// Separador de miles con coma, como `f"{v:,}"`: 1234 → '1,234'.
export function thousands(v: number): string {
  return Math.trunc(v).toLocaleString('en-US');
}

// Con signo y signo menos tipográfico, como `ui.common.pp` sin la unidad: -1.26 → '−1.3'.
export function signed(v: number, digits = 1): string {
  return `${v < 0 || Object.is(v, -0) ? '−' : '+'}${fixed(Math.abs(v), digits)}`;
}

// Número con separador de miles, o raya si falta: n(1234.5, 1) → '1,234.5', n(null) → '—'.
export function n(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return '—';
  return fixed(v, digits).replace(/^-?\d+/, (whole) => whole.replace(/\B(?=(\d{3})+$)/g, ','));
}

// Diferencia en puntos porcentuales: pp(-1.26) → '−1.3 pp'.
export function pp(v: number): string {
  return `${signed(v)} pp`;
}

// '17:30' → '5:30 P.M.'
export function time_12(hhmm: string): string {
  const hour = Number(hhmm.slice(0, 2));
  const minute = hhmm.slice(3, 5);
  return `${hour % 12 || 12}:${minute} ${hour < 12 ? DATE_TEXT.am : DATE_TEXT.pm}`;
}

// '2026-09-07' → 'lunes 7 de septiembre de 2026'
export function date_es(iso: string, withYear = true): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const date = fill(DATE_TEXT.date, {
    weekday: DATE_TEXT.weekdays[(d.getUTCDay() + 6) % 7],
    day: d.getUTCDate(),
    month: DATE_TEXT.months[d.getUTCMonth()],
  });
  return withYear ? fill(DATE_TEXT.with_year, { date, year: d.getUTCFullYear() }) : date;
}

// '2026-09-07', '2026-09-09' → 'del lunes 7 de septiembre al miércoles 9 de septiembre de 2026'
export function range_es(d0: string, d1: string): string {
  if (d0 === d1) return date_es(d0);
  return fill(DATE_TEXT.range, { d0: date_es(d0, false), d1: date_es(d1) });
}

// Suma días a una fecha ISO: addDays('2026-09-30', 1) → '2026-10-01'.
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Semana de cine, de jueves a miércoles, como `analytics.cinema_week`: '2026-10-10' → ['2026-10-08', '2026-10-14'].
export function cinemaWeek(iso: string): [string, string] {
  const weekday = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
  const thursday = addDays(iso, -((weekday - 3 + 7) % 7));
  return [thursday, addDays(thursday, 6)];
}
