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

import {
  Activity, RefreshCw, ArrowUpRight, ArrowDownLeft, AlertTriangle,
  MessageSquare, Coins, Receipt, Layers, ShieldCheck, Wrench, Clock,
} from 'lucide-react';
import { useAgentLiveInfo } from './hooks/use-agent-live-info';
import { formatRelativeTime } from './shared/format';
import type { ManagedAgent } from './types';

const TYPE_LABELS: Record<string, string> = {
  webchat: 'Chat',
  delegation: 'Delegación',
  council: 'Consejo',
  heartbeat: 'Latido',
  cron: 'Programado',
};

interface AgentActivityProps {
  agent: ManagedAgent;
}

export function AgentActivity({ agent }: AgentActivityProps) {
  const { info, loading, error, refetch } = useAgentLiveInfo(agent.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`@keyframes clawPulse{0%,100%{opacity:.45}50%{opacity:.9}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{
          fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', margin: 0,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Activity size={14} style={{ color: 'var(--mod-agents, var(--amber))' }} />
          Actividad en vivo
        </h4>
        <button
          onClick={refetch}
          disabled={loading}
          title="Actualizar"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
            fontSize: '0.6875rem', padding: '3px 8px',
            cursor: loading ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          <RefreshCw size={11} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
          Actualizar
        </button>
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'color-mix(in srgb, var(--error) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--error) 40%, transparent)',
          borderRadius: 'var(--radius-sm)', padding: '8px 10px',
          color: 'var(--error)', fontSize: '0.75rem',
        }}>
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <StatTile icon={<MessageSquare size={13} />} label="Mensajes hoy"
          value={info ? String(info.today.messages) : null} loading={loading} />
        <StatTile icon={<Coins size={13} />} label="Tokens hoy"
          value={info ? info.today.tokens.toLocaleString('es-ES') : null} loading={loading} />
        <StatTile icon={<Receipt size={13} />} label="Coste hoy"
          value={info ? (info.today.cost_usd > 0 ? `$${info.today.cost_usd.toFixed(info.today.cost_usd < 0.01 ? 5 : 2)}` : '—') : null}
          loading={loading} />
        <StatTile icon={<Layers size={13} />} label="Sesiones"
          value={info ? info.session_tokens.toLocaleString('es-ES') : null} loading={loading}
          hint="Tokens de sesión vigentes (≈ conversaciones no borradas)" />
      </div>

      {/* Última actividad */}
      <Section title="Última actividad" icon={<Clock size={12} />}>
        {loading && !info ? (
          <SkeletonLine />
        ) : info?.last_activity ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '8px 10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
              <TypeBadge type={info.last_activity.type} />
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                {info.last_activity.from_agent} → {info.last_activity.to_agent ?? '—'}
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {formatRelativeTime(info.last_activity.created_at)}
              </span>
            </div>
            <div style={{
              fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {info.last_activity.preview || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>(sin texto)</span>}
            </div>
          </div>
        ) : (
          <EmptyHint>Sin actividad registrada</EmptyHint>
        )}
      </Section>

      {/* Tools hoy */}
      <Section title="Tools usadas hoy" icon={<Wrench size={12} />}>
        {loading && !info ? (
          <SkeletonChips n={4} />
        ) : info && info.tools_today.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {info.tools_today.map(t => (
              <span key={t.tool} style={chipStyle}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{t.tool}</span>
                <span style={{ color: 'var(--amber)', fontWeight: 600 }}>×{t.count}</span>
              </span>
            ))}
          </div>
        ) : (
          <EmptyHint>Sin tools hoy</EmptyHint>
        )}
      </Section>

      {/* Delegaciones recientes */}
      <Section title="Delegaciones recientes" icon={<ArrowUpRight size={12} />}>
        {loading && !info ? (
          <><SkeletonLine /><SkeletonLine /></>
        ) : info && info.recent_delegations.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {info.recent_delegations.map((d, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '7px 9px',
              }}>
                <span style={{
                  flexShrink: 0, marginTop: 1,
                  color: d.direction === 'outgoing' ? 'var(--amber)' : 'var(--success)',
                }} title={d.direction === 'outgoing' ? 'Delegó a' : 'Recibió de'}>
                  {d.direction === 'outgoing' ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      {d.from_agent} → {d.to_agent ?? '—'}
                    </span>
                    {d.briefing && (
                      <span style={{ ...miniTag, color: 'var(--amber)', borderColor: 'var(--amber-dim)' }}>briefing</span>
                    )}
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {formatRelativeTime(d.created_at)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {d.preview}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyHint>Sin delegaciones</EmptyHint>
        )}
      </Section>

      {/* Scopes activos */}
      <Section title="Scopes activos" icon={<ShieldCheck size={12} />}>
        {loading && !info ? (
          <SkeletonChips n={6} />
        ) : info && info.active_scopes.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {info.active_scopes.map(s => (
              <span key={s} style={{ ...chipStyle, fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>{s}</span>
            ))}
          </div>
        ) : (
          <EmptyHint>Sin scopes asignados</EmptyHint>
        )}
      </Section>

      {/* Stuck-yields (alerta) */}
      {info && info.stuck_yields.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'color-mix(in srgb, var(--warning) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--warning) 45%, transparent)',
          borderRadius: 'var(--radius-sm)', padding: '8px 10px',
          color: 'var(--warning)', fontSize: '0.75rem',
        }}>
          <AlertTriangle size={14} />
          {info.stuck_yields.length} sesión{info.stuck_yields.length !== 1 ? 'es' : ''} bloqueada{info.stuck_yields.length !== 1 ? 's' : ''} (stuck-yield) sin resolver
        </div>
      )}

      {/* Eventos críticos */}
      {info && info.critical_events.length > 0 && (
        <Section title="Eventos sin procesar" icon={<AlertTriangle size={12} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {info.critical_events.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.6875rem' }}>
                <SeverityDot severity={e.severity} />
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{e.type}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{formatRelativeTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────

const chipStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-full)', padding: '2px 9px',
  fontSize: '0.6875rem', color: 'var(--text-dim)',
};

const miniTag: React.CSSProperties = {
  fontSize: '0.5625rem', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.04em', padding: '1px 5px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
};

function StatTile({ icon, label, value, loading, hint }: {
  icon: React.ReactNode; label: string; value: string | null; loading: boolean; hint?: string;
}) {
  return (
    <div title={hint} style={{
      display: 'flex', flexDirection: 'column', gap: 3,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '8px 10px', minWidth: 0,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.5625rem' }}>
        {icon}
        <span title={label} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </span>
      {value === null && loading ? (
        <span style={{ height: 18, width: '60%', background: 'var(--surface-hover)', borderRadius: 4, animation: 'clawPulse 1.5s ease-in-out infinite' }} />
      ) : (
        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value ?? '—'}
        </span>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--text-muted)',
      }}>
        {icon}{title}
      </span>
      {children}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span style={{
      ...miniTag, color: 'var(--text-dim)',
      background: 'var(--surface-hover)', borderColor: 'var(--border)',
    }}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const color = severity === 'critical' || severity === 'error' ? 'var(--error)'
    : severity === 'warn' ? 'var(--warning)' : 'var(--text-muted)';
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />;
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{children}</span>;
}

function SkeletonLine() {
  return <div style={{ height: 30, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', animation: 'clawPulse 1.5s ease-in-out infinite' }} />;
}

function SkeletonChips({ n }: { n: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} style={{ height: 20, width: 60 + (i % 3) * 18, background: 'var(--surface)', borderRadius: 'var(--radius-full)', animation: 'clawPulse 1.5s ease-in-out infinite' }} />
      ))}
    </div>
  );
}
