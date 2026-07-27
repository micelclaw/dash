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

// ─── Sync service ───────────────────────────────────────────────────
//
// Wraps `/api/v1/sync/*` endpoints used by SyncSection,
// DuplicatesSection, and ChannelObserversSection. Centralised so that
// connector / observer / duplicate operations live in a single
// service instead of being scattered across three sections.

import { api } from './api';

// ─── Types ──────────────────────────────────────────────────────────

export interface ConnectorInfo {
  id: string;
  connector_type: string;
  name: string;
  display_name: string | null;
  domains: string[];
  status: string;
  last_sync_at: string | null;
  errors_count: number;
}

export interface DuplicatePair {
  recordA: { id: string; domain: string; title: string; subtitle?: string };
  recordB: { id: string; domain: string; title: string; subtitle?: string };
  similarity: number;
  domain: string;
}

export interface ObserverPrivacy {
  direction_filter: 'all' | 'my_messages';
  content_filter: 'full' | 'metadata_only';
}

// ─── Catálogo y motor de descubrimiento de integraciones de datos ───
//
// El catálogo es la fuente única de qué proveedores existen y qué promete cada
// uno; el motor convierte una dirección de correo en una configuración. La UI no
// decide ninguna de las dos cosas: las pinta.

export interface DataProvider {
  slug: string;
  label: string;
  domains: ('mail' | 'calendar' | 'contacts')[];
  protocols: string[];
  auth_order: string[];
  discovery: string;
  mail_domains: string[];
  features: Record<string, boolean>;
  /** Fecha en que se probó contra un servidor REAL, o null si nunca. */
  verified: string | null;
  notes: string[];
  requires_own_oauth_client: boolean;
  preset_hint: string | null;
}

export interface DiscoveredEndpoint {
  kind: 'imap' | 'smtp';
  host: string;
  port: number;
  socket: 'ssl' | 'starttls' | 'plain';
  username_template?: string;
}

export interface DiscoveryResult {
  address: string;
  domain: string;
  candidate: {
    mechanism: string;
    confidence: 'high' | 'medium' | 'low';
    mail: DiscoveredEndpoint[];
    dav: { kind: 'caldav' | 'carddav'; url: string }[];
    notes?: string[];
  } | null;
  provider: DataProvider | null;
  auth_order: string[];
  manual_required: boolean;
  attempts: { mechanism: string; outcome: string; ms: number; detail?: string }[];
  total_ms: number;
}

export async function listDataProviders(): Promise<DataProvider[]> {
  const res = await api.get<{ data: { providers: DataProvider[] } }>('/sync/providers');
  return res.data?.providers ?? [];
}

/**
 * `catalogOnly` es el atajo del botón con logo: identifica al proveedor por su
 * dominio y devuelve su preset SIN tocar la red.
 */
export async function discoverProvider(address: string, catalogOnly = false): Promise<DiscoveryResult> {
  const res = await api.post<{ data: DiscoveryResult }>('/sync/discover', {
    address,
    catalog_only: catalogOnly,
  });
  return res.data;
}

// ─── Connectors ─────────────────────────────────────────────────────

export async function listConnectors(): Promise<ConnectorInfo[]> {
  const res = await api.get<{ data: ConnectorInfo[] }>('/sync/connectors');
  return res.data ?? [];
}

export async function getConnector<T = Record<string, unknown>>(connectorId: string): Promise<T> {
  const res = await api.get<{ data: T }>(`/sync/connectors/${connectorId}`);
  return res.data;
}

export async function createConnector(body: Record<string, unknown>): Promise<void> {
  await api.post('/sync/connectors', body);
}

/** Qué hizo DE VERDAD el backend con el botón de la fila (el toast se deriva de esto). */
export type ConnectorRunAction =
  | 'sync_started'
  | 'stream_reconnected'
  | 'stream_already_live'
  | 'refreshed'
  | 'noop';

export async function runConnector(connectorId: string): Promise<ConnectorRunAction> {
  const res = await api.post<{ data: { action?: ConnectorRunAction } }>(
    `/sync/connectors/${connectorId}/run`,
  );
  return res.data?.action ?? 'sync_started';
}

export async function pauseConnector(connectorId: string): Promise<void> {
  await api.post(`/sync/connectors/${connectorId}/pause`);
}

export async function resumeConnector(connectorId: string): Promise<void> {
  await api.post(`/sync/connectors/${connectorId}/resume`);
}

export async function deleteConnector(connectorId: string): Promise<void> {
  await api.delete(`/sync/connectors/${connectorId}`);
}

export async function updateConnectorConfig(
  connectorId: string,
  config: Record<string, unknown>,
): Promise<void> {
  await api.patch(`/sync/connectors/${connectorId}/config`, config);
}

// ─── Test connection (used by IMAP / DAV forms) ───────────────────

export interface TestConnectionResult {
  ok: boolean;
  error?: string;
  folders?: string[];
}

export async function testConnection(body: Record<string, unknown>): Promise<TestConnectionResult> {
  const res = await api.post<{ data: TestConnectionResult }>('/sync/test-connection', body);
  return res.data;
}

// ─── OAuth ─────────────────────────────────────────────────────────

export async function getOAuthAuthorizeUrl(
  provider: string,
  scopes: string,
): Promise<{ authorize_url: string; state: string }> {
  const res = await api.get<{ data: { authorize_url: string; state: string } }>(
    `/sync/oauth/authorize/${provider}?scopes=${encodeURIComponent(scopes)}`,
  );
  return res.data;
}

export async function oauthCallback(body: Record<string, unknown>): Promise<void> {
  await api.post('/sync/oauth/callback', body);
}

export async function deleteOAuthCredentials(provider: string): Promise<void> {
  await api.delete(`/sync/oauth/${provider}`);
}

// ─── Duplicates ─────────────────────────────────────────────────────

export async function listDuplicates(): Promise<DuplicatePair[]> {
  const res = await api.get<{ data: DuplicatePair[] }>('/sync/duplicates');
  return res.data ?? [];
}

export async function dismissDuplicate(params: {
  record_a_id: string;
  record_b_id: string;
  domain: string;
}): Promise<void> {
  await api.post('/sync/duplicates/dismiss', params);
}

// ─── Observer privacy ───────────────────────────────────────────────

export async function getObserverPrivacy(): Promise<ObserverPrivacy> {
  const res = await api.get<{ data: ObserverPrivacy }>('/sync/observers/privacy');
  return res.data;
}

export async function updateObserverPrivacy(privacy: ObserverPrivacy): Promise<void> {
  await api.patch('/sync/observers/privacy', privacy);
}

// ─── Per-connector channel selection (used by ChannelConfigModal) ──

export interface ConnectorChannelInfo {
  id: string;
  name: string;
  type: string;
  /** Plataforma real del chat (hub Matrix: telegram/messenger/…). */
  platform?: string;
  member_count?: number;
  message_count?: number;
  purpose?: string;
  topic?: string;
}

export interface ObservedChannel {
  id: string;
  name: string;
  type: string;
  platform?: string;
}

/**
 * List the channels available for a connector + which ones are
 * currently observed. Some connectors (Signal) need to spin up a CLI
 * container first; pass `timeoutMs` to extend the request timeout
 * for those.
 */
export async function getConnectorChannels(
  connectorId: string,
  options: { timeoutMs?: number; platform?: string } = {},
): Promise<{
  channels: ConnectorChannelInfo[];
  selected: string[];
}> {
  const res = await api.get<{
    data: { channels: ConnectorChannelInfo[]; selected: string[] };
  }>(
    `/sync/connectors/${connectorId}/channels`,
    // El hub Matrix mete Telegram/Messenger/Google Messages en UN connector, así
    // que el selector filtra por plataforma: en la fila de Telegram solo salen
    // chats de Telegram.
    options.platform ? { platform: options.platform } : undefined,
    options.timeoutMs ? { timeout: options.timeoutMs } : undefined,
  );
  return res.data;
}

export async function updateConnectorChannels(
  connectorId: string,
  body: {
    observed_channels: ObservedChannel[];
    direction_filter?: 'all' | 'my_messages';
    content_filter?: 'full' | 'metadata_only';
  },
): Promise<void> {
  await api.patch(`/sync/connectors/${connectorId}/channels`, body);
}

// ─── WhatsApp import (used by WhatsAppImportDialog) ────────────────

export interface WhatsAppImportPreview {
  message_count: number;
  participants: string[];
  chat_name: string;
  date_range: { earliest: string; latest: string } | null;
}

export async function previewWhatsAppImport(
  file: File,
  ownName?: string,
): Promise<WhatsAppImportPreview> {
  const formData = new FormData();
  formData.append('file', file);
  if (ownName) formData.append('own_name', ownName);
  const res = await api.upload<{ data: WhatsAppImportPreview }>(
    '/sync/import/whatsapp?preview=true',
    formData,
  );
  return res.data;
}

export async function commitWhatsAppImport(
  file: File,
  ownName?: string,
): Promise<{ imported: number }> {
  const formData = new FormData();
  formData.append('file', file);
  if (ownName) formData.append('own_name', ownName);
  const res = await api.upload<{ data: { imported: number } }>(
    '/sync/import/whatsapp?commit=true',
    formData,
  );
  return res.data;
}
