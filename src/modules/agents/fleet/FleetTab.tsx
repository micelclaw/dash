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
import { Table2, LineChart, Users } from 'lucide-react';
import { AgentSelect } from '../AgentSelect';
import { FleetTable } from './FleetTable';
import { FleetAnalytics } from './FleetAnalytics';
import { useAgentAnalytics } from '../hooks/use-agent-analytics';
import type { ManagedAgent } from '../types';

interface FleetTabProps {
  agents: ManagedAgent[];
  onSelectAgent?: (agentId: string) => void;
}

const RANGE_OPTIONS = [
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
];

export function FleetTab({ agents, onSelectAgent }: FleetTabProps) {
  const [view, setView] = useState<'table' | 'analytics'>('table');
  const [range, setRange] = useState<'7d' | '30d'>('30d');
  const { analytics, loading, error } = useAgentAnalytics(range);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
          <Users size={15} style={{ color: 'var(--mod-agents, var(--amber))' }} />
          Flota · {agents.length} agente{agents.length !== 1 ? 's' : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {view === 'analytics' && (
            <AgentSelect value={range} options={RANGE_OPTIONS} onChange={(v) => setRange(v as '7d' | '30d')} minWidth={150} />
          )}
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
            <ViewToggle active={view === 'table'} onClick={() => setView('table')} icon={<Table2 size={13} />} label="Tabla" />
            <ViewToggle active={view === 'analytics'} onClick={() => setView('analytics')} icon={<LineChart size={13} />} label="Analítica" />
          </div>
        </div>
      </div>

      {agents.length === 0 ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px 4px' }}>
          No hay agentes en la flota.
        </div>
      ) : view === 'table' ? (
        <FleetTable agents={agents} onSelect={onSelectAgent} />
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: 180, background: 'var(--surface)', borderRadius: 'var(--radius-md)', animation: 'clawPulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--error)', padding: '16px 4px' }}>{error}</div>
      ) : analytics ? (
        <FleetAnalytics analytics={analytics} agents={agents} />
      ) : null}
    </div>
  );
}

function ViewToggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: active ? 'var(--amber-dim)' : 'transparent',
        color: active ? 'var(--amber)' : 'var(--text-dim)',
        border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 10px',
        fontSize: '0.75rem', fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'var(--font-sans)',
      }}
    >
      {icon} {label}
    </button>
  );
}
