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

export interface VpnTransferSnapshot {
  timestamp: string;
  peers: Record<string, { rx: number; tx: number }>;
}

export function useVpnStats(hours: number = 24) {
  const [snapshots, setSnapshots] = useState<VpnTransferSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<{ data: VpnTransferSnapshot[] }>(
        `/hal/network/vpn/stats?hours=${hours}`,
      );
      setSnapshots(res.data);
    } catch { /* silent */ }
    setLoading(false);
  }, [hours]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { snapshots, loading, refresh: fetch };
}
