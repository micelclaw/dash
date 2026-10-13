/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

/**
 * Qué significa una columna PARA EL MUNDO EXTERIOR.
 *
 * Las columnas se llaman como uno quiera —Planning, Design, Production, Shipped—
 * pero fuera solo existen CUATRO estados: los de CalDAV VTODO, a los que degradan
 * los cinco de Microsoft To Do y los dos de Google Tasks. Declarar la equivalencia
 * es lo que permite que una tarea viaje sin mentir.
 *
 * `null` = ninguno, y es una respuesta legítima: "Bloqueado" o "En revisión" no
 * equivalen a nada del estándar. Eso se AVISA en la interfaz en vez de colgarles
 * un valor inventado.
 */

export type StatusSemantic = 'needs_action' | 'in_progress' | 'completed' | 'cancelled';

export const SEMANTICAS: Array<{ valor: StatusSemantic; etiqueta: string; color: string }> = [
  { valor: 'needs_action', etiqueta: 'Por hacer', color: 'var(--text-dim)' },
  { valor: 'in_progress', etiqueta: 'En curso', color: 'var(--amber)' },
  { valor: 'completed', etiqueta: 'Hecho', color: 'var(--green, #46a758)' },
  { valor: 'cancelled', etiqueta: 'Cancelada', color: 'var(--red, #e5484d)' },
];

export function etiquetaSemantica(v: string | null | undefined): string | null {
  return SEMANTICAS.find((s) => s.valor === v)?.etiqueta ?? null;
}

export function colorSemantica(v: string | null | undefined): string {
  return SEMANTICAS.find((s) => s.valor === v)?.color ?? 'var(--text-dim)';
}

/**
 * Deduce el significado a partir del NOMBRE de la columna, para proponerlo.
 *
 * Devuelve `null` cuando no lo tiene claro, y eso es la mitad del valor: una
 * columna "Bloqueado", "En revisión" o "Ideas raras" no es ninguno de los cuatro,
 * y proponerle uno sería justo la mentira que esto viene a quitar. La propuesta
 * SIEMPRE la confirma una persona: nada de esto se aplica solo.
 */
export function deducirSemantica(titulo: string): StatusSemantic | null {
  const t = titulo
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');   // sin tildes

  // El orden importa: "no hacer" contiene "hacer". Lo más específico primero.
  if (/\b(cancelad|descartad|rechazad|anulad|cancel|discard|reject)/.test(t)) return 'cancelled';
  if (/\b(done|hecho|hechas|hecha|completad|complete|shipped|cerrad|closed|finalizad|terminad|entregad|publicad)/.test(t)) return 'completed';
  if (/\b(doing|en curso|encurso|in progress|progress|wip|haciendo|desarrollo|development|revision|review|design|produccion|production|trabajando)/.test(t)) return 'in_progress';
  if (/\b(backlog|por hacer|porhacer|to ?do|pendiente|pending|ideas|nuevo|new|inbox|entrada|planning|planificacion|propuesta)/.test(t)) return 'needs_action';

  return null;
}

/** Propuesta para un tablero entero, lista para enseñar y corregir. */
export function deducirTablero(
  columnas: Array<{ id: string; title: string; status_semantic?: string | null }>,
): Array<{ id: string; title: string; actual: StatusSemantic | null; propuesta: StatusSemantic | null }> {
  return columnas.map((c) => ({
    id: c.id,
    title: c.title,
    actual: (c.status_semantic as StatusSemantic | null) ?? null,
    propuesta: (c.status_semantic as StatusSemantic | null) ?? deducirSemantica(c.title),
  }));
}
