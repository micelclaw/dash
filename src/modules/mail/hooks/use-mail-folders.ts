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

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import { useWebSocket } from '@/hooks/use-websocket';

export interface SystemFolderCount {
  folder: string;
  unread: number;
  total: number;
  /**
   * El reparto por cuenta, de la misma consulta agrupada del servidor.
   *
   * Lo necesita la fila de cada cuenta en la barra lateral: antes contaba los no
   * leídos sobre la PÁGINA CARGADA (50 correos), así que decía «23» mientras la
   * Entrada decía 1423.
   */
  by_account?: Array<{ account_id: string | null; unread: number; total: number }>;
}

export interface CustomFolderCount {
  account_id: string | null;
  folder: string;
  unread: number;
  total: number;
}

/**
 * Una etiqueta propia de Gmail, con la cuenta a la que pertenece.
 *
 * En Gmail no hay carpetas: lo que el usuario archivó vive en las etiquetas, así
 * que sin esto sus veinte etiquetas entran en la base de datos y no hay forma de
 * llegar a ellas desde la pantalla.
 */
export interface MailLabelCount {
  account_id: string | null;
  label: string;
  unread: number;
  total: number;
}

/**
 * The folders that actually hold mail, straight from the server.
 *
 * Before this, the sidebar rendered a fixed list of eight and counted unread over
 * the page currently loaded — so the provider's own folders were synced and then
 * unreachable, and the badges only ever matched for the open folder.
 */
export function useMailFolders() {
  const [system, setSystem] = useState<SystemFolderCount[]>([]);
  const [custom, setCustom] = useState<CustomFolderCount[]>([]);
  const [labels, setLabels] = useState<MailLabelCount[]>([]);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await api.get<{
        data: { system: SystemFolderCount[]; custom: CustomFolderCount[]; labels?: MailLabelCount[] };
      }>('/emails/folders');
      setSystem(res.data.system ?? []);
      setCustom(res.data.custom ?? []);
      setLabels(res.data.labels ?? []);
    } catch {
      // The list itself still works without counts; don't blank the sidebar.
    }
  }, []);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  // A sync is exactly when a folder can APPEAR: the first pass of a freshly
  // connected mailbox brings its own folders one at a time. Reading the list
  // only on mount meant they landed in the database and the sidebar kept showing
  // the same seven until the next full reload.
  const syncCompleted = useWebSocket('sync.completed');
  useEffect(() => {
    if (syncCompleted) fetchFolders();
  }, [syncCompleted, fetchFolders]);

  return { systemFolders: system, customFolders: custom, mailLabels: labels, refetchFolders: fetchFolders };
}
