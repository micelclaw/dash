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

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import type { FileRecord } from '@/types/files';
import type { ApiResponse } from '@/types/api';

/**
 * Drive upload queue (D6) — XHR-based uploads with real per-file progress.
 *
 * This is the ONE sanctioned exception to the "everything through api.ts"
 * rule: `fetch` has no upload-progress events, so the Drive flow uses
 * XMLHttpRequest with the exact same auth contract as api.ts (Bearer access
 * token from the auth store, one transparent retry after a 401 → refresh).
 * JSON requests must keep going through api.ts.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const API_PREFIX = '/api/v1';

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error';

export interface UploadQueueItem {
  id: string;
  name: string;
  size: number;
  /** 0–100 (upload bytes sent; jumps to 100 on server OK). */
  progress: number;
  status: UploadStatus;
  error?: string;
}

interface PendingUpload {
  id: string;
  file: File;
  parentFolder: string;
}

class UploadHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Single XHR upload with progress callback. Mirrors api.upload()'s contract. */
function xhrUpload(
  file: File,
  parentFolder: string,
  onProgress: (pct: number) => void,
): Promise<FileRecord> {
  return new Promise((resolve, reject) => {
    const token = useAuthStore.getState().tokens?.accessToken;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}${API_PREFIX}/files/upload`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        // Cap at 99 until the server confirms — the last % is the response.
        onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText) as ApiResponse<FileRecord>;
          resolve(json.data);
        } catch {
          reject(new UploadHttpError(xhr.status, 'Invalid server response'));
        }
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const json = JSON.parse(xhr.responseText) as { error?: { message?: string } };
          if (json.error?.message) message = json.error.message;
        } catch { /* keep generic message */ }
        reject(new UploadHttpError(xhr.status, message));
      }
    };
    xhr.onerror = () => reject(new UploadHttpError(0, 'Network error'));
    xhr.ontimeout = () => reject(new UploadHttpError(0, 'Upload timed out'));

    const fd = new FormData();
    fd.append('parent_folder', parentFolder);
    fd.append('file', file);
    xhr.send(fd);
  });
}

export interface UseUploadQueue {
  /** Visible queue (uploading + queued + recently finished). */
  items: UploadQueueItem[];
  /** Add files; they upload sequentially into `parentFolder`. */
  enqueue: (files: File[], parentFolder: string) => void;
  /** Remove finished (done/error) entries from the panel. */
  clearFinished: () => void;
  /** True while something is uploading or waiting. */
  busy: boolean;
}

/**
 * Sequential upload queue with per-file progress.
 *
 * - `onUploaded` fires per successful file (with the created record).
 * - `onAllSettled` fires when the queue drains (success or error mix).
 * - When every visible item ends in `done`, the list auto-clears after 2.5s
 *   (errors stay until dismissed).
 */
export function useUploadQueue(opts?: {
  onUploaded?: (record: FileRecord) => void;
  onAllSettled?: () => void;
}): UseUploadQueue {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const pendingRef = useRef<PendingUpload[]>([]);
  const activeRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const patchItem = useCallback((id: string, patch: Partial<UploadQueueItem>) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const processNext = useCallback(async () => {
    if (activeRef.current) return;
    const next = pendingRef.current.shift();
    if (!next) {
      optsRef.current?.onAllSettled?.();
      return;
    }
    activeRef.current = true;
    patchItem(next.id, { status: 'uploading', progress: 0 });
    try {
      let record: FileRecord;
      try {
        record = await xhrUpload(next.file, next.parentFolder, (pct) => patchItem(next.id, { progress: pct }));
      } catch (err) {
        // Same 401 → refresh → single retry the api client does.
        if (err instanceof UploadHttpError && err.status === 401) {
          await useAuthStore.getState().refresh();
          record = await xhrUpload(next.file, next.parentFolder, (pct) => patchItem(next.id, { progress: pct }));
        } else {
          throw err;
        }
      }
      patchItem(next.id, { status: 'done', progress: 100 });
      optsRef.current?.onUploaded?.(record);
    } catch (err) {
      patchItem(next.id, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      });
    } finally {
      activeRef.current = false;
      void processNext();
    }
  }, [patchItem]);

  const enqueue = useCallback((files: File[], parentFolder: string) => {
    if (files.length === 0) return;
    const pendings: PendingUpload[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      parentFolder,
    }));
    const newItems: UploadQueueItem[] = pendings.map(p => ({
      id: p.id,
      name: p.file.name,
      size: p.file.size,
      progress: 0,
      status: 'queued',
    }));
    pendingRef.current.push(...pendings);
    setItems(prev => [...prev, ...newItems]);
    void processNext();
  }, [processNext]);

  const clearFinished = useCallback(() => {
    setItems(prev => prev.filter(i => i.status === 'uploading' || i.status === 'queued'));
  }, []);

  // Auto-dismiss: every item done (no errors, nothing in flight) → clear.
  useEffect(() => {
    if (items.length === 0) return;
    if (!items.every(i => i.status === 'done')) return;
    const t = setTimeout(() => setItems([]), 2500);
    return () => clearTimeout(t);
  }, [items]);

  const busy = items.some(i => i.status === 'uploading' || i.status === 'queued');

  return { items, enqueue, clearFinished, busy };
}
