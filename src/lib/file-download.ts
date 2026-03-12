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

import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export async function downloadFile(fileId: string, filename: string): Promise<void> {
  try {
    const token = useAuthStore.getState().tokens?.accessToken;
    const res = await fetch(`${BASE_URL}/api/v1/files/${fileId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Download failed: ${res.status} ${body}`);
    }
    const blob = await res.blob();
    if (blob.size === 0) {
      throw new Error('Downloaded file is empty');
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Download failed');
  }
}

export async function downloadBatch(ids: string[], filename = 'download.zip'): Promise<void> {
  try {
    const token = useAuthStore.getState().tokens?.accessToken;
    const res = await fetch(`${BASE_URL}/api/v1/files/download-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Download failed: ${res.status} ${body}`);
    }
    const blob = await res.blob();
    if (blob.size === 0) {
      throw new Error('Downloaded file is empty');
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Download failed');
  }
}
