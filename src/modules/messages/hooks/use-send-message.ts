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

import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { Message } from '../types';

export function useSendMessage() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (platform: string, channelId: string, content: string): Promise<Message | null> => {
    setSending(true);
    setError(null);
    try {
      const res = await api.post<{ data: Message }>('/messages/send', {
        platform,
        channel_id: channelId,
        content,
      });
      return res.data;
    } catch (err: any) {
      console.error('[messages] send failed:', err, 'status:', err?.status, 'code:', err?.code, 'details:', err?.details);
      setError(err?.message || 'Failed to send');
      return null;
    } finally {
      setSending(false);
    }
  }, []);

  return { send, sending, error };
}
