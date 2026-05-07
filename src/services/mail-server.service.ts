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

// ─── Mail server admin service ──────────────────────────────────────
//
// Wraps `/api/v1/mail/server/*` endpoints used by MailServerSection.
// Cohesive admin domain: install / start / stop / hostname / relay /
// DNS check / send-test-email / credentials reveal.

import { api } from './api';

// ─── Types ──────────────────────────────────────────────────────────

export interface DnsCheck {
  status: 'pass' | 'warning' | 'fail';
  value: string | null;
  expected: string | null;
  message: string;
}

export interface DnsCheckResult {
  domain: string;
  server_ip: string;
  checked_at: string;
  checks: { mx: DnsCheck; spf: DnsCheck; dkim: DnsCheck; dmarc: DnsCheck; ptr: DnsCheck; port25: DnsCheck };
  overall: 'pass' | 'warning' | 'fail';
  recommendations: string[];
}

export interface MailServerStatus {
  installed: boolean;
  running: boolean;
  hostname: string;
  domains: string[];
  mailboxes_count: number;
  clamav_enabled: boolean;
  ram_mb: number | null;
  uptime_seconds: number | null;
  last_dns_check: DnsCheckResult | null;
  relay: { enabled: boolean; host: string } | null;
  ports: { smtp_25: string; submission_587: string; imaps_993: string };
}

export interface RelayConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'tls' | 'starttls' | 'none';
}

export interface RelayPreset {
  name: string;
  host: string;
  port: number;
  encryption: 'tls' | 'starttls';
  username_template: string;
  free_tier: string;
}

export interface MailCredentials {
  email: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  username: string;
  password: string;
}

// ─── Status / lifecycle ─────────────────────────────────────────────

export async function getStatus(): Promise<MailServerStatus> {
  const res = await api.get<{ data: MailServerStatus }>('/mail/server/status');
  return res.data;
}

/**
 * Start the mail server. On a first install, pass `setup` with the
 * desired hostname/email/password — backend will provision Mailu
 * with those credentials. On subsequent starts, omit `setup`.
 */
export async function start(setup?: {
  hostname: string;
  email: string;
  password: string;
}): Promise<void> {
  await api.post('/mail/server/start', setup);
}

export async function stop(): Promise<void> {
  await api.post('/mail/server/stop');
}

/** Recreate the container (slow op — 120s timeout). */
export async function recreate(): Promise<void> {
  await api.post('/mail/server/recreate', undefined, { timeout: 120_000 });
}

/** Uninstall (slow op — 60s timeout). */
export async function uninstall(): Promise<void> {
  await api.post('/mail/server/uninstall', undefined, { timeout: 60_000 });
}

export async function setHostname(hostname: string): Promise<void> {
  await api.put('/mail/server/hostname', { hostname });
}

// ─── DNS check ──────────────────────────────────────────────────────

export async function runDnsCheck(): Promise<DnsCheckResult> {
  const res = await api.post<{ data: DnsCheckResult }>('/mail/server/dns-check');
  return res.data;
}

// ─── Relay (outgoing SMTP) ──────────────────────────────────────────

export async function getRelay(): Promise<RelayConfig> {
  const res = await api.get<{ data: RelayConfig }>('/mail/server/relay');
  return res.data;
}

export async function getRelayPresets(): Promise<Record<string, RelayPreset>> {
  const res = await api.get<{ data: Record<string, RelayPreset> }>('/mail/server/relay/presets');
  return res.data;
}

export async function updateRelay(config: RelayConfig): Promise<void> {
  await api.put('/mail/server/relay', config);
}

export async function testRelay(email: string): Promise<{ success: boolean; error?: string }> {
  const res = await api.post<{ data: { success: boolean; error?: string } }>(
    '/mail/server/relay/test',
    { email },
  );
  return res.data;
}

// ─── Test email ─────────────────────────────────────────────────────

export interface TestEmailResult {
  success: boolean;
  message_id: string | null;
  error: string | null;
}

export async function sendTestEmail(email: string): Promise<TestEmailResult> {
  const res = await api.post<{ data: TestEmailResult }>('/mail/server/test-email', { email });
  return res.data;
}

// ─── Admin credentials ──────────────────────────────────────────────

export async function getAdminPassword(): Promise<{ email: string; password: string }> {
  const res = await api.get<{ data: { email: string; password: string } }>(
    '/mail/server/admin-password',
  );
  return res.data;
}

export async function getCredentials(): Promise<MailCredentials> {
  const res = await api.get<{ data: MailCredentials }>('/mail/server/credentials');
  return res.data;
}
