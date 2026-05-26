/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Placeholder adapter used by tabs that haven't been wired yet
 * (sessions 6 + 7 replace these). Keeps the module navigable while
 * the shell lands first.
 */

import type { Adapter } from './types';

export function buildPlaceholderAdapter(
  tabKey: Adapter<never>['tabKey'],
  title: string,
): Adapter<{ id: string }> {
  return {
    tabKey,
    title,
    iconLabel: '·',
    filters: [],
    columns: [
      { key: 'message', label: 'Mensaje', render: () => 'Pendiente de cablear en la siguiente sesión.' },
    ],
    fetchSnapshot: async () => ({ rows: [] }),
    renderDetail: () => 'Pendiente.',
    getRowKey: (row) => row.id,
  };
}
