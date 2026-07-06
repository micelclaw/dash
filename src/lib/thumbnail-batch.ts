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

// ─── Prefetch de miniaturas en lote (grid) ───────────────────────────
//
// Una carpeta = UN request. El grid pedía ~100 <img> individuales que, sobre
// HTTP/1.1 (dev), se serializan en 6 conexiones por origen → segundos. Este
// módulo pide TODAS las miniaturas cacheadas de la carpeta a
// `POST /files/thumbnails/lookup` (data URIs) y las sirve desde un Map en
// memoria (revisitas instantáneas sin red). Un `null` del lookup = no cacheada
// server-side → la celda cae al <img> individual (que sí dispara generación).

import { useEffect, useSyncExternalStore } from 'react';
import { api } from '@/services/api';
import { canShowThumbnail } from './file-utils';
import type { ApiResponse } from '@/types/api';
import type { FileRecord } from '@/types/files';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ENTRIES = 1200; // ~1200 × ~8KB ≈ 10MB tope de memoria
const BATCH_LIMIT = 200; // cap del endpoint por request

// key = `${id|path}@${width}` → dataURI (cacheada) | null (no cacheada server-side)
const cache = new Map<string, string | null>();
const inflight = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

function emit(): void {
  version++;
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

const getVersion = () => version;

/** Miniatura prefetcheada: dataURI | null (lookup dijo no-cacheada) | undefined (aún sin lookup). */
export function getPrefetchedThumb(key: string, width: number): string | null | undefined {
  return cache.get(`${key}@${width}`);
}

async function fetchBatch(ids: string[], vfsPaths: string[], width: number): Promise<void> {
  try {
    const res = await api.post<ApiResponse<{ thumbs: Record<string, string | null> }>>(
      '/files/thumbnails/lookup',
      { ids, vfs_paths: vfsPaths, width },
    );
    for (const [key, val] of Object.entries(res.data.thumbs ?? {})) {
      cache.set(`${key}@${width}`, val);
    }
    // FIFO trim (Map preserva orden de inserción).
    while (cache.size > MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
    emit();
  } catch {
    // Lookup caído → marcar las keys pedidas como null para que las celdas
    // (que ESPERAN al lote) caigan al <img> individual y no queden en icono.
    for (const k of [...ids, ...vfsPaths]) cache.set(`${k}@${width}`, null);
    emit();
  } finally {
    for (const k of ids) inflight.delete(`${k}@${width}`);
    for (const k of vfsPaths) inflight.delete(`${k}@${width}`);
  }
}

/** Lanza el prefetch de las miniaturas de la carpeta que aún no estén en el Map. */
export async function prefetchThumbnails(files: FileRecord[], width: number): Promise<void> {
  const ids: string[] = [];
  const vfsPaths: string[] = [];
  for (const f of files) {
    if (f.is_directory || !canShowThumbnail(f.id, f.mime_type)) continue;
    const key = `${f.id}@${width}`;
    if (cache.has(key) || inflight.has(key)) continue;
    inflight.add(key);
    if (UUID_RE.test(f.id)) ids.push(f.id);
    else vfsPaths.push(f.id);
  }
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < Math.max(ids.length, vfsPaths.length); i += BATCH_LIMIT) {
    const idChunk = ids.slice(i, i + BATCH_LIMIT);
    const pathChunk = vfsPaths.slice(i, i + BATCH_LIMIT);
    if (idChunk.length || pathChunk.length) jobs.push(fetchBatch(idChunk, pathChunk, width));
  }
  await Promise.all(jobs);
}

/**
 * Hook de grid: dispara el prefetch de la carpeta y devuelve una versión
 * reactiva (el grid re-renderiza cuando aterriza el lote). Leer cada celda con
 * `getPrefetchedThumb(file.id, width)`.
 */
export function useThumbnailBatch(files: FileRecord[], width: number, enabled: boolean): number {
  const v = useSyncExternalStore(subscribe, getVersion);
  useEffect(() => {
    if (enabled && files.length > 0) void prefetchThumbnails(files, width);
  }, [enabled, files, width]);
  return v;
}
