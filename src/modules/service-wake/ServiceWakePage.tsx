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

// ─── Service Wake page ───────────────────────────────────────────────
// Página intersticial a la que Caddy redirige (302) cuando vas a un `.claw` de un
// servicio del sistema DETENIDO (en vez del 502). "El servicio X está detenido" +
// botón Activar → arranca el servicio (services.store) → espera a que el puerto
// responda de verdad (sonda /reachable, no solo "container running") → redirige.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Power, Loader2, AlertTriangle, CheckCircle2, LogIn } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useServicesStore } from '@/stores/services.store';
import { api } from '@/services/api';

type Phase = 'needs-auth' | 'loading' | 'stopped' | 'starting' | 'ready' | 'error';

function prettySlug(slug: string): string {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Component() {
  const [params] = useSearchParams();
  const slug = params.get('service') ?? '';
  const returnUrl = params.get('return') ?? '';
  const safeReturn = /^https:\/\//i.test(returnUrl) ? returnUrl : '';

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const services = useServicesStore((s) => s.services);
  const fetchServices = useServicesStore((s) => s.fetchServices);
  const startService = useServicesStore((s) => s.startService);

  const [phase, setPhase] = useState<Phase>(isAuthenticated ? 'loading' : 'needs-auth');
  const [errMsg, setErrMsg] = useState('');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const startedRef = useRef(false);

  const svc = services.find((s) => s.name === slug);
  const displayName = svc?.display_name ?? prettySlug(slug);
  const estSeconds = svc?.estimated_start_seconds ?? 30;

  const checkReachable = useCallback(async (): Promise<boolean> => {
    try {
      const res = await api.get<{ data: { reachable: boolean } }>(`/network/services/${slug}/reachable`);
      return res.data.reachable === true;
    } catch {
      return false;
    }
  }, [slug]);

  const goToService = useCallback(() => {
    if (safeReturn) window.location.href = safeReturn;
  }, [safeReturn]);

  // Polling: arranca al montar (si hay sesión), evalúa el estado, y redirige
  // cuando el servicio está running Y el puerto responde.
  useEffect(() => {
    if (!isAuthenticated || !slug) return;
    let cancelled = false;

    const evaluate = async () => {
      const s = useServicesStore.getState().services.find((x) => x.name === slug);
      if (!s) { setPhase('error'); setErrMsg('Servicio desconocido.'); return; }
      if (s.state === 'running') {
        const ok = await checkReachable();
        if (cancelled) return;
        if (ok) { setPhase('ready'); goToService(); return; }
        setPhase('starting'); // arrancado pero el HTTP aún no responde
      } else if (s.state === 'starting' || s.state === 'draining') {
        setPhase('starting');
      } else if (s.state === 'failed') {
        setPhase('error'); setErrMsg(s.error ?? 'El servicio no pudo arrancar.');
      } else {
        setPhase(startedRef.current ? 'starting' : 'stopped');
      }
    };

    const tick = async () => { await fetchServices(); if (!cancelled) await evaluate(); };
    void tick();
    const id = setInterval(() => {
      if (!cancelled && phaseRef.current !== 'ready' && phaseRef.current !== 'error') void tick();
    }, 2_500);
    return () => { cancelled = true; clearInterval(id); };
  }, [isAuthenticated, slug, fetchServices, checkReachable, goToService]);

  const handleActivate = async () => {
    startedRef.current = true;
    setPhase('starting');
    setErrMsg('');
    try {
      await startService(slug);
    } catch (e: any) {
      setPhase('error');
      setErrMsg(e?.message ?? 'No se pudo arrancar el servicio.');
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        {phase === 'needs-auth' && (
          <>
            <Power size={40} style={{ color: 'var(--amber)' }} />
            <h2 style={h2}>{displayName} está detenido</h2>
            <p style={dim}>Inicia sesión en el panel para activarlo.</p>
            <a href={`/login`} style={primaryBtn}><LogIn size={16} /> Iniciar sesión</a>
          </>
        )}

        {phase === 'loading' && (
          <>
            <Loader2 size={36} className="animate-spin" style={{ color: 'var(--text-dim)' }} />
            <p style={dim}>Comprobando {displayName}…</p>
          </>
        )}

        {phase === 'stopped' && (
          <>
            <Power size={40} style={{ color: 'var(--amber)' }} />
            <h2 style={h2}>{displayName} está detenido</h2>
            <p style={dim}>Este servicio no está activo ahora mismo. Actívalo para abrirlo.</p>
            <button onClick={() => void handleActivate()} style={primaryBtn}>
              <Power size={16} /> Activar {displayName}
            </button>
          </>
        )}

        {phase === 'starting' && (
          <>
            <Loader2 size={36} className="animate-spin" style={{ color: 'var(--amber)' }} />
            <h2 style={h2}>Arrancando {displayName}…</h2>
            <p style={dim}>
              Puede tardar unos {estSeconds >= 60 ? `${Math.round(estSeconds / 60)} min` : `${estSeconds} s`}.
              Te llevaré allí en cuanto esté listo.
            </p>
          </>
        )}

        {phase === 'ready' && (
          <>
            <CheckCircle2 size={40} style={{ color: 'var(--success)' }} />
            <h2 style={h2}>{displayName} listo</h2>
            <p style={dim}>Redirigiendo…</p>
          </>
        )}

        {phase === 'error' && (
          <>
            <AlertTriangle size={40} style={{ color: 'var(--error)' }} />
            <h2 style={h2}>No se pudo activar</h2>
            <p style={dim}>{errMsg}</p>
            <button onClick={() => void handleActivate()} style={primaryBtn}>
              <Power size={16} /> Reintentar
            </button>
          </>
        )}
      </div>

      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
        Powered by <strong style={{ color: 'var(--amber)' }}>Micelclaw OS</strong>
      </span>
    </div>
  );
}

// ─── estilos (mismo patrón que PublicSharePage) ─────────────────────
const wrap: React.CSSProperties = {
  minHeight: '100dvh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 20,
  background: 'var(--bg)', color: 'var(--text)', padding: 16,
};
const card: React.CSSProperties = {
  width: 'min(420px, 92vw)', background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', padding: '34px 28px',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center',
};
const h2: React.CSSProperties = { margin: 0, fontSize: '1.15rem' };
const dim: React.CSSProperties = { margin: 0, color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.5 };
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', textDecoration: 'none',
  background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-md)',
  fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
