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

// ─── System Domains Service ──────────────────────────────────────────
// Cliente del "dominio principal del sistema" (/network/domains + /network/services).

import { api } from './api';

export type DomainKind = 'local' | 'micelclaw' | 'own';

export interface DomainService {
  slug: string;
  subdomain: string;
  display_name: string;
  port: number;
  exposed: boolean;
  url: string; // https://<subdomain>.<domain>
}

export interface SystemDomain {
  id: string;
  domain: string;
  kind: DomainKind;
  is_primary: boolean;
  enabled: boolean;
  status: string;       // active | pending_dns | pending_cert | error
  wildcard_ip: string | null;
  error_message: string | null;
  services: DomainService[];
}

export interface ServiceCatalogEntry {
  slug: string;
  subdomain: string;
  display_name: string;
  port: number;
  category: string;
  exposed: boolean;
  url: string | null;   // null si no hay dominio primario
}

export interface ServicesResponse {
  primary_domain: string | null;
  services: ServiceCatalogEntry[];
}

export async function getDomains(): Promise<SystemDomain[]> {
  const res = await api.get<{ data: SystemDomain[] }>('/network/domains');
  return res.data;
}

export async function addDomain(domain: string, kind: DomainKind, makePrimary?: boolean): Promise<SystemDomain> {
  const res = await api.post<{ data: SystemDomain }>('/network/domains', {
    domain, kind, make_primary: makePrimary,
  });
  return res.data;
}

export async function updateDomain(id: string, body: { is_primary?: boolean; enabled?: boolean }): Promise<SystemDomain | null> {
  const res = await api.patch<{ data: SystemDomain | null }>(`/network/domains/${id}`, body);
  return res.data;
}

export async function deleteDomain(id: string): Promise<void> {
  await api.delete(`/network/domains/${id}`);
}

export async function resyncDomain(id: string): Promise<SystemDomain> {
  const res = await api.post<{ data: SystemDomain }>(`/network/domains/${id}/resync`);
  return res.data;
}

export interface LocalDomainSetup {
  lan_ip: string;
  tld: string;
}

export async function getLocalDomainSetup(): Promise<LocalDomainSetup> {
  const res = await api.get<{ data: LocalDomainSetup }>('/dns/local-domains/setup');
  return res.data;
}

export async function setServiceExposure(slug: string, exposed: boolean): Promise<void> {
  await api.patch(`/network/domains/services/${slug}`, { exposed });
}

export async function getServices(): Promise<ServicesResponse> {
  const res = await api.get<{ data: ServicesResponse }>('/network/services');
  return res.data;
}

// ─── Hosts-sync (agente del anfitrión) ───────────────────────────────

export interface HostSyncStatus {
  supported: boolean;
  platform: 'windows-wsl' | 'macos' | 'linux' | 'headless' | 'unsupported';
  installed: boolean;
  state?: string;
  last_run?: string | null;
  reason?: string;
  message?: string;
}

export interface HostsBlock {
  block: string;
  entries: { ip: string; name: string }[];
  hash: string;
  domains: string[];
}

export async function getHostSyncStatus(): Promise<HostSyncStatus> {
  // Estado vivo (instalado o no) → no_cache para esquivar la caché semántica de GETs.
  const res = await api.get<{ data: HostSyncStatus }>('/network/hosts-sync/status?no_cache=true');
  return res.data;
}

export async function installHostSyncLocal(): Promise<HostSyncStatus> {
  const res = await api.post<{ data: HostSyncStatus }>('/network/hosts-sync/local');
  return res.data;
}

export async function getHostsBlock(): Promise<HostsBlock> {
  const res = await api.get<{ data: HostsBlock }>('/network/hosts-block?no_cache=true');
  return res.data;
}

// ─── Agente mDNS del anfitrión ───────────────────────────────────────
// Publica el nombre `.local` por el que un móvil encuentra el servidor sin saber
// ninguna IP. Vive en el ANFITRIÓN (Windows) porque el multicast de WSL2 está
// muerto; instalarlo crea una tarea programada → pide permiso de administrador una
// vez, igual que la regla de firewall. Admin-only.
export interface MdnsAgentStatus {
  supported: boolean;
  exe_present: boolean;
  task_installed: boolean | null;
  running: boolean | null;
  announced_name?: string;
  message?: string;
}

export async function getMdnsAgentStatus(): Promise<MdnsAgentStatus> {
  const res = await api.get<{ data: MdnsAgentStatus }>('/network/mdns-agent');
  return res.data;
}

export async function installMdnsAgent(): Promise<MdnsAgentStatus> {
  const res = await api.post<{ data: MdnsAgentStatus }>('/network/mdns-agent', {});
  return res.data;
}
