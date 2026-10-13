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

// ─── A dónde se puede mover un correo ───────────────────────────────────────
//
// El menú del clic derecho solo ofrecía «Entrada» y «Spam», así que a una
// carpeta propia («No forget», «Facturas») no había forma de mover nada desde
// aquí: se veía la carpeta en la barra lateral y no se podía usar.
//
// Los destinos salen de la MISMA lista que pinta la barra lateral, así que lo
// que se ve es lo que se puede elegir. Se agrupan por cuenta porque un correo
// de Hotmail no puede irse a una etiqueta de Gmail.

/** Nombres de carpeta que son estados nuestros: no son destinos de un traslado. */
const SOLO_NUESTRAS = new Set(['SNOOZED', 'OUTBOX']);

/** El orden de las del sistema en el menú (no alfabético: el de uso). */
const ORDEN_SISTEMA = ['INBOX', 'Archive', 'SENT', 'DRAFTS', 'SPAM', 'TRASH'];

export interface MoveTarget {
  /** Lo que se guarda en `folder` (canónico o el nombre de la carpeta/etiqueta). */
  folder: string;
  /** Lo que lee el usuario. */
  label: string;
  kind: 'system' | 'folder' | 'label';
  /** Cabecera de grupo que va ANTES de este destino, si abre grupo. */
  groupHeader?: string;
}

interface Entrada {
  folder: string;
  account_id?: string | null;
}

/**
 * Los destinos de «Mover a…», en el orden en que se enseñan.
 *
 * Se excluye la carpeta en la que YA está el correo: ofrecer «mover a donde ya
 * estás» es ruido que además hace dudar de si la acción hizo algo.
 *
 * Y se ofrecen SOLO las carpetas de la cuenta del correo (`accountId`). Antes
 * salían las de todas: con dos cuentas conectadas, el menú de un correo de
 * Hotmail ofrecía las etiquetas de Gmail, y eso no es mover — sería copiar entre
 * proveedores, que no existe. Las carpetas del sistema (Entrada, Enviados,
 * Archivo…) sí se ofrecen siempre: son NUESTRAS y valen para cualquier cuenta.
 * Con `accountId` sin definir se mantiene el comportamiento de listar todas, que
 * es lo que necesita una pantalla que no habla de un correo concreto.
 */
export function buildMoveTargets(opts: {
  systemFolders: Entrada[];
  customFolders: Array<{ account_id: string | null; folder: string }>;
  mailLabels: Array<{ account_id: string | null; label: string }>;
  /** Para poner el nombre de la cuenta en la cabecera de cada grupo. */
  accountEmail: (accountId: string | null) => string | undefined;
  /** La carpeta activa: no se ofrece como destino. */
  currentFolder?: string;
  /**
   * La cuenta del correo que se va a mover. Definida = solo sus carpetas.
   * `undefined` = todas (para superficies que no hablan de un correo concreto).
   */
  accountId?: string | null;
}): MoveTarget[] {
  const { systemFolders, mailLabels: todasLasEtiquetas, accountEmail, currentFolder } = opts;
  const acotar = opts.accountId !== undefined;
  const customFolders = acotar
    ? opts.customFolders.filter((c) => (c.account_id ?? null) === (opts.accountId ?? null))
    : opts.customFolders;
  const mailLabels = acotar
    ? todasLasEtiquetas.filter((l) => (l.account_id ?? null) === (opts.accountId ?? null))
    : todasLasEtiquetas;
  const salida: MoveTarget[] = [];

  const sistema = ORDEN_SISTEMA.filter(
    (f) => systemFolders.some((s) => s.folder === f) && f !== currentFolder,
  );
  for (const folder of sistema) {
    salida.push({ folder, label: NOMBRES_SISTEMA[folder] ?? folder, kind: 'system' });
  }

  // Por cuenta: primero sus carpetas propias, luego sus etiquetas.
  const cuentas = new Map<string, { folders: string[]; labels: string[] }>();
  const clave = (id: string | null) => id ?? '';
  const meter = (id: string | null, en: 'folders' | 'labels', nombre: string) => {
    const k = clave(id);
    const g = cuentas.get(k) ?? { folders: [], labels: [] };
    g[en].push(nombre);
    cuentas.set(k, g);
  };

  for (const c of customFolders) {
    if (SOLO_NUESTRAS.has(c.folder) || c.folder === currentFolder) continue;
    meter(c.account_id, 'folders', c.folder);
  }
  for (const l of mailLabels) {
    if (l.label === currentFolder) continue;
    meter(l.account_id, 'labels', l.label);
  }

  for (const [k, grupo] of cuentas) {
    const total = [...grupo.folders, ...grupo.labels];
    if (total.length === 0) continue;
    // Sin cuenta conocida no se inventa un nombre: «Otras» es honesto.
    const cabecera = accountEmail(k === '' ? null : k) ?? 'Otras';
    let primera = true;
    for (const folder of grupo.folders.sort((a, b) => a.localeCompare(b))) {
      salida.push({ folder, label: folder, kind: 'folder', ...(primera ? { groupHeader: cabecera } : {}) });
      primera = false;
    }
    for (const label of grupo.labels.sort((a, b) => a.localeCompare(b))) {
      salida.push({ folder: label, label, kind: 'label', ...(primera ? { groupHeader: cabecera } : {}) });
      primera = false;
    }
  }

  return salida;
}

/** Los nombres del sistema en la lengua del módulo (que está en inglés). */
const NOMBRES_SISTEMA: Record<string, string> = {
  INBOX: 'Inbox',
  Archive: 'Archive',
  SENT: 'Sent',
  DRAFTS: 'Drafts',
  SPAM: 'Spam',
  TRASH: 'Trash',
};
