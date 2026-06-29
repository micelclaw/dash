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

import { useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useAgentLiveInfo } from './hooks/use-agent-live-info';
import { formatRelativeTime } from './shared/format';

interface StuckYieldRecoveryProps {
  agentId: string;
  /** En modo compacto no muestra el banner verde "sin bloqueos" (lo usa el Doctor). */
  compact?: boolean;
  onResolved?: () => void;
}

/**
 * Lista los stuck-yields del agente (de live-info) y permite reanudarlos con
 * el endpoint EXISTENTE POST /managed-agents/:id/stuck-yield/resume. Cierra la
 * deuda O2 (UI de recuperación). Reutilizado por A (Actividad) y D (Doctor).
 */
export function StuckYieldRecovery({ agentId, compact, onResolved }: StuckYieldRecoveryProps) {
  const { info, loading, refetch } = useAgentLiveInfo(agentId);
  const [resuming, setResuming] = useState<string | null>(null);

  const stuck = info?.stuck_yields ?? [];

  const handleResume = async (sessionKey: string) => {
    setResuming(sessionKey);
    try {
      const res = await api.post<{ data: { resumed: boolean; already_resolved?: boolean } }>(
        `/managed-agents/${agentId}/stuck-yield/resume`,
        { session_key: sessionKey },
      );
      if (res.data.already_resolved) toast.info('La sesión ya estaba resuelta');
      else toast.success('Sesión reanudada');
      refetch();
      onResolved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo reanudar la sesión');
    } finally {
      setResuming(null);
    }
  };

  if (loading && !info) {
    return <div style={{ height: 44, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', animation: 'clawPulse 1.5s ease-in-out infinite' }} />;
  }

  if (stuck.length === 0) {
    if (compact) return null;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem',
        color: 'var(--success)', background: 'color-mix(in srgb, var(--success) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)',
        borderRadius: 'var(--radius-sm)', padding: '8px 10px',
      }}>
        <CheckCircle2 size={14} /> Sin sesiones bloqueadas.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {stuck.map((s) => {
        const children = Array.isArray(s.aborted_children) ? s.aborted_children : [];
        const busy = resuming === s.session_key;
        return (
          <div key={s.session_key} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--warning) 40%, transparent)',
            borderRadius: 'var(--radius-sm)', padding: '8px 10px',
          }}>
            <AlertTriangle size={15} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text)' }}>
                Bloqueada {formatRelativeTime(s.detected_at)}
                {children.length > 0 && <span style={{ color: 'var(--text-muted)' }}> · {children.length} hijo{children.length !== 1 ? 's' : ''} abortado{children.length !== 1 ? 's' : ''}</span>}
              </div>
              <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.session_key}
              </div>
            </div>
            <button
              onClick={() => handleResume(s.session_key)}
              disabled={busy}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                background: 'var(--amber)', color: '#000', border: 'none',
                borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600,
                padding: '5px 12px', cursor: busy ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              {busy ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RotateCcw size={12} />}
              Reanudar
            </button>
          </div>
        );
      })}
    </div>
  );
}
