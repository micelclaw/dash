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

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { PersistedScreenshot } from '@/modules/chat/components/BrowserSessionView';

interface ScreenshotListResponse {
  data: PersistedScreenshot[];
}

/**
 * Loads persisted browser screenshots for a conversation from the API.
 * Handles navigation, delete, and download actions.
 */
export function usePersistedScreenshots(conversationId: string | null) {
  const [screenshots, setScreenshots] = useState<PersistedScreenshot[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch screenshots for this conversation
  const fetchScreenshots = useCallback(async () => {
    if (!conversationId) {
      setScreenshots([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<ScreenshotListResponse>(
        '/browser-screenshots',
        { conversation_id: conversationId },
      );
      // API returns newest first; reverse so index 0 = oldest
      const ordered = [...(res.data ?? [])].reverse();

      // Load base64 for all screenshots via download endpoint
      const withBase64 = await Promise.all(
        ordered.map(async (s) => {
          try {
            const downloadUrl = `${import.meta.env.VITE_API_URL ?? ''}/api/v1/browser-screenshots/${s.id}/download`;
            const token = (await import('@/stores/auth.store')).useAuthStore.getState().tokens?.accessToken;
            const resp = await fetch(downloadUrl, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!resp.ok) return s;
            const blob = await resp.blob();
            const base64 = await blobToBase64(blob);
            return { ...s, base64 };
          } catch {
            return s;
          }
        }),
      );

      setScreenshots(withBase64);
      // Jump to newest
      if (withBase64.length > 0) {
        setCurrentIndex(withBase64.length - 1);
      }
    } catch (err) {
      console.error('[persisted-screenshots] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void fetchScreenshots();
  }, [fetchScreenshots]);

  // Re-fetch when a new browser.snapshot event arrives (new screenshot was pushed)
  const refresh = useCallback(() => {
    void fetchScreenshots();
  }, [fetchScreenshots]);

  const navigate = useCallback((index: number) => {
    if (index >= 0 && index < screenshots.length) {
      setCurrentIndex(index);
    }
  }, [screenshots.length]);

  const deleteScreenshot = useCallback(async (screenshotId: string) => {
    try {
      await api.delete(`/browser-screenshots/${screenshotId}`);
      setScreenshots((prev) => {
        const updated = prev.filter((s) => s.id !== screenshotId);
        // Adjust index if needed
        setCurrentIndex((idx) => Math.min(idx, Math.max(0, updated.length - 1)));
        return updated;
      });
    } catch (err) {
      console.error('[persisted-screenshots] delete failed:', err);
    }
  }, []);

  const downloadScreenshot = useCallback(async (screenshotId: string) => {
    const screenshot = screenshots.find((s) => s.id === screenshotId);
    if (!screenshot) return;

    try {
      const downloadUrl = `${import.meta.env.VITE_API_URL ?? ''}/api/v1/browser-screenshots/${screenshotId}/download`;
      const token = (await import('@/stores/auth.store')).useAuthStore.getState().tokens?.accessToken;
      const resp = await fetch(downloadUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) return;
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = screenshot.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[persisted-screenshots] download failed:', err);
    }
  }, [screenshots]);

  return {
    screenshots,
    currentIndex,
    loading,
    navigate,
    deleteScreenshot,
    downloadScreenshot,
    refresh,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip "data:image/png;base64," prefix
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
