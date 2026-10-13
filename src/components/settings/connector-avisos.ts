/**
 * Lo que la tarjeta de una integración tiene que decir en rojo, en orden de
 * importancia.
 *
 * Son DOS clases de fallo con causas distintas, y hasta ahora solo se pintaba la
 * primera: (a) la sincronización falló —tarjeta en error—, y (b) un cambio TUYO
 * agotó los reintentos de subida (INT78). El (b) deja la tarjeta en VERDE, porque
 * el `runSync` termina bien: condicionar la banda al estado lo escondía siempre.
 *
 * Vive en su propio módulo, SIN imports, para que se pueda aseverar desde un
 * guion de fuera del dash: importarla del componente arrastra el alias `@/`, que
 * solo resuelve con el tsconfig del dash (mismo motivo que `lib/move-targets.ts`).
 */
export interface AvisosDeConectorInput {
  status: string;
  last_error?: string | null;
  /** Cambios que agotaron los reintentos de subida (0 = todo al día). */
  push_failed_count?: number;
  push_last_error?: string | null;
}

export function avisosDeConector(c: AvisosDeConectorInput): string[] {
  const avisos: string[] = [];

  // El prefijo `[causa]` es para el log, no para el usuario.
  if (c.status === 'error' && c.last_error) avisos.push(c.last_error.replace(/^\[[a-z_]+\]\s*/i, ''));

  const fallidos = c.push_failed_count ?? 0;
  if (fallidos > 0) {
    const cabeza = fallidos === 1
      ? 'Un cambio tuyo no se pudo subir al proveedor'
      : `${fallidos} cambios tuyos no se pudieron subir al proveedor`;
    const causa = c.push_last_error?.replace(/^\[[a-z_]+\]\s*/i, '');
    avisos.push(causa ? `${cabeza}: ${causa}` : cabeza);
  }

  return avisos;
}
