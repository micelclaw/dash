// ─── Monero Fiat Price Hook ─────────────────────────────────────────
// Fetches XMR/USD from backend, 5-minute refresh.

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';

interface PriceData {
  usd: number;
  source: string;
  cached: boolean;
}

const REFRESH_INTERVAL = 5 * 60_000;

export function useFiatPrice(enabled = true) {
  const [price, setPrice] = useState<number | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ data: PriceData }>('/crypto/monero-wallet/price');
      const data = res.data as any;
      setPrice(data.usd ?? null);
      setSource(data.source ?? null);
    } catch {
      // Price is non-critical — fail silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    refresh();
    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, enabled]);

  /** Convert XMR amount (atomic units) to fiat string */
  const convert = useCallback((piconero: number): string | null => {
    if (price === null) return null;
    const xmr = piconero / 1e12;
    return `$${(xmr * price).toFixed(2)}`;
  }, [price]);

  /** Convert XMR decimal to fiat string */
  const convertXmr = useCallback((xmr: number): string | null => {
    if (price === null) return null;
    return `$${(xmr * price).toFixed(2)}`;
  }, [price]);

  return { price, source, isLoading, convert, convertXmr, refresh };
}
