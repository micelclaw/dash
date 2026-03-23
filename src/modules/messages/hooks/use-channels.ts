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
import type { Channel } from '../types';

interface UseChannelsOptions {
  platform?: string;
}

export function useChannels(options: UseChannelsOptions = {}) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (options.platform) params.platform = options.platform;
      const res = await api.get<{ data: Channel[] }>('/messages/channels', params);
      setChannels(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [options.platform]);

  useEffect(() => { fetch(); }, [fetch]);

  return { channels, loading, refetch: fetch };
}
