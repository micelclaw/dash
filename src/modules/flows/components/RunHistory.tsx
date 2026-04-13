/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, Loader2, Ban } from 'lucide-react';
import { useFlowsStore, type FlowRun, type Flow } from '@/stores/flows.store';
import { api } from '@/services/api';

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: 'var(--success)', label: 'Completed' },
  failed: { icon: XCircle, color: 'var(--error)', label: 'Failed' },
  running: { icon: Loader2, color: 'var(--info)', label: 'Running' },
  waiting_approval: { icon: Clock, color: 'var(--amber)', label: 'Waiting' },
  cancelled: { icon: Ban, color: 'var(--text-muted)', label: 'Cancelled' },
};

interface RunHistoryProps {
  flowId?: string; // if provided, show runs for this flow only
}

export function RunHistory({ flowId }: RunHistoryProps) {
  const flows = useFlowsStore((s) => s.flows);
  const [runs, setRuns] = useState<FlowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const path = flowId ? `/flows/${flowId}/runs?limit=30` : '/flows/pending';
    api.get<{ data: FlowRun[] }>(path)
      .then((res) => setRuns(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [flowId]);

  const getFlowName = (fid: string): string => {
    return flows.find((f) => f.id === fid)?.name ?? 'Flow';
  };

  if (loading) {
    return <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: 40 }}>Loading history...</div>;
  }

  if (runs.length === 0) {
    return <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: 40 }}>No executions yet.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {runs.map((run) => {
        const config = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.cancelled;
        const Icon = config.icon;
        const isExpanded = expandedRun === run.id;

        return (
          <div key={run.id}>
            <div
              onClick={() => setExpandedRun(isExpanded ? null : run.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              <Icon size={14} style={{ color: config.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-dim)', width: 120, flexShrink: 0 }}>
                {new Date(run.started_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              {!flowId && (
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getFlowName(run.flow_id)}
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 60, textAlign: 'center' }}>
                {run.steps_completed}/{run.steps_total}
              </span>
              {run.duration_ms != null && (
                <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 50, textAlign: 'right' }}>
                  {run.duration_ms < 1000 ? `${run.duration_ms}ms` : `${(run.duration_ms / 1000).toFixed(1)}s`}
                </span>
              )}
              <span style={{ fontSize: 10, color: config.color, width: 60, textAlign: 'right' }}>{config.label}</span>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{
                margin: '0 0 4px', padding: '10px 16px',
                background: 'var(--surface)', borderRadius: '0 0 6px 6px',
                border: '1px solid var(--border)', borderTop: 'none',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
                  Trigger: {run.trigger_source} · Tokens: {run.tokens_used} · Cost: ~${Number(run.cost_usd_estimate).toFixed(4)}
                </div>

                {/* Step results */}
                {Array.isArray(run.step_results) && (run.step_results as Array<Record<string, unknown>>).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(run.step_results as Array<{ step_id: string; status: string; output_summary?: string; duration_ms?: number; error?: string }>).map((sr, i) => {
                      const stepConfig = STATUS_CONFIG[sr.status] ?? STATUS_CONFIG.cancelled;
                      const StepIcon = stepConfig.icon;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <StepIcon size={11} style={{ color: stepConfig.color }} />
                          <span style={{ color: 'var(--text)' }}>Step {sr.step_id}</span>
                          {sr.output_summary && <span style={{ color: 'var(--text-dim)' }}>— {sr.output_summary}</span>}
                          {sr.duration_ms != null && <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{sr.duration_ms}ms</span>}
                          {sr.error && <span style={{ color: 'var(--error)' }}>— {sr.error}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Error message */}
                {run.error && (
                  <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(244,63,94,0.1)', borderRadius: 4, fontSize: 12, color: 'var(--error)' }}>
                    {run.error}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
