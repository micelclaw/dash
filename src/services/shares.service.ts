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

/**
 * Servicio de compartir — TODO el I/O del modal unificado (EntityShareModal)
 * y del SharedWithIndicator pasa por aquí.
 *
 * Dos mundos, una superficie:
 *  - `user_shares` (POST /shares…): compartir con usuarios de la instancia
 *    (view/edit, revocable). Precursor del anillo local de «Ventanas».
 *  - `shared_links` (POST /files/:id/share…): enlace público con token
 *    (password/caducidad/QR), hoy solo para ficheros/carpetas (drive).
 */

import { api } from '@/services/api';

// ─── Tipos ────────────────────────────────────────────────────────────────

export type SharePermission = 'view' | 'edit';

export interface ShareRecipient {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_path: string | null;
}

/** Fila de user_share enriquecida (GET /shares/by-me?target_type&target_id). */
export interface RecordShare {
  id: string;
  owner_id: string;
  shared_with_id: string;
  target_type: string;
  target_id: string;
  permission: SharePermission;
  created_at: string;
  shared_with: {
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_path: string | null;
  };
}

/** Enlace público de un fichero (GET /files/:id/shares). */
export interface FileShareLink {
  id: string;
  token: string;
  is_public: boolean;
  permissions: string[];
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  created_at: string;
  password_hash?: string | null;
}

export interface CreatedFileLink {
  token: string;
  url: string;
  has_password?: boolean;
}

export interface EmailLinkResult {
  url: string;
  token?: string;
  email_sent: boolean;
  email_error?: string;
}

// ─── user_shares (personas de la instancia) ───────────────────────────────

export async function listShareRecipients(): Promise<ShareRecipient[]> {
  const res = await api.get<{ data: ShareRecipient[] }>('/shares/recipients');
  return res.data ?? [];
}

/** Shares vivos de UN registro (para "Ya compartido" + SharedWithIndicator). */
export async function listRecordShares(targetType: string, targetId: string): Promise<RecordShare[]> {
  const res = await api.get<{ data: RecordShare[] }>(
    `/shares/by-me?target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}`,
  );
  return res.data ?? [];
}

export async function createShare(input: {
  shared_with_id: string;
  target_type: string;
  target_id: string;
  permission: SharePermission;
  /** Título informativo del registro — alimenta la notificación al receptor. */
  title?: string;
}): Promise<RecordShare> {
  const res = await api.post<{ data: RecordShare }>('/shares', input);
  return res.data;
}

export async function updateSharePermission(shareId: string, permission: SharePermission): Promise<void> {
  await api.patch(`/shares/${shareId}`, { permission });
}

export async function deleteShare(shareId: string): Promise<void> {
  await api.delete(`/shares/${shareId}`);
}

// ─── shared_links (enlace público de fichero/carpeta) ─────────────────────

export async function listFileLinks(fileId: string): Promise<FileShareLink[]> {
  const res = await api.get<{ data: FileShareLink[] }>(`/files/${fileId}/shares`);
  return res.data ?? [];
}

/**
 * Crea el enlace público. `permissions:['view']` va HARDCODED: el endpoint
 * público exige 'view' para descargar/navegar — enviar 'read'/'edit' deja el
 * enlace como "solo subida" (can_download:false, /list → 403).
 */
export async function createFileLink(fileId: string, opts: {
  password?: string;
  expires_in_hours?: number;
} = {}): Promise<CreatedFileLink> {
  const res = await api.post<{ data: CreatedFileLink }>(`/files/${fileId}/share`, {
    access: opts.password ? 'private' : 'public',
    is_public: !opts.password,
    password: opts.password || null,
    permissions: ['view'],
    ...(opts.expires_in_hours ? { expires_in_hours: opts.expires_in_hours } : {}),
  });
  return res.data;
}

/** Crea un enlace y lo envía por el relay SMTP del sistema (best-effort). */
export async function emailFileLink(fileId: string, opts: {
  email: string;
  message?: string;
  password?: string;
  expires_in_hours?: number;
}): Promise<EmailLinkResult> {
  const res = await api.post<{ data: EmailLinkResult }>(`/files/${fileId}/share/email`, {
    email: opts.email,
    message: opts.message || undefined,
    password: opts.password || undefined,
    expires_in_hours: opts.expires_in_hours ?? undefined,
  });
  return res.data;
}

export async function revokeFileLink(token: string): Promise<void> {
  await api.delete(`/files/share/${token}`);
}
