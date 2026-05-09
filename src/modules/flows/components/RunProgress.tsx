/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { CheckCircle2, XCircle, Clock, Loader2, Circle, Play, Ban } from 'lucide-react';
import type { FlowRun } from '@/stores/flows.store';

const STEP_ICONS: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  ok: { icon: CheckCircle2, color: 'var(--success)' },
  completed: { icon: CheckCircle2, color: 'var(--success)' },
  approved: { icon: CheckCircle2, color: 'var(--success)' },
  failed: { icon: XCircle, color: 'var(--error)' },
  error: { icon: XCircle, color: 'var(--error)' },
  waiting: { icon: Clock, color: 'var(--amber)' },
  running: { icon: Loader2, color: 'var(--info)' },
  pending: { icon: Circle, color: 'var(--text-muted)' },
  simulated: { icon: Circle, color: 'var(--info)' },
};

interface RunProgressProps {
  run: FlowRun;
  flowSteps: Array<{ id: string; label: string; type: string }>;
  onApprove?: () => void;
  onReject?: () => void;
}

export function RunProgress({ run, flowSteps, onApprove, onReject }: RunProgressProps) {
  const stepResults = (run.step_results ?? []) as Array<{ step_id: string; status: string; output_summary?: string; duration_ms?: number; tokens_used?: number; error?: string }>;

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      {/* Header — Lucide icons (was emoji literals, inconsistent with
          the rest of the module which uses Lucide everywhere). */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
          {run.status === 'running' && <><Play size={12} style={{ color: 'var(--info)' }} /> Running…</>}
          {run.status === 'waiting_approval' && <><Clock size={12} style={{ color: 'var(--amber)' }} /> Waiting for approval</>}
          {run.status === 'completed' && <><CheckCircle2 size={12} style={{ color: 'var(--success)' }} /> Completed</>}
          {run.status === 'failed' && <><XCircle size={12} style={{ color: 'var(--error)' }} /> Failed</>}
          {run.status === 'cancelled' && <><Ban size={12} style={{ color: 'var(--text-muted)' }} /> Cancelled</>}
          {run.status === 'queued' && <><Clock size={12} style={{ color: 'var(--text-muted)' }} /> Queued</>}
        </span>
        {run.duration_ms != null && (
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {run.duration_ms < 1000 ? `${run.duration_ms}ms` : `${(run.duration_ms / 1000).toFixed(1)}s`}
          </span>
        )}
      </div>

      {/* Steps */}
      {flowSteps.map((step, i) => {
        const result = stepResults.find((sr) => sr.step_id === step.id);
        const status = result?.status ?? (i < run.steps_completed ? 'completed' : run.current_step_id === step.id ? 'running' : 'pending');
        const config = STEP_ICONS[status] ?? STEP_ICONS.pending;
        const Icon = config.icon;

        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16, flexShrink: 0, paddingTop: 2 }}>
              <Icon size={14} style={{ color: config.color }} />
              {i < flowSteps.length - 1 && <div style={{ width: 1, height: 16, background: 'var(--border)', marginTop: 2 }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: status === 'pending' ? 'var(--text-muted)' : 'var(--text)', fontWeight: status === 'running' ? 500 : 400 }}>
                {step.label || step.type}
              </div>
              {result?.output_summary && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{result.output_summary}</div>
              )}
              {result?.error && (
                <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 1 }}>{result.error}</div>
              )}
              {result?.tokens_used ? (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Tokens: {result.tokens_used}</span>
              ) : null}
            </div>
            {result?.duration_ms != null && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{result.duration_ms}ms</span>
            )}
          </div>
        );
      })}

      {/* Approval inline */}
      {run.status === 'waiting_approval' && run.approval_prompt && (
        <div style={{
          margin: '8px 0 0', padding: 12,
          background: 'rgba(245, 158, 11, 0.08)', border: '1px solid var(--amber)',
          borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{run.approval_prompt}</div>
          {run.approval_preview && (
            <pre style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0, maxHeight: 100, overflow: 'auto', fontFamily: 'var(--font-mono)' }}>
              {JSON.stringify(run.approval_preview, null, 2)}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {onReject && (
              <button onClick={onReject} style={{ padding: '4px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                Reject
              </button>
            )}
            {onApprove && (
              <button onClick={onApprove} style={{ padding: '4px 10px', background: 'var(--success)', border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                Approve
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
