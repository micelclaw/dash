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
import { listChannels, type Channel } from '@/services/messages.service';

interface UseChannelsOptions {
  platform?: string;
}

export function useChannels(options: UseChannelsOptions = {}) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listChannels(options.platform ? { platform: options.platform } : undefined);
      setChannels(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [options.platform]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { channels, loading, error, refetch };
}
