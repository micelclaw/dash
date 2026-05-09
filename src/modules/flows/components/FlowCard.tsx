/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useNavigate } from 'react-router';
import { Workflow, Play } from 'lucide-react';
import { useFlowsStore, type Flow } from '@/stores/flows.store';
import { toast } from 'sonner';
import { FlowMenu } from './FlowMenu';

// ─── Sparkline ─────────────────────────────────────────────

function Sparkline({ runs }: { runs: Array<{ status: string }> }) {
  const dots = runs.slice(-10);
  if (dots.length === 0) return <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>No runs yet</span>;

  const successCount = dots.filter((r) => r.status === 'completed').length;
  const pct = Math.round((successCount / dots.length) * 100);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {dots.map((r, i) => (
          <div
            key={i}
            style={{
              width: 4, height: 4, borderRadius: '50%',
              background: r.status === 'completed' ? 'var(--success)' : r.status === 'failed' ? 'var(--error)' : 'var(--text-muted)',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pct}%</span>
    </div>
  );
}

// ─── Schedule label ────────────────────────────────────────

function scheduleLabel(flow: Flow): string {
  if (flow.trigger_type === 'manual') return 'Manual';
  if (flow.trigger_type === 'cron') {
    const expr = (flow.trigger_config as Record<string, string>)?.expression ?? '';
    // Simple human-readable for common patterns
    if (expr.includes('* * 1-5')) return 'Weekdays';
    if (expr.includes('* * 0')) return 'Sundays';
    return 'Scheduled';
  }
  if (flow.trigger_type === 'event') return 'On event';
  if (flow.trigger_type === 'sensor') return 'Sensor';
  return flow.trigger_type;
}

// ─── Grid Card ─────────────────────────────────────────────

export function FlowCardGrid({ flow, recentRuns }: { flow: Flow; recentRuns: Array<{ status: string }> }) {
  const navigate = useNavigate();
  const toggleFlow = useFlowsStore((s) => s.toggleFlow);
  const runFlow = useFlowsStore((s) => s.runFlow);

  return (
    <div
      onClick={() => navigate(`/flows/${flow.id}`)}
      style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
        padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column',
        gap: 8, minWidth: 160, opacity: flow.enabled ? 1 : 0.5,
        transition: 'border-color 150ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = flow.color; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Workflow size={24} style={{ color: flow.color }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); runFlow(flow.id).then(() => toast.success('Flow started')).catch((err) => toast.error(err.message)); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
            title="Run now"
          >
            <Play size={14} />
          </button>
          <FlowMenu flow={flow} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>{flow.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{scheduleLabel(flow)}</div>
      </div>
      <Sparkline runs={recentRuns} />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={(e) => { e.stopPropagation(); toggleFlow(flow.id); }}
          style={{
            padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)',
            background: flow.enabled ? 'var(--success)' : 'var(--surface-hover)',
            color: flow.enabled ? '#fff' : 'var(--text-dim)', fontSize: 10,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          {flow.enabled ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
}

// ─── List Row ──────────────────────────────────────────────

export function FlowCardList({ flow, recentRuns }: { flow: Flow; recentRuns: Array<{ status: string }> }) {
  const navigate = useNavigate();
  const toggleFlow = useFlowsStore((s) => s.toggleFlow);

  return (
    <div
      onClick={() => navigate(`/flows/${flow.id}`)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
        cursor: 'pointer', opacity: flow.enabled ? 1 : 0.5,
      }}
    >
      <Workflow size={16} style={{ color: flow.color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {flow.name}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 80, textAlign: 'center' }}>{scheduleLabel(flow)}</span>
      <div style={{ width: 80 }}><Sparkline runs={recentRuns} /></div>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 80, textAlign: 'right' }}>
        {flow.last_run_at ? new Date(flow.last_run_at).toLocaleDateString() : '—'}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); toggleFlow(flow.id); }}
        style={{
          padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)',
          background: flow.enabled ? 'var(--success)' : 'var(--surface-hover)',
          color: flow.enabled ? '#fff' : 'var(--text-dim)', fontSize: 10,
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}
      >
        {flow.enabled ? 'On' : 'Off'}
      </button>
      <FlowMenu flow={flow} />
    </div>
  );
}

// ─── Banner Card ───────────────────────────────────────────

export function FlowCardBanner({ flow, recentRuns }: { flow: Flow; recentRuns: Array<{ status: string }> }) {
  const navigate = useNavigate();
  const toggleFlow = useFlowsStore((s) => s.toggleFlow);

  return (
    <div
      onClick={() => navigate(`/flows/${flow.id}`)}
      style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
        cursor: 'pointer', opacity: flow.enabled ? 1 : 0.5,
      }}
    >
      <Workflow size={28} style={{ color: flow.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{flow.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span>{scheduleLabel(flow)}</span>
          <span>{flow.success_count}/{flow.run_count} successful</span>
          {flow.last_run_at && <span>Last: {new Date(flow.last_run_at).toLocaleDateString()}</span>}
          <Sparkline runs={recentRuns} />
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); toggleFlow(flow.id); }}
        style={{
          padding: '2px 10px', borderRadius: 4, border: '1px solid var(--border)',
          background: flow.enabled ? 'var(--success)' : 'var(--surface-hover)',
          color: flow.enabled ? '#fff' : 'var(--text-dim)', fontSize: 10,
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}
      >
        {flow.enabled ? 'On' : 'Off'}
      </button>
      <FlowMenu flow={flow} />
    </div>
  );
}
