/**
 * QUÉ se puede hacer con los correos seleccionados. Un solo sitio.
 *
 * Existe porque había CUATRO listas distintas de acciones para lo mismo, y cada
 * una se olvidaba de algo:
 *
 *   · la esquina de la fila (al pasar el ratón): archivar, aplazar, borrar
 *   · la barra de selección múltiple: leído, no leído, archivar, borrar
 *   · el botón derecho sobre un correo: no leído, destacar, archivar, mover a,
 *     spam, relacionar, borrar
 *   · el botón derecho sobre varios: leído, no leído, archivar, borrar
 *
 * O sea que destacar no existía en selección múltiple, mover a tampoco, aplazar
 * no estaba en el menú del botón derecho, y los dos menús contextuales —el de uno
 * y el de varios— eran distintos sin ninguna razón. Ahora los cuatro sitios
 * preguntan aquí y pintan lo mismo, sea UN correo o cien.
 *
 * Es un módulo PURO y sin imports del dash a propósito (mismo criterio que
 * `move-targets.ts` y `connector-avisos.ts`): así se puede aseverar lo que el
 * usuario LEE desde un guion de fuera, sin montar React. Por eso devuelve el
 * NOMBRE del icono y no el componente.
 */

import type { MoveTarget } from './move-targets';

export type MailActionKey =
  | 'read' | 'unread'
  | 'star' | 'unstar'
  | 'archive' | 'unarchive'
  | 'snooze'
  | 'move'
  | 'spam' | 'notspam'
  | 'relate'
  | 'delete' | 'restore';

/** Nombres de icono; el consumidor los mapea a Lucide. */
export type MailActionIcon =
  | 'mail-open' | 'mail' | 'star' | 'star-off' | 'archive' | 'inbox'
  | 'clock' | 'folder' | 'shield-alert' | 'link' | 'trash';

export interface MailAction {
  key: MailActionKey;
  /** Ya con el contador cuando hay varios: «Archivar (3)». */
  label: string;
  icon: MailActionIcon;
  /** Rojo y al final: borrar. */
  danger?: boolean;
  /** «Mover a…» abre submenú en vez de actuar. */
  submenu?: MoveTarget[];
}

export interface MailActionsCtx {
  /** Cuántos correos van a recibir la acción. 1 o cien: la lista es la misma. */
  count: number;
  /** ¿Están TODOS leídos? Decide el texto del par leído/no leído. */
  allRead: boolean;
  /** ¿Están TODOS destacados? Decide destacar vs quitar destacado. */
  allStarred: boolean;
  /** La carpeta en la que se está: cambia qué tiene sentido ofrecer. */
  folder: string;
  /** Los destinos de «Mover a…» (ya acotados a la cuenta del correo). */
  moveTargets?: MoveTarget[];
  /** Relacionar solo tiene sentido con UNO: el diálogo habla de un registro. */
  canRelate?: boolean;
}

/**
 * OJO CON EL IDIOMA: el módulo de correo está **en inglés** (`Search mail…`,
 * `Inbox`, `Archive`; `formatEmailTime` emite `Yesterday`/`Mon`/`Feb 16`), así
 * que las etiquetas de aquí también. Las maquetas de esta feature se enseñaron en
 * español porque la conversación es en español — eso no cambia el idioma de la
 * pantalla, y mezclarlos deja media interfaz en cada lengua.
 */

/** Sufijo con el número, para que se vea a cuántos afecta. */
function n(ctx: MailActionsCtx): string {
  return ctx.count > 1 ? ` (${ctx.count})` : '';
}

/**
 * La lista, en el orden en que se enseña.
 *
 * Las reglas por carpeta no son adorno: en la Papelera «Borrar» ya no aplica (lo
 * que aplica es restaurar), y en Spam lo que se quiere es sacarlo de ahí. Ofrecer
 * lo que no tiene sentido es lo que hace dudar de si la acción hizo algo.
 */
export function buildMailActions(ctx: MailActionsCtx): MailAction[] {
  const s = n(ctx);
  const enPapelera = ctx.folder === 'TRASH';
  const enSpam = ctx.folder === 'SPAM';
  const enArchivo = ctx.folder === 'ARCHIVE' || ctx.folder === 'Archive';
  const salida: MailAction[] = [];

  // Leído / no leído: los DOS siempre, en vez de alternar. Con varios correos en
  // estados mezclados, alternar obliga a adivinar qué va a pasar.
  salida.push({ key: 'read', label: `Mark as read${s}`, icon: 'mail-open' });
  salida.push({ key: 'unread', label: `Mark as unread${s}`, icon: 'mail' });

  // La estrella SÍ alterna: es un interruptor, y con todos destacados lo único
  // que se puede querer es quitarlo.
  salida.push(ctx.allStarred
    ? { key: 'unstar', label: `Unstar${s}`, icon: 'star-off' }
    : { key: 'star', label: `Star${s}`, icon: 'star' });

  if (!enPapelera) {
    salida.push(enArchivo
      ? { key: 'unarchive', label: `Move to Inbox${s}`, icon: 'inbox' }
      : { key: 'archive', label: `Archive${s}`, icon: 'archive' });
    salida.push({ key: 'snooze', label: `Snooze…${s}`, icon: 'clock' });
  }

  if ((ctx.moveTargets?.length ?? 0) > 0) {
    salida.push({ key: 'move', label: `Move to…${s}`, icon: 'folder', submenu: ctx.moveTargets });
  }

  if (!enPapelera) {
    salida.push(enSpam
      ? { key: 'notspam', label: `Not spam${s}`, icon: 'inbox' }
      : { key: 'spam', label: `Move to Spam${s}`, icon: 'shield-alert' });
  }

  if (ctx.canRelate) {
    salida.push({ key: 'relate', label: 'Relate', icon: 'link' });
  }

  salida.push(enPapelera
    ? { key: 'restore', label: `Restore${s}`, icon: 'inbox' }
    : { key: 'delete', label: `Delete${s}`, icon: 'trash', danger: true });

  return salida;
}

/**
 * Las que van como BOTÓN en la barra de selección múltiple; el resto, al menú.
 *
 * Cinco es la decisión del usuario (maqueta aprobada): las de uso diario a un
 * clic y lo demás en el mismo menú, para que la barra no se llene y siga
 * cabiendo en una ventana estrecha.
 */
export const ACCIONES_DIRECTAS: MailActionKey[] = [
  'read', 'star', 'unstar', 'archive', 'unarchive', 'move', 'delete', 'restore',
];

/** Parte la lista en (botones, resto-del-menú) conservando el orden. */
export function repartirAcciones(
  acciones: MailAction[],
  maxDirectas = 5,
): { directas: MailAction[]; enMenu: MailAction[] } {
  const directas: MailAction[] = [];
  const enMenu: MailAction[] = [];
  for (const a of acciones) {
    if (directas.length < maxDirectas && ACCIONES_DIRECTAS.includes(a.key)) directas.push(a);
    else enMenu.push(a);
  }
  return { directas, enMenu };
}
