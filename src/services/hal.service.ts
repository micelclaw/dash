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

// ─── HAL service (Hardware Abstraction Layer) ───────────────────────
//
// Wraps `/api/v1/hal/*` endpoints used by the System group of Settings:
//   - energy: power status, UPS, suspend/hibernate/reboot/shutdown, WoL
//   - network: VPN status, proxy routes, firewall rules + services
//   - storage: detected provider + re-detect
//
// Centralised here so the 3 sections that hit HAL endpoints
// (EnergySection, NetworkSection, StorageSection) don't each carry
// their own `api.get('/hal/...')` calls. Aligns with the convention
// already used by gateway.service.ts and auth.service.ts.

import { api } from './api';

// ─── Types ──────────────────────────────────────────────────────────

export interface PowerState {
  on_ac: boolean;
  battery_present: boolean;
  battery_percent: number | null;
  battery_status: string;
  estimated_minutes: number | null;
  temperature_celsius: number | null;
}

export interface UpsStatus {
  available: boolean;
  model: string;
  status: string;
  battery_charge: number;
  runtime_seconds: number;
  input_voltage: number | null;
}

export interface ProxyRoute {
  id: string;
  path: string;
  upstream: string;
  description?: string;
}

export interface ProxyStatus {
  running: boolean;
  domain?: string;
  routes_count: number;
}

export interface VpnStatus {
  enabled: boolean;
  interface_up: boolean;
  peers_count: number;
  listen_port?: number;
}

export interface FirewallStatus {
  active: boolean;
  rules_count: number;
  backend: string;
}

export interface FirewallRule {
  id: string;
  port: number;
  protocol: string;
  direction: string;
  action: string;
  source?: string;
  description?: string;
}

export interface FirewallService {
  name: string;
  port: number;
  protocol: string;
  lan_allowed: boolean;
  external_allowed: boolean;
}

export interface FirewallServicePolicy {
  lan_allowed: boolean;
  external_allowed: boolean;
}

// ─── Energy ─────────────────────────────────────────────────────────

export async function getPowerStatus(): Promise<PowerState> {
  const res = await api.get<{ data: PowerState }>('/hal/energy/status');
  return res.data;
}

export async function getUpsStatus(): Promise<UpsStatus | null> {
  const res = await api.get<{ data: UpsStatus | null }>('/hal/energy/ups');
  return res.data;
}

/** Endpoint string only — kept here for the Power Actions section
 *  which iterates over `{ id, label, endpoint }` rows and POSTs to
 *  the matching path. The shared map keeps the URL pattern in one
 *  place if it ever changes. */
export const ENERGY_ACTIONS = {
  suspend: '/hal/energy/suspend',
  hibernate: '/hal/energy/hibernate',
  reboot: '/hal/energy/reboot',
  shutdown: '/hal/energy/shutdown',
} as const;

export async function performEnergyAction(action: keyof typeof ENERGY_ACTIONS): Promise<void> {
  await api.post(ENERGY_ACTIONS[action]);
}

export async function sendWakeOnLan(mac: string): Promise<void> {
  await api.post('/hal/energy/wol', { mac });
}

// ─── Network: VPN ───────────────────────────────────────────────────

export async function getVpnStatus(): Promise<VpnStatus> {
  const res = await api.get<{ data: VpnStatus }>('/hal/network/vpn/status');
  return res.data;
}

// ─── Network: Proxy ─────────────────────────────────────────────────

export async function getProxyStatus(): Promise<ProxyStatus> {
  const res = await api.get<{ data: ProxyStatus }>('/hal/network/proxy/status');
  return res.data;
}

export async function getProxyRoutes(): Promise<ProxyRoute[]> {
  const res = await api.get<{ data: ProxyRoute[] }>('/hal/network/proxy/routes');
  return res.data;
}

export async function controlProxy(
  action: 'start' | 'stop' | 'restart' | 'reload',
): Promise<{ action: string; logs: string[]; success: boolean }> {
  const res = await api.post<{ data: { action: string; logs: string[]; success: boolean } }>(
    `/hal/network/proxy/${action}`,
  );
  return res.data;
}

export async function addProxyRoute(route: Omit<ProxyRoute, 'id'>): Promise<void> {
  await api.post('/hal/network/proxy/routes', route);
}

export async function deleteProxyRoute(id: string): Promise<void> {
  await api.delete(`/hal/network/proxy/routes/${id}`);
}

// ─── Network: Firewall ──────────────────────────────────────────────

export async function getFirewallStatus(): Promise<FirewallStatus> {
  const res = await api.get<{ data: FirewallStatus }>('/hal/firewall/status');
  return res.data;
}

export async function getFirewallRules(): Promise<FirewallRule[]> {
  const res = await api.get<{ data: FirewallRule[] }>('/hal/firewall/rules');
  return res.data;
}

export async function setFirewallEnabled(enabled: boolean): Promise<void> {
  await api.post(`/hal/firewall/${enabled ? 'enable' : 'disable'}`);
}

export async function addFirewallRule(rule: Omit<FirewallRule, 'id'>): Promise<void> {
  await api.post('/hal/firewall/rules', rule);
}

export async function deleteFirewallRule(id: string): Promise<void> {
  await api.delete(`/hal/firewall/rules/${id}`);
}

export async function getFirewallServices(): Promise<FirewallService[]> {
  const res = await api.get<{ data: FirewallService[] }>('/hal/firewall/services');
  return res.data;
}

export async function updateFirewallServicePolicy(
  name: string,
  policy: FirewallServicePolicy,
): Promise<void> {
  await api.put(`/hal/firewall/services/${name}`, policy);
}

// ─── Storage ────────────────────────────────────────────────────────

export async function getStorageProvider(): Promise<{ provider: string }> {
  const res = await api.get<{ data: { provider: string } }>('/hal/storage/capabilities');
  return res.data;
}

export async function detectStorageProvider(): Promise<void> {
  await api.post('/hal/storage/detect-provider');
}
