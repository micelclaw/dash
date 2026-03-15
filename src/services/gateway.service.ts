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

// ─── Gateway API service — wraps /api/v1/gateway/* endpoints ────────

import { api } from './api';
import type {
  GatewayStatus,
  GatewayHealth,
  GatewayChannel,
  GatewayModel,
  GatewaySession,
  GatewayUsage,
  CronJob,
  CronRun,
  LogEntry,
} from '@/modules/gateway/types';

// ─── Snapshot (single request for all data) ─────────────────────────

export interface GatewaySnapshot {
  status: GatewayStatus;
  health: GatewayHealth;
  channels: { channels: GatewayChannel[]; auth_providers: unknown[] };
  models: { models: GatewayModel[]; default_model?: string; fallbacks?: string[]; aliases?: Record<string, string> };
  sessions: { count: number; sessions: GatewaySession[] };
  _runtime_ready?: boolean;
}

export async function getSnapshot(): Promise<GatewaySnapshot> {
  const res = await api.get<{ data: GatewaySnapshot }>('/gateway/snapshot');
  return res.data;
}

// ─── Status & Health ────────────────────────────────────────────────

export async function getGatewayStatus(): Promise<GatewayStatus> {
  const res = await api.get<{ data: GatewayStatus }>('/gateway/status');
  return res.data;
}

export async function getGatewayHealth(): Promise<GatewayHealth> {
  const res = await api.get<{ data: GatewayHealth }>('/gateway/health');
  return res.data;
}

// ─── Actions ────────────────────────────────────────────────────────

export async function startGateway(): Promise<void> {
  await api.post('/gateway/start');
}

export async function stopGateway(): Promise<void> {
  await api.post('/gateway/stop');
}

export async function restartGateway(): Promise<void> {
  await api.post('/gateway/restart');
}

// ─── Channels ───────────────────────────────────────────────────────

export async function getChannels(): Promise<GatewayChannel[]> {
  const res = await api.get<{ data: { channels: GatewayChannel[] } | GatewayChannel[] }>('/gateway/channels');
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object' && 'channels' in d) return (d as { channels: GatewayChannel[] }).channels;
  return [];
}

export async function addChannel(params: {
  channel: string;
  account?: string;
  name?: string;
  token?: string;
}): Promise<unknown> {
  const res = await api.post<{ data: unknown }>('/gateway/channels', params);
  return res.data;
}

export async function removeChannel(
  type: string,
  account?: string,
  deleteCreds = false,
): Promise<void> {
  const params: Record<string, string> = {};
  if (account) params.account = account;
  if (deleteCreds) params.delete = 'true';
  await api.delete(`/gateway/channels/${type}`, params);
}

export async function loginChannel(type: string, account?: string): Promise<unknown> {
  const params: Record<string, string> = {};
  if (account) params.account = account;
  const res = await api.post<{ data: unknown }>(
    `/gateway/channels/${type}/login`,
    undefined,
    { timeout: 60_000 },
  );
  return res.data;
}

export async function logoutChannel(type: string, account?: string): Promise<void> {
  await api.post(`/gateway/channels/${type}/logout`);
}

// ─── Models ─────────────────────────────────────────────────────────

export async function getModels(): Promise<GatewayModel[]> {
  const res = await api.get<{ data: GatewayModel[] | { models: GatewayModel[] } }>('/gateway/models');
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object' && 'models' in d) return (d as { models: GatewayModel[] }).models;
  return [];
}

export async function setDefaultModel(model: string): Promise<void> {
  await api.post('/gateway/models/default', { model });
}

// ─── Sessions ───────────────────────────────────────────────────────

export async function getSessions(verbose = false): Promise<GatewaySession[]> {
  const res = await api.get<{ data: GatewaySession[] | { sessions: GatewaySession[] } }>(
    '/gateway/sessions',
    { verbose: verbose ? 'true' : undefined },
  );
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object' && 'sessions' in d) return (d as { sessions: GatewaySession[] }).sessions;
  return [];
}

// ─── Usage ──────────────────────────────────────────────────────────

export async function getUsage(): Promise<GatewayUsage> {
  const res = await api.get<{ data: GatewayUsage }>('/gateway/usage');
  return res.data;
}

// ─── Cron ───────────────────────────────────────────────────────────

export async function getCronJobs(): Promise<CronJob[]> {
  const res = await api.get<{ data: CronJob[] | { jobs: CronJob[] } }>('/gateway/cron');
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object' && 'jobs' in d) return (d as { jobs: CronJob[] }).jobs;
  return [];
}

export async function addCronJob(params: {
  name: string;
  schedule: string;
  schedule_type: 'at' | 'every' | 'cron';
  action: 'system-event' | 'message';
  payload: string;
  target?: string;
  channel?: string;
}): Promise<unknown> {
  const res = await api.post<{ data: unknown }>('/gateway/cron', params);
  return res.data;
}

export async function editCronJob(id: string, params: Record<string, string>): Promise<unknown> {
  const res = await api.patch<{ data: unknown }>(`/gateway/cron/${id}`, params);
  return res.data;
}

export async function deleteCronJob(id: string): Promise<void> {
  await api.delete(`/gateway/cron/${id}`);
}

export async function toggleCronJob(id: string, enabled: boolean): Promise<void> {
  await api.post(`/gateway/cron/${id}/toggle`, { enabled });
}

export async function runCronJob(id: string): Promise<unknown> {
  const res = await api.post<{ data: unknown }>(`/gateway/cron/${id}/run`, undefined, { timeout: 60_000 });
  return res.data;
}

export async function getCronRuns(id: string, limit = 20): Promise<CronRun[]> {
  const res = await api.get<{ data: CronRun[] | { runs: CronRun[] } }>(
    `/gateway/cron/${id}/runs`,
    { limit: String(limit) },
  );
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object' && 'runs' in d) return (d as { runs: CronRun[] }).runs;
  return [];
}

// ─── Logs ───────────────────────────────────────────────────────────

export async function getLogs(limit = 200): Promise<LogEntry[]> {
  const res = await api.get<{ data: LogEntry[] | { entries: LogEntry[] } }>(
    '/gateway/logs',
    { limit: String(limit) },
  );
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object' && 'entries' in d) return (d as { entries: LogEntry[] }).entries;
  return [];
}
