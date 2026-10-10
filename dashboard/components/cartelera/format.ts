// Formato de números y plantillas de `labels.py` para las gráficas de formatos y preventa.
// Equivalen a los f-strings de views/cartelera.py.

// Llena una plantilla de labels.py: fill('{sold} de {seats}', { sold: '3', seats: '9' }) → '3 de 9'.
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
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
  return `${v >= 0 ? '+' : '−'}${fixed(Math.abs(v), digits)}`;
}
