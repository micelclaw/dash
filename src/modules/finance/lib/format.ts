// Formato compartido de dinero / fecha / número para las TRES lentes de finanzas
// (Personal, Facturación, Contabilidad). Antes estaba duplicado en ~7 ficheros
// (personal/lib.ts, contabilidad/shared.tsx `fmt`, y 5 tabs de facturación). SSOT aquí.

/** Importe monetario en formato español (1.234,56 €). `currency` null/'' → EUR. */
export function fmtMoney(value: string | number | null | undefined, currency?: string | null): string {
  const n = Number(value ?? 0);
  const cur = currency || 'EUR';
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: cur }).format(n);
  } catch {
    return `${n.toFixed(2)} ${cur}`;
  }
}

/**
 * Fecha ISO (YYYY-MM-DD o completa) → "12 jun 2026".
 * `opts.year:false` quita el año; `opts.empty` cambia el placeholder de vacío ('—' por defecto).
 * Las fechas date-only se fijan a medianoche LOCAL para evitar el off-by-one por parseo UTC.
 */
export function fmtDate(iso: string | null | undefined, opts?: { year?: boolean; empty?: string }): string {
  const empty = opts?.empty ?? '—';
  if (!iso) return empty;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T00:00:00') : new Date(iso);
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit', month: 'short', ...(opts?.year === false ? {} : { year: 'numeric' }),
    }).format(d);
  } catch {
    return iso;
  }
}

/** Número monetario SIN símbolo (tablas contables con columna € aparte). null/'' → '—'. */
export function fmt(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
}
