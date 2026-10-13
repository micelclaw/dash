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
import { sendMessage, type Message } from '@/services/messages.service';

export interface SendOutcome {
  message: Message | null;
  /** El mensaje de error REAL del backend (para el toast) — nunca un genérico. */
  error: string | null;
}

export function useSendMessage() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (platform: string, channelId: string, content: string): Promise<SendOutcome> => {
      setSending(true);
      setError(null);
      try {
        const message = await sendMessage({ platform, channel_id: channelId, content });
        return { message, error: null };
      } catch (err) {
        const msg = (err as Error).message || 'Failed to send';
        setError(msg);
        return { message: null, error: msg };
      } finally {
        setSending(false);
      }
    },
    [],
  );

  return { send, sending, error };
}
