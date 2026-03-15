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

import { create } from 'zustand';
import type {
  GatewayStatus,
  GatewayHealth,
  GatewayChannel,
  GatewayModel,
  GatewaySession,
  GatewayUsage,
  CronJob,
  LogEntry,
} from '@/modules/gateway/types';
import * as gw from '@/services/gateway.service';

interface GatewayStore {
  // State
  status: GatewayStatus | null;
  health: GatewayHealth | null;
  channels: GatewayChannel[];
  models: GatewayModel[];
  sessions: GatewaySession[];
  usage: GatewayUsage | null;
  cronJobs: CronJob[];
  logs: LogEntry[];

  // Loading / error per section
  statusLoading: boolean;
  statusError: string | null;
  channelsLoading: boolean;
  channelsError: string | null;
  modelsLoading: boolean;
  modelsError: string | null;
  sessionsLoading: boolean;
  sessionsError: string | null;
  cronLoading: boolean;
  cronError: string | null;
  logsLoading: boolean;
  logsError: string | null;

  // Actions
  fetchSnapshot: () => Promise<void>;
  fetchStatus: () => Promise<void>;
  fetchHealth: () => Promise<void>;
  fetchChannels: () => Promise<void>;
  fetchModels: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  fetchUsage: () => Promise<void>;
  fetchCronJobs: () => Promise<void>;
  fetchLogs: (limit?: number) => Promise<void>;
  gatewayStart: () => Promise<void>;
  gatewayStop: () => Promise<void>;
  gatewayRestart: () => Promise<void>;
}

export const useGatewayStore = create<GatewayStore>()((set) => ({
  status: null,
  health: null,
  channels: [],
  models: [],
  sessions: [],
  usage: null,
  cronJobs: [],
  logs: [],

  statusLoading: false,
  statusError: null,
  channelsLoading: false,
  channelsError: null,
  modelsLoading: false,
  modelsError: null,
  sessionsLoading: false,
  sessionsError: null,
  cronLoading: false,
  cronError: null,
  logsLoading: false,
  logsError: null,

  fetchSnapshot: async () => {
    set({ statusLoading: true, statusError: null });
    try {
      const snap = await gw.getSnapshot();
      set({
        status: snap.status,
        health: snap.health,
        channels: snap.channels?.channels ?? [],
        models: snap.models?.models ?? [],
        sessions: snap.sessions?.sessions ?? [],
        statusLoading: false,
        channelsLoading: false,
        modelsLoading: false,
        sessionsLoading: false,
      });

      // If runtime data wasn't ready (CLI still warming up), re-fetch in 3s
      if (!snap._runtime_ready) {
        setTimeout(async () => {
          try {
            const retry = await gw.getSnapshot();
            set({
              status: retry.status,
              health: retry.health,
              sessions: retry.sessions?.sessions ?? [],
            });
          } catch {
            // Silent — next polling cycle will pick it up
          }
        }, 3_000);
      }
    } catch (err) {
      set({
        statusError: err instanceof Error ? err.message : 'Failed to fetch snapshot',
        statusLoading: false,
      });
    }
  },

  fetchStatus: async () => {
    set({ statusLoading: true, statusError: null });
    try {
      const [status, health] = await Promise.all([
        gw.getGatewayStatus(),
        gw.getGatewayHealth(),
      ]);
      set({ status, health, statusLoading: false });
    } catch (err) {
      set({
        statusError: err instanceof Error ? err.message : 'Failed to fetch status',
        statusLoading: false,
      });
    }
  },

  fetchHealth: async () => {
    try {
      const health = await gw.getGatewayHealth();
      set({ health });
    } catch {
      // Silently fail — status page handles errors
    }
  },

  fetchChannels: async () => {
    set({ channelsLoading: true, channelsError: null });
    try {
      const channels = await gw.getChannels();
      set({ channels, channelsLoading: false });
    } catch (err) {
      set({
        channelsError: err instanceof Error ? err.message : 'Failed to fetch channels',
        channelsLoading: false,
      });
    }
  },

  fetchModels: async () => {
    set({ modelsLoading: true, modelsError: null });
    try {
      const models = await gw.getModels();
      set({ models, modelsLoading: false });
    } catch (err) {
      set({
        modelsError: err instanceof Error ? err.message : 'Failed to fetch models',
        modelsLoading: false,
      });
    }
  },

  fetchSessions: async () => {
    set({ sessionsLoading: true, sessionsError: null });
    try {
      const sessions = await gw.getSessions();
      set({ sessions, sessionsLoading: false });
    } catch (err) {
      set({
        sessionsError: err instanceof Error ? err.message : 'Failed to fetch sessions',
        sessionsLoading: false,
      });
    }
  },

  fetchUsage: async () => {
    try {
      const usage = await gw.getUsage();
      set({ usage });
    } catch {
      // Non-critical
    }
  },

  fetchCronJobs: async () => {
    set({ cronLoading: true, cronError: null });
    try {
      const cronJobs = await gw.getCronJobs();
      set({ cronJobs, cronLoading: false });
    } catch (err) {
      set({
        cronError: err instanceof Error ? err.message : 'Failed to fetch cron jobs',
        cronLoading: false,
      });
    }
  },

  fetchLogs: async (limit = 200) => {
    set({ logsLoading: true, logsError: null });
    try {
      const logs = await gw.getLogs(limit);
      set({ logs, logsLoading: false });
    } catch (err) {
      set({
        logsError: err instanceof Error ? err.message : 'Failed to fetch logs',
        logsLoading: false,
      });
    }
  },

  gatewayStart: async () => {
    await gw.startGateway();
  },

  gatewayStop: async () => {
    await gw.stopGateway();
  },

  gatewayRestart: async () => {
    await gw.restartGateway();
  },
}));
