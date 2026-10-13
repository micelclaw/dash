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

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import type {
  Env, MemoryStatus, DreamDiaryResponse, RemHarness, DreamingConfig, WikiStatus, WikiPayload,
} from './types';

const POLL_MS = 60_000;

/**
 * Datos de la vista Sueños para UN agente (por managed id). Carga inicial =
 * status + diario + config global en paralelo; rem-harness y memory-wiki son
 * LAZY (se piden al abrir su cara). Auto-refresh suave de status cada 60s solo
 * con la pestaña visible, + refresh manual (botón Actualizar).
 */
export function useDreams(agentId: string | null) {
  const role = useAuthStore(s => s.user?.role);
  const canManageGlobalMemory = role === 'owner' || role === 'admin';
  const [status, setStatus] = useState<MemoryStatus | null>(null);
  const [diary, setDiary] = useState<DreamDiaryResponse | null>(null);
  const [dreamCfg, setDreamCfg] = useState<DreamingConfig | null>(null);
  const [rem, setRem] = useState<RemHarness | null>(null);
  const [remLoading, setRemLoading] = useState(false);
  const [wikiStatus, setWikiStatus] = useState<WikiStatus | null>(null);
  const [wikiPalace, setWikiPalace] = useState<WikiPayload>(null);
  const [wikiInsights, setWikiInsights] = useState<WikiPayload>(null);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingDream, setTogglingDream] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // Marcadores por-agente + in-flight en refs (NO estado): si estuvieran en las
  // deps de los useCallback, cada setLoading cambiaría la identidad de la fn y
  // el useEffect del consumidor re-dispararía en bucle infinito de refetch.
  const remLoadedFor = useRef<string | null>(null);
  const remInflight = useRef(false);
  const wikiLoadedFor = useRef<string | null>(null);
  const wikiInflight = useRef(false);

  const base = agentId ? `/managed-agents/${agentId}/memory` : null;

  const load = useCallback(async (initial: boolean) => {
    if (!base) return;
    if (initial) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const [st, dd, dc, ws] = await Promise.all([
        api.get<Env<MemoryStatus>>(`${base}/status`),
        api.get<Env<DreamDiaryResponse>>(`${base}/dream-diary`).catch(() => null),
        api.get<Env<DreamingConfig>>('/managed-agents/memory-settings/dreaming').catch(() => null),
        api.get<Env<WikiStatus>>('/managed-agents/wiki/status').catch(() => null),
      ]);
      setStatus(st.data);
      setDiary(dd?.data ?? null);
      setDreamCfg(dc?.data ?? null);
      setWikiStatus(ws?.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el estado del sueño');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [base]);

  // Carga inicial + al cambiar de agente (resetea lazies).
  useEffect(() => {
    setStatus(null); setDiary(null); setRem(null); setWikiPalace(null); setWikiInsights(null);
    remLoadedFor.current = null;
    wikiLoadedFor.current = null;
    void load(true);
  }, [load]);

  // Refresh suave del status (solo pestaña visible).
  useEffect(() => {
    if (!base) return;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const st = await api.get<Env<MemoryStatus>>(`${base}/status`);
        setStatus(st.data);
      } catch { /* transitorio */ }
    };
    const iv = setInterval(() => { void tick(); }, POLL_MS);
    return () => clearInterval(iv);
  }, [base]);

  const refresh = useCallback(() => { void load(false); }, [load]);

  /** REM harness (caro + corre sobre el agente default del gateway) — lazy por cara. */
  const loadRem = useCallback(async () => {
    if (!base || remLoadedFor.current === base || remInflight.current) return;
    remInflight.current = true;
    setRemLoading(true);
    try {
      const rh = await api.get<Env<RemHarness>>(`${base}/rem-harness`);
      setRem(rh.data);
      remLoadedFor.current = base;
    } catch { setRem(null); }
    finally { remInflight.current = false; setRemLoading(false); }
  }, [base]);

  /** memory-wiki (Insights + Palace) — lazy; solo si el plugin está enabled+reachable. */
  const loadWiki = useCallback(async () => {
    if (!agentId || wikiLoadedFor.current === agentId || wikiInflight.current) return;
    if (!wikiStatus?.enabled || !wikiStatus.reachable) return;
    wikiInflight.current = true;
    setWikiLoading(true);
    try {
      const [palace, insights] = await Promise.all([
        api.get<Env<WikiPayload>>(`/managed-agents/${agentId}/wiki/palace`).catch(() => null),
        api.get<Env<WikiPayload>>(`/managed-agents/${agentId}/wiki/insights`).catch(() => null),
      ]);
      setWikiPalace(palace?.data ?? null);
      setWikiInsights(insights?.data ?? null);
      wikiLoadedFor.current = agentId;
    } finally { wikiInflight.current = false; setWikiLoading(false); }
  }, [agentId, wikiStatus?.enabled, wikiStatus?.reachable]);

  const enableWiki = useCallback(async () => {
    try {
      await api.post('/managed-agents/wiki/enable', {});
      toast.success('memory-wiki habilitado — recarga el Gateway para que cargue el plugin');
      const ws = await api.get<Env<WikiStatus>>('/managed-agents/wiki/status').catch(() => null);
      setWikiStatus(ws?.data ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo habilitar memory-wiki');
    }
  }, []);

  const toggleDreaming = useCallback(async (next: boolean) => {
    if (!canManageGlobalMemory) return;
    setTogglingDream(true);
    try {
      await api.patch('/gateway/dreaming-config', { enabled: next });
      setDreamCfg(c => ({ ...(c ?? {}), enabled: next }));
      toast.success(`Dreaming ${next ? 'activado' : 'desactivado'} (global)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fallo al cambiar Dreaming');
    } finally { setTogglingDream(false); }
  }, [canManageGlobalMemory]);

  const saveDreamConfig = useCallback(async (patch: { frequency?: string; model?: string; timezone?: string }) => {
    if (!canManageGlobalMemory) return false;
    try {
      await api.patch('/gateway/dreaming-config', patch);
      setDreamCfg(c => ({ ...(c ?? {}), ...patch }));
      toast.success('Ajustes del sueño guardados (global)');
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fallo al guardar los ajustes');
      return false;
    }
  }, [canManageGlobalMemory]);

  const runMaintenance = useCallback(async (action: string, label: string) => {
    if (!base) return;
    setBusy(action);
    try {
      await api.post(`${base}/maintenance`, { action });
      toast.success(`${label}: hecho`);
      await load(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Fallo en ${label}`);
    } finally { setBusy(null); }
  }, [base, load]);

  return {
    status, diary, dreamCfg, rem, remLoading, wikiStatus, wikiPalace, wikiInsights, wikiLoading,
    loading, refreshing, error, busy, togglingDream, canManageGlobalMemory,
    refresh, loadRem, loadWiki, enableWiki, toggleDreaming, saveDreamConfig, runMaintenance,
  };
}
