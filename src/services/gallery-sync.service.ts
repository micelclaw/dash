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

// ─── Gallery sync service — wrappers de /api/v1/gallery-sync/* ──────

import { api } from '@/services/api';

export interface GallerySyncDevice {
  id: string;
  device_key: string;
  device_name: string;
  platform: string;
  enabled: boolean;
  wifi_only: boolean;
  last_sync_at: string | null;
}

export interface GallerySyncAlbum {
  id: string;
  device_id: string;
  bucket_id: string;
  bucket_name: string;
  album_id: string;
  enabled: boolean;
  cursor_date_added: number;
  cursor_media_id: number;
  synced_count: number;
  device_count: number;
  last_sync_at: string | null;
  last_error: string | null;
  album_alive: boolean;
}

export interface GallerySyncDeviceView {
  device: GallerySyncDevice;
  albums: GallerySyncAlbum[];
}

export const gallerySyncService = {
  /** Bootstrap del cliente: upsert por device_key + estado completo. */
  async upsertDevice(body: { device_key: string; device_name: string; platform?: string }): Promise<GallerySyncDeviceView> {
    const res = await api.post<{ data: GallerySyncDeviceView }>('/gallery-sync/devices', body);
    return res.data;
  },

  /** Vista de estado (todos los dispositivos del usuario). */
  async listDevices(): Promise<GallerySyncDeviceView[]> {
    const res = await api.get<{ data: { devices: GallerySyncDeviceView[] } }>('/gallery-sync/devices');
    return res.data.devices;
  },

  async updateDevice(id: string, patch: { enabled?: boolean; wifi_only?: boolean; device_name?: string }): Promise<GallerySyncDevice> {
    const res = await api.patch<{ data: GallerySyncDevice }>(`/gallery-sync/devices/${id}`, patch);
    return res.data;
  },

  /** Activa el sync de un bucket (idempotente; crea/reusa el álbum de Micelclaw). */
  async enableAlbum(deviceId: string, body: { bucket_id: string; bucket_name: string; device_count?: number }): Promise<GallerySyncAlbum> {
    const res = await api.post<{ data: GallerySyncAlbum }>(`/gallery-sync/devices/${deviceId}/albums`, body);
    return res.data;
  },

  async updateAlbum(id: string, patch: { enabled: boolean }): Promise<GallerySyncAlbum> {
    const res = await api.patch<{ data: GallerySyncAlbum }>(`/gallery-sync/albums/${id}`, patch);
    return res.data;
  },

  /** Quita la config de sync (el álbum de Micelclaw y sus fotos se conservan). */
  async deleteAlbum(id: string): Promise<void> {
    await api.delete(`/gallery-sync/albums/${id}`);
  },

  /** Avanza el cursor tras un lote persistido (guard monotónico server-side). */
  async advanceCursor(id: string, body: {
    cursor_date_added: number;
    cursor_media_id: number;
    synced_delta?: number;
    device_count?: number;
    last_error?: string | null;
  }): Promise<GallerySyncAlbum> {
    const res = await api.post<{ data: GallerySyncAlbum }>(`/gallery-sync/albums/${id}/cursor`, body);
    return res.data;
  },

  /** Reparación: cursor a 0 (+ recrea el álbum si fue borrado). */
  async resyncAlbum(id: string): Promise<GallerySyncAlbum> {
    const res = await api.post<{ data: GallerySyncAlbum }>(`/gallery-sync/albums/${id}/resync`);
    return res.data;
  },

  /** Dedup: ¿cuáles de estos sha256 ya existen? → {sha: file_id}. */
  async lookupChecksums(checksums: string[]): Promise<Record<string, string>> {
    const res = await api.post<{ data: { matches: Record<string, string> } }>('/files/checksums/lookup', { checksums });
    return res.data.matches;
  },

  /** Membresía de álbum (idempotente — UNIQUE en BD). */
  async addPhotosToAlbum(albumId: string, fileIds: string[]): Promise<void> {
    await api.post(`/albums/${albumId}/photos`, { file_ids: fileIds });
  },
};
