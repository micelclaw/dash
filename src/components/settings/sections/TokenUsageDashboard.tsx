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

import { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Cpu, Cloud, Activity } from 'lucide-react';
import { useMetricsStore } from '@/stores/metrics.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { api } from '@/services/api';
import { getAgentDecisionModel, listManagedAgents } from '@/services/agents-admin.service';
import { Link } from 'react-router';

const PERIODS = ['hour', 'day', 'week', 'month'] as const;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function displaySession(value: unknown): string {
  const label = String(value ?? '');
  if (label.startsWith('webchat:')) return `Chat · ${label.slice(8, 16)}`;
  if (label.startsWith('agent:')) return `Sesión del agente · ${label.split(':')[1] ?? '—'}`;
  return label || 'Sin título';
}

function displayCreator(value: unknown): string {
  if (value == null) return 'No identificado';
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const actor = parsed as Record<string, unknown>;
      const label = actor.label ?? actor.displayName ?? actor.display_name;
      if (typeof label === 'string' && label) return label;
    }
    if (Array.isArray(parsed) && parsed[0] === 'profile') return 'Perfil personal';
    if (Array.isArray(parsed) && parsed[0] === 'unknown') return 'No identificado';
  } catch { /* A plain label needs no decoding. */ }
  return String(value);
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0.00';
  return `$${usd.toFixed(2)}`;
}

function formatDate(iso: string, period: string): string {
  const d = new Date(iso);
  if (period === 'hour') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (period === 'day') return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  if (period === 'week') return `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleDateString([], { month: 'short' })}`;
  return d.toLocaleDateString([], { month: 'short', year: '2-digit' });
}

const APP_ICONS: Record<string, string> = {
  'claw-mail': '📧',
  'claw-search': '🔍',
  'embeddings': '🧮',
  'photo-index': '📷',
  'agent-general': '🤖',
  'claw-diary': '📓',
  'claw-notes': '📝',
  unknown: '📦',
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '8px 12px',
      fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 8 }}>
          <span>{p.name}:</span>
          <span style={{ fontWeight: 500 }}>{formatTokens(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function TokenUsageDashboard() {
  const [tab, setTab] = useState<'openclaw' | 'core'>('openclaw');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}>
        {([['openclaw', 'OpenClaw'], ['core', 'Procesos de Micelclaw']] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)} style={{ padding: '8px 12px', border: 'none', borderBottom: tab === key ? '2px solid var(--amber)' : '2px solid transparent', background: 'transparent', color: tab === key ? 'var(--amber)' : 'var(--text-dim)', cursor: 'pointer', fontWeight: 600 }}>{label}</button>)}
      </div>
      {tab === 'openclaw' ? <OpenClawUsageDashboard /> : <CoreUsageDashboard />}
    </div>
  );
}

interface OpenClawUsagePayload {
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  totals?: Record<string, unknown>;
  sessions?: Array<Record<string, unknown>>;
  creatorOptions?: Array<Record<string, unknown>>;
  creator_options?: Array<Record<string, unknown>>;
  aggregates?: Record<string, unknown>;
  ownedAgentIds?: string[];
  owned_agent_ids?: string[];
}

function OpenClawUsageDashboard() {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [groupBy, setGroupBy] = useState<'instance' | 'family'>('instance');
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timeZone, setTimeZone] = useState<'local' | 'utc'>('local');
  const [agentId, setAgentId] = useState('');
  const [creatorKey, setCreatorKey] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [data, setData] = useState<OpenClawUsagePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState(false);
  const [decisionModel, setDecisionModel] = useState<{ agent: string; model: string } | null>(null);
  useEffect(() => {
    let active = true;
    const agentName = agentId ? agentId.split('--').at(-1) : 'francis';
    void listManagedAgents().then(async (agents) => {
      const agent = agents.find((item) => String(item.name ?? '').toLowerCase() === agentName?.toLowerCase());
      if (!agent) { if (active) setDecisionModel(null); return; }
      const state = await getAgentDecisionModel(agent.id);
      if (active) setDecisionModel({ agent: String(agent.display_name ?? agent.name), model: state.effective_model ?? 'Desactivado' });
    }).catch(() => { if (active) setDecisionModel(null); });
    return () => { active = false; };
  }, [agentId]);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    api.get<{ data: OpenClawUsagePayload }>('/openclaw-usage', {
      range, group_by: groupBy, limit: 1000, start_date: startDate, end_date: endDate,
      time_zone: timeZone === 'utc' ? 'utc' : Intl.DateTimeFormat().resolvedOptions().timeZone,
      agent_id: agentId || undefined, creator_key: creatorKey || undefined,
    }, { timeout: 65_000 })
      .then((response) => { if (active) setData(response.data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el consumo'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range, groupBy, startDate, endDate, timeZone, agentId, creatorKey]);
  const totals = data?.totals ?? {};
  const allRows = data?.sessions ?? [];
  const rows = useMemo(() => modelFilter ? allRows.filter((row) => {
    const usage = row.usage && typeof row.usage === 'object' ? row.usage as Record<string, unknown> : {};
    const modelUsage = Array.isArray(usage.model_usage) ? usage.model_usage as Array<Record<string, unknown>> : Array.isArray(usage.modelUsage) ? usage.modelUsage as Array<Record<string, unknown>> : [];
    return `${String(row.model_provider ?? row.modelProvider ?? '')}/${String(row.model ?? '')}` === modelFilter || modelUsage.some((item) => `${String(item.provider ?? '')}/${String(item.model ?? '')}` === modelFilter);
  }) : allRows, [allRows, modelFilter]);
  const aggregates = data?.aggregates ?? {};
  const agentOptions = (Array.isArray(aggregates.by_agent) ? aggregates.by_agent as Array<Record<string, unknown>> : Array.isArray(aggregates.byAgent) ? aggregates.byAgent as Array<Record<string, unknown>> : [])
    .filter((item) => (data?.owned_agent_ids ?? data?.ownedAgentIds ?? []).includes(String(item.agent_id ?? item.agentId ?? '')));
  const modelOptions = Array.isArray(aggregates.by_model) ? aggregates.by_model as Array<Record<string, unknown>> : Array.isArray(aggregates.byModel) ? aggregates.byModel as Array<Record<string, unknown>> : [];
  const filteredTotals = useMemo<{ tokens: number; cost: number; missingCostEntries: number }>(() => {
    if (!modelFilter) return { tokens: Number(totals.total_tokens ?? totals.totalTokens ?? totals.tokens ?? 0), cost: Number(totals.total_cost ?? totals.totalCost ?? totals.cost_usd ?? totals.cost ?? 0), missingCostEntries: Number(totals.missing_cost_entries ?? totals.missingCostEntries ?? 0) };
    // Gateway aggregates all matching sessions before applying the 1,000-row
    // detail limit; reducing the visible rows would produce partial totals.
    const aggregate = modelOptions.find((item) => `${String(item.provider ?? '')}/${String(item.model ?? '')}` === modelFilter);
    const modelTotals = aggregate?.totals && typeof aggregate.totals === 'object' ? aggregate.totals as Record<string, unknown> : {};
    return { tokens: Number(modelTotals.total_tokens ?? modelTotals.totalTokens ?? 0), cost: Number(modelTotals.total_cost ?? modelTotals.totalCost ?? 0), missingCostEntries: Number(modelTotals.missing_cost_entries ?? modelTotals.missingCostEntries ?? 0) };
  }, [modelFilter, modelOptions, totals]);
  const totalTokens = filteredTotals.tokens;
  const knownCost = filteredTotals.cost;
  const unknownPrices = filteredTotals.missingCostEntries;
  const daily = useMemo(() => {
    if (!modelFilter) return Array.isArray(aggregates.daily) ? aggregates.daily as Array<Record<string, unknown>> : [];
    const modelDaily = Array.isArray(aggregates.model_daily) ? aggregates.model_daily as Array<Record<string, unknown>> : Array.isArray(aggregates.modelDaily) ? aggregates.modelDaily as Array<Record<string, unknown>> : [];
    const map = new Map<string, number>();
    for (const item of modelDaily) if (`${String(item.provider ?? '')}/${String(item.model ?? '')}` === modelFilter) map.set(String(item.date), (map.get(String(item.date)) ?? 0) + Number(item.tokens ?? 0));
    return [...map].map(([date, tokens]) => ({ date, tokens }));
  }, [aggregates, modelFilter]);
  const exportRows = () => {
    const sessions = modelFilter ? rows.map((row) => {
      const usage = row.usage && typeof row.usage === 'object' ? row.usage as Record<string, unknown> : {};
      const entries = Array.isArray(usage.model_usage) ? usage.model_usage as Array<Record<string, unknown>> : Array.isArray(usage.modelUsage) ? usage.modelUsage as Array<Record<string, unknown>> : [];
      return { ...row, usage: { modelUsage: entries.filter((entry) => `${String(entry.provider ?? '')}/${String(entry.model ?? '')}` === modelFilter) } };
    }) : rows;
    const blob = new Blob([JSON.stringify({ range, startDate, endDate, timeZone, groupBy, agentId, creatorKey, modelFilter, totals: filteredTotals, detailIsLimited: allRows.length >= 1000, sessions }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `openclaw-usage-${range}.json`; link.click(); URL.revokeObjectURL(url);
  };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
      <strong style={{ fontSize: '1rem', color: 'var(--text)' }}>Consumo de conversaciones</strong>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Datos nativos de OpenClaw · costes en USD</span>
    </div>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <label style={usageLabelStyle}>Periodo<select value={range} onChange={(event) => {
        const next = event.target.value as typeof range;
        const days = next === '7d' ? 7 : next === '90d' ? 90 : next === '1y' ? 365 : 30;
        const end = new Date(); const start = new Date(end.getTime() - (days - 1) * 86_400_000);
        setRange(next); setStartDate(start.toISOString().slice(0, 10)); setEndDate(end.toISOString().slice(0, 10));
      }} style={usageSelectStyle}><option value="7d">7 días</option><option value="30d">30 días</option><option value="90d">90 días</option><option value="1y">1 año</option></select></label>
      <label style={usageLabelStyle}>Desde<input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} style={usageSelectStyle} /></label>
      <label style={usageLabelStyle}>Hasta<input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} style={usageSelectStyle} /></label>
      <label style={usageLabelStyle}>Agente<select value={agentId} onChange={(event) => setAgentId(event.target.value)} style={usageSelectStyle}><option value="">Todos los míos</option>{agentOptions.map((item) => { const id = String(item.agent_id ?? item.agentId ?? ''); return <option key={id} value={id}>{id}</option>; })}</select></label>
      <label style={usageLabelStyle}>Modelo<select value={modelFilter} onChange={(event) => setModelFilter(event.target.value)} style={usageSelectStyle}><option value="">Todos</option>{modelOptions.map((item) => { const ref = `${String(item.provider ?? '')}/${String(item.model ?? '')}`; return <option key={ref} value={ref}>{ref}</option>; })}</select></label>
      <button onClick={() => setAdvancedFilters((value) => !value)} style={{ ...usageSelectStyle, cursor: 'pointer' }}>{advancedFilters ? 'Menos filtros' : 'Más filtros'}</button>
      <button onClick={exportRows} disabled={!data} style={{ ...usageSelectStyle, cursor: 'pointer', marginLeft: 'auto', color: 'var(--amber)', fontWeight: 600 }}>Exportar selección</button>
      {advancedFilters && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: '100%' }}>
        <label style={usageLabelStyle}>Agrupar<select value={groupBy} onChange={(event) => setGroupBy(event.target.value as typeof groupBy)} style={usageSelectStyle}><option value="instance">Conversación</option><option value="family">Familia</option></select></label>
        <label style={usageLabelStyle}>Zona<select value={timeZone} onChange={(event) => setTimeZone(event.target.value as typeof timeZone)} style={usageSelectStyle}><option value="local">Local</option><option value="utc">UTC</option></select></label>
        <label style={usageLabelStyle}>Creador<select value={creatorKey} onChange={(event) => setCreatorKey(event.target.value)} style={usageSelectStyle}><option value="">Todos autorizados</option>{(data?.creator_options ?? data?.creatorOptions ?? []).map((item) => { const actor = item.actor && typeof item.actor === 'object' ? item.actor as Record<string, unknown> : {}; return <option key={String(item.key)} value={String(item.key)}>{String(actor.label ?? item.label ?? item.key)}</option>; })}</select></label>
      </div>}
    </div>
    {loading && <span style={{ color: 'var(--text-dim)' }}>Calculando consumo nativo…</span>}
    {error && <div style={{ color: 'var(--error)' }}>{error}</div>}
    {data && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
        <UsageCard testId="openclaw-usage-total-tokens" label="Tokens" value={formatTokens(totalTokens)} /><UsageCard label="Coste conocido" value={`$${knownCost.toFixed(2)}`} /><UsageCard testId="openclaw-usage-unknown-prices" label="Precio desconocido" value={`${unknownPrices} entradas`} />
      </div>
      <div style={{ padding: '10px 13px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-dim)', fontSize: '0.75rem', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--text)' }}>Modelo de decisión actual</strong> · {decisionModel ? `${decisionModel.agent}: ${decisionModel.model}` : 'Selecciona un agente para consultar su configuración.'}
        <div>Esta vista contabiliza turnos de chat. Las pruebas de decisión no tienen aún un histórico de consumo en OpenClaw. <Link to="/agents" style={{ color: 'var(--amber)' }}>Configurar y probar en Agents</Link>.</div>
      </div>
      {daily.length > 0 && <div style={{ height: 180, padding: '12px 4px 4px', border: '1px solid var(--border)', borderRadius: 8 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={daily}><XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(value: string) => value.slice(5)} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(value: number) => formatTokens(value)} /><Tooltip formatter={(value) => formatTokens(Number(value))} /><Area type="monotone" dataKey="tokens" stroke="var(--amber)" fill="color-mix(in srgb, var(--amber) 20%, transparent)" isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>}
      <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Conversaciones · {rows.length} mostradas{allRows.length >= 1000 ? ' (detalle limitado a 1.000; gráfico y totales incluyen todo el periodo)' : ''}. El modelo de decisión no forma parte del consumo de chat.</div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}><thead><tr>{['Conversación', 'Agente', 'Creador', 'Modelo de chat', 'Tokens', 'Coste USD'].map((h) => <th key={h} style={{ ...usageCellStyle, color: 'var(--text)', background: 'var(--surface)' }}>{h}</th>)}</tr></thead><tbody>{(showAll ? rows : rows.slice(0, 20)).map((row, index) => {
        const usage = row.usage && typeof row.usage === 'object' ? row.usage as Record<string, unknown> : {};
        const modelEntries = Array.isArray(usage.model_usage) ? usage.model_usage as Array<Record<string, unknown>> : Array.isArray(usage.modelUsage) ? usage.modelUsage as Array<Record<string, unknown>> : [];
        const selectedModelUsage = modelFilter ? modelEntries.filter((entry) => `${String(entry.provider ?? '')}/${String(entry.model ?? '')}` === modelFilter) : [];
        const tokens = modelFilter ? selectedModelUsage.reduce((sum, entry) => { const part = entry.totals && typeof entry.totals === 'object' ? entry.totals as Record<string, unknown> : {}; return sum + Number(part.total_tokens ?? part.totalTokens ?? 0); }, 0) : Number(usage.total_tokens ?? usage.totalTokens ?? 0);
        const cost = modelFilter ? selectedModelUsage.reduce((sum, entry) => { const part = entry.totals && typeof entry.totals === 'object' ? entry.totals as Record<string, unknown> : {}; return sum + Number(part.total_cost ?? part.totalCost ?? 0); }, 0) : usage.total_cost ?? usage.totalCost ?? usage.cost_usd ?? usage.costUsd ?? usage.cost;
        return <tr key={String(row.key ?? index)}><td style={usageCellStyle}><details><summary title={String(row.key ?? '')} style={{ cursor: 'pointer', color: 'var(--text)' }}>{displaySession(row.label ?? row.key)}</summary><pre style={{ maxWidth: 420, whiteSpace: 'pre-wrap', fontSize: '0.65rem' }}>{JSON.stringify(usage, null, 2)}</pre></details></td><td style={usageCellStyle}>{String(row.agent_id ?? row.agentId ?? '—').replace(/^paco--/, '')}</td><td style={usageCellStyle}>{displayCreator(row.createdActor ?? row.creator_key ?? row.creatorKey)}</td><td style={usageCellStyle}>{String(row.model ?? row.model_override ?? row.modelOverride ?? '—')}</td><td style={usageCellStyle}>{formatTokens(tokens)}</td><td style={usageCellStyle}>{typeof cost === 'number' ? `$${cost.toFixed(4)}` : 'Desconocido'}</td></tr>;
      })}</tbody></table></div>
      {rows.length > 20 && <button onClick={() => setShowAll((value) => !value)} style={{ ...usageSelectStyle, alignSelf: 'flex-start', cursor: 'pointer', color: 'var(--amber)' }}>{showAll ? 'Mostrar menos' : `Mostrar las ${rows.length} conversaciones`}</button>}
    </>}
  </div>;
}

function UsageCard({ label, value, testId }: { label: string; value: string; testId?: string }) { return <div data-testid={testId} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}><div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div><strong style={{ color: 'var(--text)', fontSize: '1.1rem' }}>{value}</strong></div>; }
const usageLabelStyle = { display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-dim)', fontSize: '0.7rem' } as const;
const usageSelectStyle = { padding: '7px 9px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7 } as const;
const usageCellStyle = { padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' } as const;

function CoreUsageDashboard() {
  const summary = useMetricsStore((s) => s.summary);
  const byApp = useMetricsStore((s) => s.byApp);
  const byModel = useMetricsStore((s) => s.byModel);
  const period = useMetricsStore((s) => s.period);
  const loading = useMetricsStore((s) => s.loading);
  const setPeriod = useMetricsStore((s) => s.setPeriod);
  const fetchAll = useMetricsStore((s) => s.fetchAll);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Empty state
  if (!loading && !summary) {
    return (
      <div style={{
        padding: '32px 16px', textAlign: 'center',
        border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)',
        color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)',
      }}>
        <Activity size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
        <div>No token usage recorded yet.</div>
        <div style={{ fontSize: '0.75rem', marginTop: 4 }}>
          Start chatting with your agent to see metrics here.
        </div>
      </div>
    );
  }

  // Loading skeleton
  if (loading && !summary) {
    return (
      <div style={{ padding: '24px 0' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            height: 60, background: 'var(--surface)', borderRadius: 'var(--radius-md)',
            marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        ))}
        <style>{`@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      </div>
    );
  }

  if (!summary) return null;

  const chartData = summary.timeline.map((t) => ({
    name: formatDate(t.period, period),
    agent: t.agent,
    core: t.core,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Period Selector */}
      <div style={{ display: 'flex', gap: 4 }}>
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              height: 28, padding: '0 12px',
              background: period === p ? 'var(--amber)' : 'var(--surface)',
              color: period === p ? '#06060a' : 'var(--text-dim)',
              border: period === p ? 'none' : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem', fontWeight: period === p ? 600 : 400,
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'flex', gap: 12,
        padding: 16, background: 'var(--surface)', borderRadius: 'var(--radius-md)',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Tokens
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', marginTop: 2 }}>
            {formatTokens(summary.total_tokens)}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Est. Cost
          </div>
          <div style={{
            fontSize: '1.25rem', fontWeight: 600, marginTop: 2,
            color: summary.estimated_cost_usd > 0 ? 'var(--amber)' : '#22c55e',
            fontFamily: 'var(--font-sans)',
          }}>
            {formatCost(summary.estimated_cost_usd)}
          </div>
        </div>
        {/* Source mini-cards */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            padding: '8px 12px', background: 'var(--card)', borderRadius: 'var(--radius-sm)',
            borderLeft: '3px solid #3b82f6', minWidth: 80,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: '#3b82f6', fontFamily: 'var(--font-sans)' }}>
              <Cloud size={10} /> Agent
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
              {formatTokens(summary.by_source.agent)}
            </div>
          </div>
          <div style={{
            padding: '8px 12px', background: 'var(--card)', borderRadius: 'var(--radius-sm)',
            borderLeft: '3px solid #22c55e', minWidth: 80,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: '#22c55e', fontFamily: 'var(--font-sans)' }}>
              <Cpu size={10} /> Core
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
              {formatTokens(summary.by_source.core)}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Chart */}
      {chartData.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '16px 8px 8px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: 8, paddingLeft: 8 }}>
            Usage Timeline
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="agentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="coreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatTokens}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="agent"
                stackId="1"
                stroke="#3b82f6"
                fill="url(#agentGrad)"
                strokeWidth={1.5}
                name="Agent"
              />
              <Area
                type="monotone"
                dataKey="core"
                stackId="1"
                stroke="#22c55e"
                fill="url(#coreGrad)"
                strokeWidth={1.5}
                name="Core"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By App & By Model tables */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 12,
      }}>
        {/* By App */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: 12 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: 8, fontWeight: 500 }}>
            By App
          </div>
          {byApp.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 0' }}>No data</div>
          ) : (
            byApp.map((a) => (
              <div key={a.app_name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 0', borderBottom: '1px solid var(--border)',
                fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
                  <span>{APP_ICONS[a.app_name] || APP_ICONS.unknown}</span>
                  <span>{a.app_name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-dim)' }}>
                  <span style={{ fontSize: '0.75rem' }}>{formatTokens(a.total_tokens)}</span>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 500,
                    color: a.cost_usd === 0 ? '#22c55e' : 'var(--amber)',
                  }}>
                    {formatCost(a.cost_usd)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* By Model */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: 12 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: 8, fontWeight: 500 }}>
            By Model
          </div>
          {byModel.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 0' }}>No data</div>
          ) : (
            byModel.map((m) => (
              <div key={m.model} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 0', borderBottom: '1px solid var(--border)',
                fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
                  <span>{m.model}</span>
                  <span style={{
                    fontSize: '0.5625rem', padding: '1px 5px',
                    borderRadius: 'var(--radius-sm)', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    background: m.is_local ? 'rgba(34,197,94,0.15)' : 'rgba(212,160,23,0.15)',
                    color: m.is_local ? '#22c55e' : 'var(--amber)',
                  }}>
                    {m.is_local ? 'LOCAL' : 'CLOUD'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-dim)' }}>
                  <span style={{ fontSize: '0.75rem' }}>{formatTokens(m.total_tokens)}</span>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 500,
                    color: m.cost_usd === 0 ? '#22c55e' : 'var(--amber)',
                  }}>
                    {formatCost(m.cost_usd)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
