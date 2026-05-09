/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useEffect, useState } from 'react';
import { BarChart3, Clock, Zap, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { useFlowsStore, type FlowStats as FlowStatsType } from '@/stores/flows.store';

interface FlowStatsProps {
  flowId: string;
  flowName: string;
  flowColor: string;
}

export function FlowStats({ flowId, flowName, flowColor }: FlowStatsProps) {
  const fetchStats = useFlowsStore((s) => s.fetchStats);
  const [stats, setStats] = useState<FlowStatsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats(flowId)
      .then(setStats)
      .catch((err) => { console.warn('flows: failed to load flow stats', err); })
      .finally(() => setLoading(false));
  }, [flowId, fetchStats]);

  if (loading) return <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: 20 }}>Loading stats...</div>;
  if (!stats) return <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: 20 }}>No stats available.</div>;

  const successRate = stats.total_runs > 0 ? Math.round((stats.success_runs / stats.total_runs) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
        {flowName} — Statistics
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        <StatCard icon={BarChart3} label="Executions" value={`${stats.success_runs}/${stats.total_runs}`} sub={`${successRate}% success`} color={flowColor} />
        <StatCard icon={AlertTriangle} label="Errors" value={String(stats.error_runs)} sub={stats.error_runs > 0 ? 'Review needed' : 'None'} color={stats.error_runs > 0 ? 'var(--error)' : 'var(--success)'} />
        <StatCard icon={Clock} label="Avg duration" value={stats.avg_duration_ms != null ? (stats.avg_duration_ms < 1000 ? `${stats.avg_duration_ms}ms` : `${(stats.avg_duration_ms / 1000).toFixed(1)}s`) : '—'} sub="per execution" color="var(--info)" />
        <StatCard icon={Zap} label="AI tokens" value={stats.total_tokens.toLocaleString()} sub="total used" color="#ec4899" />
        <StatCard icon={DollarSign} label="AI cost" value={`~$${stats.total_cost.toFixed(2)}`} sub="approximate" color="var(--warning)" />
        <StatCard icon={TrendingUp} label="Success rate" value={`${successRate}%`} sub={successRate >= 90 ? 'Excellent' : successRate >= 70 ? 'Good' : 'Needs attention'} color={successRate >= 90 ? 'var(--success)' : successRate >= 70 ? 'var(--warning)' : 'var(--error)'} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: typeof BarChart3; label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Icon size={13} style={{ color }} />
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>
    </div>
  );
}
