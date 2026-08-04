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
  /** Causa del último fallo, con su pista. Vacío si no ha fallado. */
  last_error?: string | null;
  /**
   * Cambios locales que agotaron los reintentos y NO llegaron al proveedor.
   *
   * Va aparte de `last_error` porque son cosas distintas: un `runSync` puede
   * terminar bien (la tarjeta en verde) y aun así haber un correo destacado aquí
   * que allí no se marcó nunca. Hasta ahora eso no salía por ninguna puerta.
   */
  push_failed_count?: number;
  /** La causa del más reciente de esos cambios, tal cual la dio el proveedor. */
  push_last_error?: string | null;
  id: string;
  connector_type: string;
  name: string;
  display_name: string | null;
  domains: string[];
  status: string;
  last_sync_at: string | null;
  errors_count: number;
  /**
   * La cuenta de correo a la que pertenece, si tiene una. Es lo que permite
   * agrupar las tarjetas y encontrar el connector que acaba de crear un alta,
   * sin adivinar por el nombre.
   */
  account_id?: string | null;
  /**
   * El proveedor de MARCA (Synology/Nextcloud/Google/…), resuelto por el
   * servidor (`resolveProviderSlug`): prioridad a lo que persistió el alta en
   * `config.provider` para un proveedor ambiguo por protocolo (CalDAV/CardDAV/
   * IMAP genérico), luego el `providerSlug` que el TIPO declara en el catálogo.
   * `null` si no hay proveedor determinable (nunca se adivina).
   */
  provider_slug?: string | null;
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
  /** ¿Se conecta con la aplicación que trae Micelclaw, o con una registrada aquí? */
  uses_shipped_oauth_client?: boolean;
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

export interface ConnectorDataSummary {
  connector_id: string;
  connector_type: string;
  domain: 'mail' | 'calendar' | 'contacts' | null;
  /** Cuántos registros se llevaría por delante desconectar. */
  records: number;
  account: string | null;
  /** El recuento incluye lo de otras integraciones del mismo tipo. */
  shared_scope: boolean;
  /** Del mismo origen pero sin dueño demostrable: NO se borran (ver INT128). */
  orphans?: number;
}

/** Qué hay dentro de una integración. Lo enseña el diálogo ANTES de borrar. */
export async function getConnectorDataSummary(connectorId: string): Promise<ConnectorDataSummary> {
  const res = await api.get<{ data: ConnectorDataSummary }>(`/sync/connectors/${connectorId}/data-summary`);
  return res.data;
}

export interface CollectionItem {
  id: string;
  name: string;
  count?: number;
}

export interface ConnectorCollections {
  connector_id: string;
  connector_type: string;
  /** Clave de config donde viven las elegidas (`folders`, `labels`, `calendars`…). */
  key: string;
  /** Cómo se llaman en castellano, para la pregunta de la ventana 4. */
  noun: string;
  collections: CollectionItem[];
  selected: string[];
}

/**
 * Lo que hay DENTRO de una integración: carpetas, calendarios o libretas, tal y
 * como las devuelve el servidor del proveedor. Nunca una lista plausible.
 */
export async function getConnectorCollections(connectorId: string): Promise<ConnectorCollections> {
  const res = await api.get<{ data: ConnectorCollections }>(`/sync/connectors/${connectorId}/collections`);
  return res.data;
}

/** Guarda lo elegido. Lista vacía = traérselo todo. */
export async function saveConnectorCollections(
  connectorId: string,
  selected: string[],
): Promise<{ key: string; selected: string[] }> {
  const res = await api.put<{ data: { key: string; selected: string[] } }>(
    `/sync/connectors/${connectorId}/collections`,
    { selected },
  );
  return res.data;
}

/** Retira los datos que trajo la integración (criterio I8-2 del playbook). */
export async function purgeConnectorData(connectorId: string): Promise<{ removed: number }> {
  const res = await api.post<{ data: { removed: number } }>(`/sync/connectors/${connectorId}/purge-data`, {});
  return res.data;
}

/** Un tipo de conector, tal y como lo declara el catálogo del servidor. */
export interface ConnectorTypeMeta {
  type: string;
  label: string;
  protocol: string;
  domains: string[];
  provider_slug: string | null;
  oauth_provider: string | null;
  /**
   * Si no se crea por el camino genérico, POR DÓNDE sí (una cuenta de correo,
   * una autorización). La pantalla lo usa para mandar al sitio correcto en vez
   * de ofrecer un formulario que va a ser rechazado.
   */
  created_by: string | null;
}

/**
 * El catálogo. `domain` lo FILTRA en el servidor, que es lo que hace que cada
 * ventana 2 sea distinta: Nextcloud sale en calendario y no en correo, porque no
 * aloja buzones.
 */
export async function listDataProviders(domain?: 'mail' | 'calendar' | 'contacts'): Promise<DataProvider[]> {
  const q = domain ? `?domain=${encodeURIComponent(domain)}` : '';
  const res = await api.get<{ data: { providers: DataProvider[] } }>(`/sync/providers${q}`);
  return res.data?.providers ?? [];
}

/**
 * Proveedores Y tipos de conector en UNA llamada. Los tipos vienen del mismo
 * catálogo para que la pantalla no mantenga su propio mapa de etiquetas — ése
 * era uno de los mapas paralelos que este arco vino a matar, y repetirlo aquí
 * sería reabrirlo por la otra punta.
 */
export async function listDataCatalog(domain?: 'mail' | 'calendar' | 'contacts'): Promise<{
  providers: DataProvider[];
  connectorTypes: ConnectorTypeMeta[];
}> {
  const q = domain ? `?domain=${encodeURIComponent(domain)}` : '';
  const res = await api.get<{ data: { providers: DataProvider[]; connector_types?: ConnectorTypeMeta[] } }>(
    `/sync/providers${q}`,
  );
  return {
    providers: res.data?.providers ?? [],
    connectorTypes: res.data?.connector_types ?? [],
  };
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

/**
 * Desconecta una integración. Se lleva por delante lo que trajo (criterio I8-2
 * del playbook) y devuelve cuántos registros retiró, para poder decirlo.
 */
export async function deleteConnector(connectorId: string): Promise<{ records_removed: number }> {
  const res = await api.delete<{ data?: { records_removed?: number } }>(`/sync/connectors/${connectorId}`);
  return { records_removed: res?.data?.records_removed ?? 0 };
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

/** Cierra la autorización y devuelve la integración creada (para la ventana 4). */
/**
 * Un código de autorización se canja UNA vez, y aquí se garantiza.
 *
 * La ventana emergente avisa con un `postMessage`, y ese aviso lo puede oír más
 * de un componente montado (el asistente de datos y el de canales tienen cada
 * uno su escucha). Cuando pasaba, el segundo canje llegaba con el código ya
 * gastado y el proveedor respondía «the code has expired» — un error alarmante
 * para el usuario justo después de que TODO hubiera ido bien: la integración
 * quedaba creada y aun así veía un aviso rojo.
 *
 * En vez de perseguir cuántas escuchas hay (que cambiará con el tiempo), se
 * memoriza la promesa por `state`: quien llegue después recibe el MISMO
 * resultado en vez de gastar el código otra vez.
 */
const canjesEnCurso = new Map<string, Promise<{ id: string; provider: string; status: string }>>();

export async function oauthCallback(
  body: Record<string, unknown>,
): Promise<{ id: string; provider: string; status: string }> {
  const state = typeof body.state === 'string' ? body.state : null;
  const yaEnCurso = state ? canjesEnCurso.get(state) : undefined;
  if (yaEnCurso) return yaEnCurso;

  const promesa = api
    .post<{ data: { id: string; provider: string; status: string } }>('/sync/oauth/callback', body)
    .then((res) => res.data);

  if (state) {
    canjesEnCurso.set(state, promesa);
    // Si falla, se olvida: un reintento legítimo del usuario debe poder pasar.
    // Si sale bien, se conserva — ese código ya no vale para nada más.
    promesa.catch(() => canjesEnCurso.delete(state));
  }

  return promesa;
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
    /**
     * Obligatorio cuando el selector muestra UNA plataforma de un connector
     * COMPARTIDO (el hub Matrix: Telegram + WhatsApp + Matrix). Sin esto el
     * servidor reemplaza la lista entera y borra la selección de las otras.
     */
    platform?: string;
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
