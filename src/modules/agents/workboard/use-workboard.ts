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

import { useState, useEffect, useCallback, useRef } from 'react';
import { workboardApi } from './workboard.service';
import type { WorkboardCard, WorkboardStatusResponse, WorkboardDiagnostic } from './types';

const POLL_MS = 8000;

export function useWorkboard() {
  const [status, setStatus] = useState<WorkboardStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [cards, setCards] = useState<WorkboardCard[]>([]);
  const [diagnostics, setDiagnostics] = useState<WorkboardDiagnostic[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const statusRequest = useRef<Promise<WorkboardStatusResponse | null> | null>(null);
  const cardsRequest = useRef<Promise<boolean> | null>(null);

  // Las pills se derivan de cards + diagnostics (sin RPC de stats en el poll).
  const loadCards = useCallback(() => {
    if (cardsRequest.current) return cardsRequest.current;
    const request = (async () => { try {
      const [{ cards }, diags] = await Promise.all([
        workboardApi.listCards(),
        workboardApi.diagnostics().catch(() => []),
      ]);
      setCards(cards);
      setDiagnostics(diags);
      return true;
    } catch { return false; }
    finally { cardsRequest.current = null; }
    })();
    cardsRequest.current = request;
    return request;
  }, []);

  const refreshStatus = useCallback(() => {
    if (statusRequest.current) return statusRequest.current;
    const request = (async () => { try {
      const s = await workboardApi.status();
      setStatus(s);
      setStatusError(null);
      if (s.enabled && s.reachable) await loadCards();
      return s;
    } catch {
      setStatusError('No se pudo consultar el estado de Workboard. Reintenta cuando el Gateway esté disponible.');
      return null;
    }
    finally { statusRequest.current = null; }
    })();
    statusRequest.current = request;
    return request;
  }, [loadCards]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await refreshStatus();
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [refreshStatus, loadCards]);

  // Reintentar también durante la carga del plugin o un fallo del Gateway.
  // Retry y polling comparten la petición en vuelo; nunca se solapan.
  useEffect(() => {
    if (!autoRefresh || (!status?.enabled && !statusError)) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!status?.reachable || statusError) await refreshStatus();
      else if (!await loadCards()) await refreshStatus();
      if (alive) timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, POLL_MS);
    return () => { alive = false; clearTimeout(timer); };
  }, [autoRefresh, status?.enabled, status?.reachable, statusError, refreshStatus, loadCards]);

  return { status, statusError, cards, diagnostics, loading, autoRefresh, setAutoRefresh, refreshStatus, loadCards, setLoading };
}
