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

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { MessageSquare, Coins, Receipt, Layers } from 'lucide-react';
import { getAgentColor } from './agent-colors';
import { formatTokens, modelShort, MODEL_PALETTE } from './shared/format';
import type { ConversationStats, ManagedAgent } from './types';

interface ConversationChartsProps {
  stats: ConversationStats;
  agents: ManagedAgent[];
}

export function ConversationCharts({ stats, agents }: ConversationChartsProps) {
  const agentData = useMemo(() => {
    const nameMap = new Map(agents.map(a => [a.name, a]));
    return (stats.by_agent ?? [])
      .filter(a => a.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 8)
      .map(a => {
        const agent = nameMap.get(a.agent);
        return {
          name: agent?.display_name ?? a.agent,
          tokens: a.tokens,
          messages: a.messages,
          color: getAgentColor(a.agent, agent?.color),
        };
      });
  }, [stats.by_agent, agents]);

  const modelData = useMemo(() => {
    return (stats.by_model ?? [])
      .filter(m => m.model && m.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 8)
      .map((m, i) => ({
        name: modelShort(m.model),
        tokens: m.tokens,
        messages: m.messages,
        color: MODEL_PALETTE[i % MODEL_PALETTE.length],
      }));
  }, [stats.by_model]);

  const hasData = (stats.total_messages ?? 0) > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 16px 4px' }}>
      {/* Resumen en stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <StatTile icon={<MessageSquare size={13} />} label="Mensajes" value={(stats.total_messages ?? 0).toLocaleString('es-ES')} />
        <StatTile icon={<Coins size={13} />} label="Tokens" value={formatTokens(stats.total_tokens ?? 0)} />
        <StatTile icon={<Receipt size={13} />} label="Coste" value={(stats.total_cost_usd ?? 0) > 0 ? `$${(stats.total_cost_usd ?? 0).toFixed(2)}` : '—'} />
        <StatTile icon={<Layers size={13} />} label="Sesiones" value={(stats.active_sessions ?? 0).toLocaleString('es-ES')} />
      </div>

      {!hasData ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 2px' }}>
          Sin actividad en este periodo para graficar.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <ChartCard title="Tokens por agente" empty={agentData.length === 0}>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={agentData} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={0} angle={-20} textAnchor="end" height={44} />
                <YAxis tickFormatter={formatTokens} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={38} />
                <Tooltip
                  cursor={{ fill: 'var(--surface-hover)' }}
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.75rem' }}
                  formatter={(v: number, _n, p) => [`${v.toLocaleString('es-ES')} tokens · ${p?.payload?.messages ?? 0} msgs`, p?.payload?.name]}
                />
                <Bar dataKey="tokens" radius={[3, 3, 0, 0]}>
                  {agentData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Tokens por modelo" empty={modelData.length === 0}>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={modelData} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
                <XAxis type="number" tickFormatter={formatTokens} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} height={20} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} width={96} />
                <Tooltip
                  cursor={{ fill: 'var(--surface-hover)' }}
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.75rem' }}
                  formatter={(v: number, _n, p) => [`${v.toLocaleString('es-ES')} tokens · ${p?.payload?.messages ?? 0} msgs`, p?.payload?.name]}
                />
                <Bar dataKey="tokens" radius={[0, 3, 3, 0]}>
                  {modelData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '7px 10px', minWidth: 0,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.625rem' }}>
        {icon}{label}
      </span>
      <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  );
}

function ChartCard({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 10px 4px' }}>
      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title}
      </div>
      {empty
        ? <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>Sin datos</div>
        : children}
    </div>
  );
}
