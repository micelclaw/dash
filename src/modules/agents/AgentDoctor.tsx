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
import {
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, Loader2, Wrench, Stethoscope, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useAgentHealth } from './hooks/use-agent-health';
import { StuckYieldRecovery } from './StuckYieldRecovery';
import type { AgentDetailTab, AgentHealthCheck } from './types';

interface AgentDoctorProps {
  agentId: string;
  agentName: string;
  onAgentChanged?: () => void;
  onNavigateTab?: (tab: AgentDetailTab) => void;
}

const STATUS_META = {
  ok: { icon: CheckCircle2, color: 'var(--success)' },
  warn: { icon: AlertTriangle, color: 'var(--warning)' },
  error: { icon: XCircle, color: 'var(--error)' },
} as const;

export function AgentDoctor({ agentId, onAgentChanged, onNavigateTab }: AgentDoctorProps) {
  const { health, loading, error, refetch } = useAgentHealth(agentId);
  const [fixing, setFixing] = useState<string | null>(null);

  const runRegenerateTools = async (check: string) => {
    if (!window.confirm('Regenerar las tools sincroniza skills + token de runtime de TODOS tus agentes. Va por el Gateway (límite 3 escrituras/60s) y puede tardar unos segundos. ¿Continuar?')) return;
    setFixing(check);
    try {
      await api.post('/managed-agents/regenerate-tools', {});
      toast.success('Tools regeneradas');
      onAgentChanged?.();
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falló la regeneración');
    } finally {
      setFixing(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      {/* Header con semáforo-resumen */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Stethoscope size={15} style={{ color: 'var(--mod-agents, var(--amber))' }} /> Salud del agente
        </h3>
        <button
          onClick={refetch}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
            fontSize: '0.6875rem', padding: '4px 9px', cursor: loading ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          <RefreshCw size={11} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} /> Re-escanear
        </button>
      </div>

      {health && (
        <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem' }}>
          <span style={{ color: 'var(--success)' }}>● {health.summary.ok} OK</span>
          <span style={{ color: 'var(--warning)' }}>▲ {health.summary.warn} aviso{health.summary.warn !== 1 ? 's' : ''}</span>
          <span style={{ color: 'var(--error)' }}>✕ {health.summary.error} error{health.summary.error !== 1 ? 'es' : ''}</span>
        </div>
      )}

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--error)',
          background: 'color-mix(in srgb, var(--error) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--error) 40%, transparent)',
          borderRadius: 'var(--radius-sm)', padding: '8px 10px',
        }}>
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      {loading && !health && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: 40, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', animation: 'clawPulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {health && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {health.checks.map((c) => (
            <CheckRow
              key={c.check}
              check={c}
              agentId={agentId}
              fixing={fixing === c.check}
              onRegenerateTools={() => runRegenerateTools(c.check)}
              onNavigateTab={onNavigateTab}
              onResolved={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CheckRow({ check, agentId, fixing, onRegenerateTools, onNavigateTab, onResolved }: {
  check: AgentHealthCheck;
  agentId: string;
  fixing: boolean;
  onRegenerateTools: () => void;
  onNavigateTab?: (tab: AgentDetailTab) => void;
  onResolved: () => void;
}) {
  const meta = STATUS_META[check.status];
  const Icon = meta.icon;

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${meta.color}`, borderRadius: 'var(--radius-sm)', padding: '9px 11px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={15} style={{ color: meta.color, flexShrink: 0 }} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', flexGrow: 1 }}>{check.label}</span>
        <span style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: meta.color }}>
          {check.status === 'ok' ? 'OK' : check.status === 'warn' ? 'Aviso' : 'Error'}
        </span>
      </div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', lineHeight: 1.4, paddingLeft: 23 }}>
        {check.detail}
      </div>

      {/* Acción de reparación */}
      {check.fixable && check.fix_action === 'resume_stuck_yield' && (
        <div style={{ paddingLeft: 23 }}>
          <StuckYieldRecovery agentId={agentId} compact onResolved={onResolved} />
        </div>
      )}
      {check.fixable && check.fix_action === 'regenerate_tools' && (
        <div style={{ paddingLeft: 23 }}>
          <button
            onClick={onRegenerateTools}
            disabled={fixing}
            title="Afecta a todos los agentes; va por el Gateway (rate-limit)"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'var(--surface-hover)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.6875rem',
              padding: '4px 10px', cursor: fixing ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            {fixing ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Wrench size={11} />}
            Regenerar tools <span style={{ color: 'var(--warning)' }}>⚠ bulk</span>
          </button>
        </div>
      )}
      {check.fixable && check.fix_action === 'set_model' && (
        <div style={{ paddingLeft: 23 }}>
          <button
            onClick={() => onNavigateTab?.('overview')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'var(--surface-hover)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.6875rem',
              padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Cambiar modelo <ArrowRight size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
