/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useState, useCallback } from 'react';
import { TestTube2, X, CheckCircle2, Circle, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface TestResult {
  step_id: string;
  status: string;     // 'ok', 'simulated', 'error'
  output_summary: string;
  duration_ms?: number;
  tokens_used?: number;
  error?: string;
  output?: unknown;
}

interface TestPanelProps {
  flowId: string;
  onClose: () => void;
}

export function TestPanel({ flowId, onClose }: TestPanelProps) {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const runTest = useCallback(async () => {
    setTesting(true);
    setResults(null);
    try {
      const res = await api.post<{ data: { steps: TestResult[]; total_duration_ms: number; total_tokens: number; cost_estimate: number } }>(`/flows/${flowId}/test`);
      setResults(res.data.steps ?? []);
      setTotalDuration(res.data.total_duration_ms ?? 0);
      setTotalTokens(res.data.total_tokens ?? 0);
      setTotalCost(res.data.cost_estimate ?? 0);
    } catch (err) {
      toast.error(`Test failed: ${(err as Error).message}`);
    } finally {
      setTesting(false);
    }
  }, [flowId]);

  return (
    <div style={{
      borderTop: '1px solid var(--border)', background: 'var(--surface)',
      maxHeight: 320, display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TestTube2 size={14} style={{ color: 'var(--mod-flows)' }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Step preview</span>
          <span style={{ fontSize: 9, color: 'var(--info)', background: 'rgba(56,189,248,0.1)', padding: '1px 4px', borderRadius: 3 }}>not executed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!testing && !results && (
            <button onClick={runTest} style={{ padding: '3px 10px', background: 'var(--mod-flows)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              Run test
            </button>
          )}
          {testing && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Testing...</span>}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px 12px' }}>
        {testing && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: 20 }}>
            Loading preview...
          </div>
        )}

        {!testing && results && (
          <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 8 }}>
            This is a static preview of the flow steps. Nothing was executed —
            real dry-run requires a Lobster spec change.
          </div>
        )}

        {results && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {results.map((r) => {
              const isSimulated = r.status === 'simulated';
              const isError = r.status === 'error';
              const isExpanded = expandedStep === r.step_id;

              return (
                <div key={r.step_id}>
                  <div
                    onClick={() => setExpandedStep(isExpanded ? null : r.step_id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', cursor: 'pointer' }}
                  >
                    {isError ? (
                      <XCircle size={12} style={{ color: 'var(--error)' }} />
                    ) : isSimulated ? (
                      <Circle size={12} style={{ color: 'var(--info)' }} />
                    ) : (
                      <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />
                    )}
                    <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>
                      Step {r.step_id}: {r.output_summary}
                    </span>
                    {isSimulated && <span style={{ fontSize: 9, color: 'var(--info)', background: 'rgba(56,189,248,0.1)', padding: '1px 4px', borderRadius: 3 }}>simulated</span>}
                    {r.tokens_used ? <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.tokens_used} tokens</span> : null}
                    {r.duration_ms != null && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.duration_ms}ms</span>}
                    {r.output ? (isExpanded ? <ChevronUp size={10} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={10} style={{ color: 'var(--text-muted)' }} />) : null}
                  </div>
                  {isExpanded && r.output && (
                    <pre style={{ fontSize: 10, color: 'var(--text-dim)', margin: '2px 0 6px 20px', padding: 8, background: 'var(--card)', borderRadius: 4, maxHeight: 120, overflow: 'auto', fontFamily: 'var(--font-mono)' }}>
                      {JSON.stringify(r.output, null, 2)}
                    </pre>
                  )}
                  {r.error && (
                    <div style={{ fontSize: 11, color: 'var(--error)', marginLeft: 20, marginBottom: 4 }}>{r.error}</div>
                  )}
                </div>
              );
            })}

            {/* Summary */}
            <div style={{ marginTop: 8, padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-dim)', display: 'flex', gap: 12 }}>
              <span>Duration: {totalDuration < 1000 ? `${totalDuration}ms` : `${(totalDuration / 1000).toFixed(1)}s`}</span>
              {totalTokens > 0 && <span>AI tokens: {totalTokens}</span>}
              {totalCost > 0 && <span>Cost: ~${totalCost.toFixed(4)} (approximate)</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
