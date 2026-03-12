// ─── Monero Wallet Balance Hook ─────────────────────────────────────
// Polls GET /crypto/monero-wallet/balance every 30s.

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';

export interface AccountBalance {
  index: number;
  label: string;
  balance: number;
  unlocked_balance: number;
  balance_xmr: string;
}

export interface WalletBalance {
  total: number;
  unlocked: number;
  total_xmr: string;
  unlocked_xmr: string;
  accounts: AccountBalance[];
}

const POLL_INTERVAL = 30_000;

export function useWalletBalance(enabled = true) {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ data: WalletBalance }>('/crypto/monero-wallet/balance');
      setBalance((res.data as any) ?? null);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch balance');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setBalance(null);
      setIsLoading(false);
      return;
    }
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, enabled]);

  return { balance, isLoading, error, refresh };
}
