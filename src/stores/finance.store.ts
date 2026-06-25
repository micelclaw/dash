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

// ─── Finance store ───────────────────────────────────────────────────
// Estado de la suite financiera (Firefly III + SolidInvoice). Lo consume el
// FinanceLauncher (rejilla de apps). Las pantallas de cada app (FinanceEmbed)
// gestionan su propio ciclo install/start/embed.

import { create } from 'zustand';
import { api } from '@/services/api';

export type FinanceAppName = 'firefly' | 'solidinvoice';

export interface FinanceAppStatus {
  name: FinanceAppName;
  installed: boolean;
  running: boolean;
  url: string | null;
  embed_url: string | null;
  database: string;
  ram_mb: number | null;
}

export interface FinanceSuiteStatus {
  mariadb: { installed: boolean; running: boolean; ram_mb: number | null };
  apps: FinanceAppStatus[];
}

interface FinanceState {
  status: FinanceSuiteStatus | null;
  loading: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set) => ({
  status: null,
  loading: false,
  error: null,
  fetchStatus: async () => {
    set({ loading: true, error: null });
    try {
      const envelope = await api.get<{ data: FinanceSuiteStatus }>('/finance/status');
      set({ status: envelope.data, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load finance status', loading: false });
    }
  },
}));
