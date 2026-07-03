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

import { useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getAgentColor } from '../agent-colors';
import { formatTokens, modelShort, MODEL_PALETTE } from '../shared/format';
import type { AgentAnalytics, ManagedAgent } from '../types';

interface FleetAnalyticsProps {
  analytics: AgentAnalytics;
  agents: ManagedAgent[];
}

// Etiqueta de día compacta "28 jun" desde YYYY-MM-DD (sin Date para evitar TZ).
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function dayLabel(date: string): string {
  const [, m = '', d = ''] = date.split('-');
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1] ?? ''}`;
}

export function FleetAnalytics({ analytics, agents }: FleetAnalyticsProps) {
  const [stackBy, setStackBy] = useState<'agent' | 'model'>('agent');

  const colorByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agents) m.set(a.name, getAgentColor(a.name, a.color));
    return m;
  }, [agents]);

  const totalTokens = analytics.series.reduce((s, p) => s + p.tokens, 0);
  const totalCost = analytics.series.reduce((s, p) => s + p.cost_usd, 0);
  const hasData = totalTokens > 0 || analytics.series.some((p) => p.messages > 0);

  // Pivot a [{date, <serie>: tokens, ...}] para barras apiladas.
  const { stackData, stackKeys } = useMemo(() => {
    const dates = analytics.series.map((p) => p.date);
    const rows = dates.map((date) => ({ date } as Record<string, number | string>));
    const idx = new Map(dates.map((d, i) => [d, i]));
    const keys: { key: string; color: string }[] = [];
    if (stackBy === 'agent') {
      analytics.by_agent.filter((a) => a.total_tokens > 0).slice(0, 8).forEach((a) => {
        keys.push({ key: a.display_name, color: colorByName.get(a.agent) ?? getAgentColor(a.agent) });
        a.daily.forEach((p) => { const i = idx.get(p.date); const row = i != null ? rows[i] : undefined; if (row) row[a.display_name] = p.tokens; });
      });
    } else {
      analytics.by_model.filter((m) => m.total_tokens > 0).slice(0, 8).forEach((m, mi) => {
        const label = modelShort(m.model);
        keys.push({ key: label, color: MODEL_PALETTE[mi % MODEL_PALETTE.length] ?? '#64748b' });
        m.daily.forEach((p) => { const i = idx.get(p.date); const row = i != null ? rows[i] : undefined; if (row) row[label] = p.tokens; });
      });
    }
    return { stackData: rows, stackKeys: keys };
  }, [analytics, stackBy, colorByName]);

  const seriesData = useMemo(() => analytics.series.map((p) => ({ ...p, label: dayLabel(p.date) })), [analytics.series]);

  if (!hasData) {
    return (
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px 4px', textAlign: 'center' }}>
        Sin actividad de la flota en este periodo para graficar.
      </div>
    );
  }

  const tooltipStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.75rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <ChartCard title="Tokens / día" subtitle={`${formatTokens(totalTokens)} en total`}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={seriesData} margin={{ top: 6, right: 10, bottom: 4, left: 4 }}>
              <defs>
                <linearGradient id="fleetTok" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--mod-agents, #d4a017)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--mod-agents, #d4a017)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tickFormatter={formatTokens} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} width={38} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, _n, p) => [`${Number(v).toLocaleString('es-ES')} tok · ${p?.payload?.messages ?? 0} msgs`, 'Tokens']} labelFormatter={(l) => l} />
              <Area type="monotone" dataKey="tokens" stroke="var(--mod-agents, #d4a017)" strokeWidth={2} fill="url(#fleetTok)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Coste / día" subtitle={totalCost > 0 ? `$${totalCost.toFixed(2)} en total` : 'sin coste registrado'}>
          {totalCost > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={seriesData} margin={{ top: 6, right: 10, bottom: 4, left: 4 }}>
                <defs>
                  <linearGradient id="fleetCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} width={38} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${Number(v).toFixed(4)}`, 'Coste']} />
                <Area type="monotone" dataKey="cost_usd" stroke="#22c55e" strokeWidth={2} fill="url(#fleetCost)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '0 12px' }}>
              Los modelos locales (Ollama) no registran coste. Aparecerá aquí al usar proveedores de pago.
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Tokens / día apilados"
        toolbar={
          <div style={{ display: 'flex', gap: 4 }}>
            {(['agent', 'model'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setStackBy(m)}
                style={{
                  background: stackBy === m ? 'var(--amber-dim)' : 'transparent',
                  color: stackBy === m ? 'var(--amber)' : 'var(--text-dim)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  padding: '2px 9px', fontSize: '0.625rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                {m === 'agent' ? 'por agente' : 'por modelo'}
              </button>
            ))}
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stackData.map((r) => ({ ...r, label: dayLabel(String(r.date)) }))} margin={{ top: 6, right: 10, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tickFormatter={formatTokens} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} width={38} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${Number(v).toLocaleString('es-ES')} tok`, n]} />
            {stackKeys.map((k) => (
              <Bar key={k.key} dataKey={k.key} stackId="tok" fill={k.color} radius={[0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, padding: '0 2px' }}>
          {stackKeys.map((k) => (
            <span key={k.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.625rem', color: 'var(--text-dim)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: k.color }} /> {k.key}
            </span>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, subtitle, toolbar, children }: { title: string; subtitle?: string; toolbar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</span>
          {subtitle && <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{subtitle}</span>}
        </div>
        {toolbar}
      </div>
      {children}
    </div>
  );
}
