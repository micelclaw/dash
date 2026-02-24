import { useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Cpu, Cloud, Activity } from 'lucide-react';
import { useMetricsStore } from '@/stores/metrics.store';
import { useIsMobile } from '@/hooks/use-media-query';

const PERIODS = ['hour', 'day', 'week', 'month'] as const;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd === 0) return 'FREE';
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
