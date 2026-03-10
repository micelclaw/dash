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
