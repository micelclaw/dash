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
  const [cards, setCards] = useState<WorkboardCard[]>([]);
  const [diagnostics, setDiagnostics] = useState<WorkboardDiagnostic[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCards = useCallback(async () => {
    try {
      const [{ cards }, diags] = await Promise.all([
        workboardApi.listCards(),
        workboardApi.diagnostics().catch(() => []),
      ]);
      setCards(cards);
      setDiagnostics(diags);
    } catch { /* transitorio; el siguiente poll reintenta */ }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await workboardApi.status();
      setStatus(s);
      return s;
    } catch {
      setStatus({ enabled: false, reachable: false, board_id: '', boards: 0 });
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await refreshStatus();
      if (alive && s?.enabled && s.reachable) await loadCards();
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [refreshStatus, loadCards]);

  // Poll mientras el board esté activo (frescura de heartbeat / cambios de agentes).
  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (status?.enabled && status.reachable) {
      pollRef.current = setInterval(loadCards, POLL_MS);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status?.enabled, status?.reachable, loadCards]);

  return { status, cards, diagnostics, loading, refreshStatus, loadCards, setLoading };
}
