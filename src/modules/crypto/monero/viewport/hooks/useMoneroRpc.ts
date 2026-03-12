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

// ─── Monero Wallet RPC Hook ─────────────────────────────────────────
// Wraps the proxy endpoint with method classification handling.
// Safe/write methods go through directly; transfer/dangerous methods
// return a confirmation token that must be confirmed via a dialog.

import { useState, useCallback } from 'react';
import { api } from '@/services/api';

export interface ConfirmationRequest {
  requires_confirmation: true;
  token: string;
  method: string;
  expires_in: number;
  risk: string;
  risk_label: string;
}

interface RpcSuccessResponse {
  data: { result: unknown };
}

interface RpcConfirmResponse {
  data: ConfirmationRequest;
}

export function useMoneroRpc() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationRequest | null>(null);

  /** Call a wallet RPC method. Returns result for safe/write, or sets pendingConfirmation for transfer/dangerous. */
  const call = useCallback(async <T = unknown>(method: string, params?: Record<string, unknown>): Promise<T | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.post<RpcSuccessResponse | RpcConfirmResponse>('/crypto/monero-wallet/rpc', {
        method,
        params: params ?? {},
      });

      const data = res.data as any;

      if (data.requires_confirmation) {
        setPendingConfirmation(data as ConfirmationRequest);
        return null;
      }

      return (data.result ?? data) as T;
    } catch (err: any) {
      const msg = err?.message || `RPC call failed: ${method}`;
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Confirm a pending action with the token */
  const confirm = useCallback(async (): Promise<unknown> => {
    if (!pendingConfirmation) {
      setError('No pending confirmation');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await api.post<{ data: { result: unknown } }>('/crypto/monero-wallet/confirm', {
        token: pendingConfirmation.token,
      });
      setPendingConfirmation(null);
      return (res.data as any).result ?? res.data;
    } catch (err: any) {
      const msg = err?.message || 'Confirmation failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [pendingConfirmation]);

  /** Dismiss the pending confirmation without executing */
  const dismissConfirmation = useCallback(() => {
    setPendingConfirmation(null);
  }, []);

  return {
    call,
    confirm,
    dismissConfirmation,
    isLoading,
    error,
    pendingConfirmation,
  };
}
