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

// ─── Messages service ───────────────────────────────────────────────
//
// The full data layer for the Messages domain: channels, message pages,
// sending, per-platform capabilities, and pairing. Hooks + components go
// through here (never `api` directly), matching the dash convention.

import { api } from './api';
import type { PairingKind, MessagingTransport } from '@/config/messaging-platforms';

// ─── Types ──────────────────────────────────────────────────────────

export interface Channel {
  platform: string;
  platform_channel_id: string;
  channel_name: string | null;
  channel_type: string | null;
  message_count: number;
  last_message_at: string;
  last_message_content: string | null;
  last_message_sender: string | null;
  /** ¿Sigue en la allowlist observada de su connector? (toggle del menú). */
  observed?: boolean;
}

export interface MessageAttachment {
  id: string;
  kind: 'image' | 'file' | 'audio' | 'video';
  mime_type: string | null;
  name: string | null;
  size_bytes: number | null;
  width?: number | null;
  height?: number | null;
  duration_ms?: number | null;
  url: string;
  thumbnail_url: string | null;
}

export interface Message {
  id: string;
  platform: string;
  platform_channel_id: string | null;
  channel_name: string | null;
  direction: string;
  sender_name: string | null;
  content: string | null;
  content_type: string;
  sent_at: string;
  thread_id: string | null;
  /** Optional — the backend may not populate attachments in early phases. */
  attachments?: MessageAttachment[] | null;
  /** Cuándo lo leyó el destinatario (doble check azul); solo mensajes salientes 1:1. */
  read_at?: string | null;
  /** Client-only marker for optimistic sends. */
  pending?: boolean;
}

/** Preferencias por chat (menú contextual): fijar, silenciar, archivar. */
export interface ChatPref {
  pinned?: boolean;
  muted?: boolean;
  archived?: boolean;
}
export type ChatPrefs = Record<string, ChatPref>; // clave "<platform>:<channelId>"

export interface PlatformStats {
  platform: string;
  channel_count: number;
  message_count: number;
}

export type ConnectorStatus = 'active' | 'paused' | 'error' | 'pending_pairing' | null;
export type StreamStatus = 'connected' | 'disconnected' | 'not_applicable';
export type SendBlockReason =
  | 'not_configured'
  | 'reauth_required'
  | 'plugin_not_installed'
  | 'gateway_unreachable'
  | 'unsupported'
  | null;

/** Capacidades reales de la implementación actual de una plataforma (N/A honestos). */
export interface PlatformFeatures {
  backfill: boolean;
  read_receipts: boolean;
  media: boolean;
}

export interface PlatformCapability {
  platform: string;
  label: string;
  transport: MessagingTransport;
  can_send: boolean;
  can_observe: boolean;
  requires_pairing: boolean;
  pairing_kind: PairingKind;
  connector: { id: string; status: ConnectorStatus; errors_count: number; last_sync_at: string | null } | null;
  stream: StreamStatus;
  gateway_channel: { configured: boolean; status: string } | null;
  cli_service: string | null;
  send_reason: SendBlockReason;
  note: string | null;
  features: PlatformFeatures;
  /**
   * Escribir a un contacto NUEVO (fuera de la lista sincronizada) + qué
   * identificador pide. `null` = no soportado. El botón solo se ofrece cuando
   * ADEMÁS `can_send` (plataforma usable).
   */
  start_chat: { kind: 'phone' | 'username' | 'phone_or_username' } | null;
}

export interface StartedChannel {
  platform: string;
  channel_id: string;
  name: string;
  type: string;
}

export interface PairingResult {
  pairing_code: string | null;
  qr_png_base64: string | null;
  expires_at: string | null;
}

export interface PairingStatus {
  state: 'idle' | 'pending' | 'paired' | 'expired' | 'error';
  detail: string | null;
}

interface ListEnvelope<T> {
  data: T[];
  total?: number;
  limit?: number;
  offset?: number;
}

// ─── Stats (used by Channel Observers) ──────────────────────────────

export async function getPlatformStats(): Promise<PlatformStats[]> {
  const res = await api.get<{ data: PlatformStats[] }>('/messages/platforms');
  return res.data ?? [];
}

// ─── Capabilities (SSOT for send/observe/pairing state) ─────────────

export async function listCapabilities(): Promise<PlatformCapability[]> {
  const res = await api.get<{ data: { platforms: PlatformCapability[] } }>('/messages/capabilities');
  return res.data?.platforms ?? [];
}

// ─── Channels + messages ────────────────────────────────────────────

export async function listChannels(params?: { platform?: string }): Promise<Channel[]> {
  const res = await api.get<{ data: Channel[] }>('/messages/channels', params?.platform ? { platform: params.platform } : undefined);
  return res.data ?? [];
}

/**
 * One page of a channel's messages, newest-first. Cursor pagination via
 * `before` (a `sent_at` ISO string) → passed to the backend as `until`
 * (inclusive `sent_at <= until`); the boundary row repeats, so callers must
 * dedupe by `id`.
 */
export async function listMessages(params: {
  channel_id: string;
  /**
   * OBLIGATORIA en la práctica: la identidad de un chat es (platform,
   * platform_channel_id) — así lo agrupa `listChannels` en el backend. El mismo
   * id de chat PUEDE existir en dos plataformas a la vez: el contacto de Session
   * tiene el mismo Session ID en «identidad propia» y en «tu móvil», y sin este
   * filtro los dos hilos se funden en pantalla (medido).
   */
  platform?: string;
  limit?: number;
  before?: string;
}): Promise<{ messages: Message[]; total: number }> {
  const query: Record<string, string> = {
    channel_id: params.channel_id,
    sort: 'sent_at',
    order: 'desc',
    limit: String(params.limit ?? 50),
  };
  if (params.platform) query.platform = params.platform;
  if (params.before) query.until = params.before;
  const res = await api.get<ListEnvelope<Message>>('/messages', query);
  return { messages: res.data ?? [], total: res.total ?? res.data?.length ?? 0 };
}

export async function sendMessage(body: { platform: string; channel_id: string; content: string }): Promise<Message> {
  const res = await api.post<{ data: Message }>('/messages/send', body);
  return res.data;
}

/**
 * I-A · Al abrir un chat: refresca ESA sala (mensajes/adjuntos nuevos + recibos de
 * lectura). Best-effort — no bloquea la UI. Devuelve cuántos entraron.
 */
export async function refreshChannel(platform: string, channelId: string): Promise<{ imported: number; read_marked: number }> {
  const res = await api.post<{ data: { imported: number; read_marked: number } }>(
    '/messages/channels/refresh',
    { platform, channel_id: channelId },
  );
  return res.data;
}

/** Los adjuntos de un chat por tipo (galería): media | files | voice | links. */
export async function listChannelMedia(params: {
  channel_id: string;
  kind: 'media' | 'files' | 'voice' | 'links';
  limit?: number;
}): Promise<Message[]> {
  const res = await api.get<ListEnvelope<Message>>('/messages', {
    channel_id: params.channel_id,
    kind: params.kind,
    sort: 'sent_at',
    order: 'desc',
    limit: String(params.limit ?? 100),
  });
  return res.data ?? [];
}

/** Borra (soft) un chat entero + deja de observarlo. */
export async function deleteChannel(platform: string, channelId: string): Promise<{ deleted: number }> {
  const qs = new URLSearchParams({ platform, channel_id: channelId }).toString();
  const res = await api.delete<{ data: { deleted: number } }>(`/messages?${qs}`);
  return res.data;
}

// ─── Prefs por chat (fijar / silenciar / archivar / observable) ────────

export async function getChatPrefs(): Promise<ChatPrefs> {
  const res = await api.get<{ data: ChatPrefs }>('/messages/prefs');
  return res.data ?? {};
}

export async function updateChatPref(
  platform: string,
  channelId: string,
  patch: ChatPref,
): Promise<ChatPref> {
  const res = await api.patch<{ data: ChatPref }>('/messages/prefs', {
    platform,
    channel_id: channelId,
    ...patch,
  });
  return res.data;
}

/**
 * Escribir a un contacto NUEVO (fuera de la lista sincronizada). matrix-bridge
 * (WhatsApp/Telegram) crea el portal vía el bot del bridge y puede tardar ~15s;
 * Signal es inmediato. Deja el chat observado y devuelve el canal para abrirlo.
 * Timeout largo por la creación del portal.
 */
export async function startChannel(platform: string, identifier: string): Promise<StartedChannel> {
  const res = await api.post<{ data: StartedChannel }>(
    '/messages/channels/start',
    { platform, identifier },
    { timeout: 60_000 },
  );
  return res.data;
}

/** Marca un chat observable/no (añadir o quitar de la allowlist del connector). */
export async function setChannelObserved(
  platform: string,
  channelId: string,
  observed: boolean,
  opts?: { name?: string; type?: string },
): Promise<void> {
  await api.post('/messages/channels/observe', {
    platform,
    channel_id: channelId,
    observed,
    name: opts?.name,
    type: opts?.type,
  });
}

// ─── Pairing (WhatsApp code / WeChat + Google Messages QR / …) ──────

export async function createPairing(platform: string): Promise<PairingResult> {
  const res = await api.post<{ data: PairingResult }>(`/messages/pair/${platform}`);
  return res.data;
}

export async function getPairingStatus(platform: string): Promise<PairingStatus> {
  const res = await api.get<{ data: PairingStatus }>(`/messages/pair/${platform}/status`);
  return res.data;
}
