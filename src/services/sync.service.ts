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

import { notifyOriginsChanged } from '@/lib/origin-refresh';
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
  /** Capacidades separadas del driver, certificación del tipo y permiso efectivo de esta conexión. */
  task_write_supported?: boolean;
  task_write_certified?: boolean;
  task_write_enabled?: boolean;
  /** Cambios locales de tareas sin aceptar aún por el proveedor; null = conteo no disponible. */
  task_pending_change_count?: number | null;
  id: string;
  connector_type: string;
  direction?: 'pull' | 'push' | 'bidirectional';
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
  connector_type?: string | null;
  oauth_provider?: string | null;
  oauth_scopes?: string[];
  label: string;
  domains: ('mail' | 'calendar' | 'contacts' | 'tasks' | 'notes')[];
  protocols: string[];
  auth_order: string[];
  discovery: string;
  mail_domains: string[];
  features: Record<string, boolean>;
  task_capabilities?: Record<string, {
    read: boolean; create: boolean; update: boolean; delete: boolean; limitation?: string;
  }> | null;
  /** Fecha en que se probó contra un servidor REAL, o null si nunca. */
  verified: string | null;
  notes: string[];
  credential_guide?: {
    steps: string[];
    url: string;
    link_label: string;
  } | null;
  /** ¿Se conecta con la aplicación que trae Micelclaw, o con una registrada aquí? */
  uses_shipped_oauth_client?: boolean;
  /** Esta instalación necesita que la persona pegue su Client ID y Secret. */
  requires_own_oauth_client?: boolean;
  /** Dirección exacta que debe registrarse en la aplicación OAuth. */
  oauth_redirect_uri?: string | null;
  preset_hint: string | null;
  connection_fields?: Array<{ name: string; secret: boolean }>;
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
  domain: 'mail' | 'calendar' | 'contacts' | 'tasks' | null;
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
  parent_database_id?: string | null;
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
  empty_reason?: 'notion_no_shared_content';
  action_required?: string;
  help_url?: string;
}

/**
 * Lo que hay DENTRO de una integración: carpetas, calendarios o libretas, tal y
 * como las devuelve el servidor del proveedor. Nunca una lista plausible.
 */
export async function getConnectorCollections(connectorId: string): Promise<ConnectorCollections> {
  const res = await api.get<{ data: ConnectorCollections }>(`/sync/connectors/${connectorId}/collections`);
  return res.data;
}

/** Convierte una URL/ID de Notion en data_source IDs validados. */
export async function resolveConnectorCollection(connectorId: string, input: string): Promise<CollectionItem[]> {
  const res = await api.post<{ data: CollectionItem[] }>(
    `/sync/connectors/${connectorId}/collections/resolve`,
    { input },
  );
  return res.data;
}

/** Guarda lo elegido. En tareas la selección vacía se rechaza; en dominios DAV heredados conserva su semántica. */
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
  oauth_scopes: string[];
  /**
   * Si no se crea por el camino genérico, POR DÓNDE sí (una cuenta de correo,
   * una autorización). La pantalla lo usa para mandar al sitio correcto en vez
   * de ofrecer un formulario que va a ser rechazado.
   */
  created_by: string | null;
  create_fields?: Array<{ name: string; secret: boolean }>;
}

/**
 * El catálogo. `domain` lo FILTRA en el servidor, que es lo que hace que cada
 * ventana 2 sea distinta: Nextcloud sale en calendario y no en correo, porque no
 * aloja buzones.
 */
export async function listDataProviders(domain?: 'mail' | 'calendar' | 'contacts' | 'tasks' | 'notes'): Promise<DataProvider[]> {
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
export async function listDataCatalog(domain?: 'mail' | 'calendar' | 'contacts' | 'tasks' | 'notes'): Promise<{
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

export async function discoverDiscordGuilds(botToken: string): Promise<{ guilds: Array<{ id: string; name: string }>; has_more: boolean }> {
  const res = await api.post<{ data: { guilds: Array<{ id: string; name: string }>; has_more: boolean } }>('/sync/discord/guilds', { bot_token: botToken });
  return res.data;
}

export async function listConnectors(): Promise<ConnectorInfo[]> {
  const res = await api.get<{ data: ConnectorInfo[] }>('/sync/connectors');
  return res.data ?? [];
}

export async function getConnector<T = Record<string, unknown>>(connectorId: string): Promise<T> {
  const res = await api.get<{ data: T }>(`/sync/connectors/${connectorId}`);
  return res.data;
}

/** Proyección para Mensajes: nunca conserva la configuración completa. */
export interface ConnectorSyncSchedule {
  status: string;
  interval_minutes: number | null;
  last_sync_at: string | null;
}

export async function getConnectorSyncSchedule(connectorId: string): Promise<ConnectorSyncSchedule | null> {
  const connector = (await listConnectors()).find((c) => c.id === connectorId);
  if (!connector) throw new Error('Conector no disponible');
  if (connector.direction !== 'pull') return null;
  const detail = await getConnector<{
    status: string; last_sync_at: string | null;
    config: { sync_interval_minutes?: unknown };
  }>(connectorId);
  const interval = detail.config?.sync_interval_minutes;
  return {
    status: detail.status,
    last_sync_at: detail.last_sync_at,
    interval_minutes: typeof interval === 'number' && Number.isFinite(interval) && interval > 0 ? interval : null,
  };
}

export async function createConnector(body: Record<string, unknown>): Promise<{ id: string }> {
  const res = await api.post<{ data: { id: string } }>('/sync/connectors', body);
  notifyOriginsChanged();
  return res.data;
}

/** Nextcloud Login Flow v2: the polling token and app password never reach Dash. */
export async function startNextcloudNotesLogin(serverUrl: string): Promise<{ state: string; login_url: string; expires_in_seconds: number }> {
  const res = await api.post<{ data: { state: string; login_url: string; expires_in_seconds: number } }>(
    '/sync/nextcloud-notes/login/start', { server_url: serverUrl });
  return res.data;
}
export async function pollNextcloudNotesLogin(state: string): Promise<{ status: 'pending' } | { status: 'connected'; connector_id: string }> {
  const res = await api.post<{ data: { status: 'pending' } | { status: 'connected'; connector_id: string } }>(
    '/sync/nextcloud-notes/login/poll', { state });
  return res.data;
}

export interface NotionPropertySchema {
  id: string;
  name: string;
  type: string;
  options?: Array<{ id?: string; name: string; color?: string }>;
}

export interface NotionCollectionSchema {
  id: string;
  name: string;
  properties: NotionPropertySchema[];
  preview?: Array<{ id: string; title: string; values: Record<string, unknown> }>;
  suggested_mapping: {
    title_property?: string;
    status_property?: string;
    status_type?: 'status' | 'select';
    description_property?: string;
    start_property?: string;
    due_property?: string;
    priority_property?: string;
    tags_property?: string;
    people_property?: string;
    files_property?: string;
    subtasks_property?: string;
  };
}

export interface TaskCollectionSchema {
  id: string;
  name?: string;
  provider?: 'notion' | 'monday' | 'jira' | 'trello';
  properties: Array<{ id: string; name: string; type: string; options?: Array<{ id?: string; name: string }> }>;
  groups?: Array<{ id: string; name: string }>;
  statuses?: Array<{ id: string; name: string; issue_type_id?: string }>;
  preview?: Array<{ id: string; title: string; values: Record<string, unknown> }>;
  suggested_mapping: Record<string, string | undefined>;
}

export async function getConnectorCollectionSchema(connectorId: string, collectionId: string): Promise<TaskCollectionSchema> {
  const res = await api.get<{ data: TaskCollectionSchema }>(
    `/sync/connectors/${connectorId}/collections/${encodeURIComponent(collectionId)}/schema`,
  );
  return res.data;
}

/** Qué hizo DE VERDAD el backend con el botón de la fila (el toast se deriva de esto). */
export type ConnectorRunAction =
  | 'sync_started'
  | 'stream_reconnected'
  | 'stream_already_live'
  | 'refreshed'
  | 'noop';

export async function runConnector(connectorId: string, options?: { requireAction: boolean }): Promise<ConnectorRunAction> {
  const res = await api.post<{ data: { action?: ConnectorRunAction } }>(
    `/sync/connectors/${connectorId}/run`,
  );
  const action = res.data?.action;
  if (options?.requireAction && !['sync_started', 'stream_reconnected', 'stream_already_live', 'refreshed', 'noop'].includes(action ?? '')) {
    throw new Error('Respuesta de sincronización sin acción reconocida');
  }
  return action ?? 'sync_started';
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
export async function deleteConnector(connectorId: string, options: import('./connector-delete-request').DeleteConnectorOptions = {}): Promise<{ records_removed: number }> {
  const { connectorDeletePath } = await import('./connector-delete-request');
  const res = await api.delete<{ data?: { records_removed?: number } }>(connectorDeletePath(connectorId, options));
  notifyOriginsChanged();
  return { records_removed: res?.data?.records_removed ?? 0 };
}

export async function updateConnectorConfig(
  connectorId: string,
  config: Record<string, unknown>,
): Promise<void> {
  await api.patch(`/sync/connectors/${connectorId}/config`, config);
  notifyOriginsChanged();
}

export interface DavAccessInfo {
  caldav_url: string;
  carddav_url: string;
  username: string;
  password_login_supported: boolean;
  recommended_auth: 'device_token';
}

export async function getDavAccess(): Promise<DavAccessInfo> {
  const res = await api.get<{ data: DavAccessInfo }>('/network/dav-access');
  return res.data;
}

/** Credencial revocable para clientes DAV. El valor solo existe en esta respuesta. */
export async function createDavCredential(deviceName: string): Promise<string> {
  const res = await api.post<{ data: { device_token: string } }>('/devices/register', {
    platform: 'desktop',
    device_name: deviceName,
  });
  return res.data.device_token;
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
  ownClient?: { client_id: string; client_secret: string },
  connectorType?: string,
): Promise<{ authorize_url: string; state: string }> {
  const res = await api.post<{ data: { authorize_url: string; state: string } }>(
    `/sync/oauth/authorize/${provider}`,
    {
      scopes: scopes.split(',').map((scope) => scope.trim()).filter(Boolean),
      ...(ownClient ?? {}),
      ...(connectorType ? { connector_type: connectorType } : {}),
    },
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
