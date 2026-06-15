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

export async function patchDomain(id: string, body: { is_primary?: boolean; enabled?: boolean }): Promise<SystemDomain | null> {
  const res = await api.patch<{ data: SystemDomain | null }>(`/network/domains/${id}`, body);
  return res.data;
}

export async function deleteDomain(id: string): Promise<void> {
  await api.delete(`/network/domains/${id}`);
}

export async function setServiceExposure(slug: string, exposed: boolean): Promise<void> {
  await api.patch(`/network/domains/services/${slug}`, { exposed });
}

export async function getServices(): Promise<ServicesResponse> {
  const res = await api.get<{ data: ServicesResponse }>('/network/services');
  return res.data;
}
