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
 * Las etiquetas que Gmail se pone a sí mismo: estado (`UNREAD`, `STARRED`) o un
 * sitio del sistema (`INBOX`, `SENT`). No son etiquetas del usuario y no deben
 * pintarse como tales — la tarjeta de un correo mostraba «UNREAD IMPORTANT
 * CATEGORY_SOCIAL» como si el usuario los hubiera puesto él.
 *
 * Espejo de `isGmailSystemLabelId` en el backend (`core/src/sync/mail-folders.ts`).
 * Se duplica porque son repos separados; si cambia una, cambia la otra.
 */
const ESTADO = new Set([
  'UNREAD', 'STARRED', 'IMPORTANT', 'CHAT', 'YELLOW_STAR',
  'INBOX', 'SENT', 'DRAFT', 'TRASH', 'SPAM',
]);

/** True cuando la etiqueta es de Gmail, no del usuario. */
export function isProviderLabel(label: string): boolean {
  return ESTADO.has(label) || label.startsWith('CATEGORY_');
}

/** Solo lo que el usuario etiquetó él, que es lo único que aporta al leer. */
export function userLabels(labels: string[] | null | undefined): string[] {
  return (labels ?? []).filter((l) => !isProviderLabel(l));
}
