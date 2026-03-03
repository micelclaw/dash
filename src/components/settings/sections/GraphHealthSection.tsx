import { useEffect, useState, useCallback } from 'react';
import { Network, GitMerge, Trash2, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useIntelligenceStore } from '@/stores/intelligence.store';
import { useAuthStore } from '@/stores/auth.store';
import { ProUpsellPanel } from '@/components/shared/ProUpsellPanel';

const MAX_VISIBLE = 20;

export function GraphHealthSection() {
  const isPro = useAuthStore(s => s.user?.tier === 'pro');
  const stats = useIntelligenceStore(s => s.graphStats);
  const statsLoading = useIntelligenceStore(s => s.graphStatsLoading);
  const fetchStats = useIntelligenceStore(s => s.fetchGraphStats);
  const candidates = useIntelligenceStore(s => s.mergeCandidates);
  const candidatesLoading = useIntelligenceStore(s => s.mergeCandidatesLoading);
  const fetchCandidates = useIntelligenceStore(s => s.fetchMergeCandidates);
  const mergeEntities = useIntelligenceStore(s => s.mergeEntities);
  const dismissMerge = useIntelligenceStore(s => s.dismissMerge);
  const cleanupOrphans = useIntelligenceStore(s => s.cleanupOrphans);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastClicked, setLastClicked] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (!isPro) return;
    fetchStats();
    fetchCandidates();
  }, [isPro, fetchStats, fetchCandidates]);

  // Clear selection when candidates change
  useEffect(() => {
    setSelected(new Set());
    setLastClicked(null);
  }, [candidates]);

  const visible = candidates.slice(0, MAX_VISIBLE);

  const handleRowClick = useCallback((index: number, e: React.MouseEvent) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (e.shiftKey && lastClicked !== null) {
        const from = Math.min(lastClicked, index);
        const to = Math.max(lastClicked, index);
        for (let i = from; i <= to; i++) next.add(i);
      } else {
        if (next.has(index)) next.delete(index);
        else next.add(index);
      }
      return next;
    });
    setLastClicked(index);
  }, [lastClicked]);

  const handleSelectAll = useCallback(() => {
    if (selected.size === visible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map((_, i) => i)));
    }
  }, [selected.size, visible.length]);

  if (!isPro) {
    return (
      <div style={{ padding: 16 }}>
        <ProUpsellPanel
          feature="Graph Health"
          description="Monitor and maintain your knowledge graph with merge suggestions and orphan cleanup."
        />
      </div>
    );
  }

  const handleMerge = async (keepId: string, mergeId: string) => {
    try {
      await mergeEntities(keepId, mergeId);
      toast.success('Entities merged');
      fetchStats();
    } catch {
      toast.error('Merge failed');
    }
  };

  const handleDismiss = async (aId: string, bId: string) => {
    try {
      await dismissMerge(aId, bId);
    } catch {
      toast.error('Dismiss failed');
    }
  };

  const handleBatchMerge = async (indices: number[]) => {
    if (indices.length === 0) return;
    setMerging(true);
    let merged = 0;
    let failed = 0;
    for (const i of indices) {
      const c = visible[i];
      if (!c) continue;
      try {
        await mergeEntities(c.entity_a_id, c.entity_b_id);
        merged++;
      } catch {
        failed++;
      }
    }
    setMerging(false);
    setSelected(new Set());
    toast.success(`Merged ${merged} pairs${failed ? `, ${failed} failed` : ''}`);
    fetchStats();
    fetchCandidates();
  };

  const handleMergeSelected = () => handleBatchMerge([...selected]);
  const handleMergeAll = () => handleBatchMerge(visible.map((_, i) => i));

  const handleCleanup = async () => {
    try {
      const result = await cleanupOrphans();
      toast.success(`Removed ${result.deleted_count} orphan entities`);
      fetchStats();
    } catch {
      toast.error('Cleanup failed');
    }
  };

  const allSelected = visible.length > 0 && selected.size === visible.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-sans)' }}>
      {/* Metric cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {statsLoading ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} style={{
              flex: '1 1 120px',
              height: 72,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              animation: 'pulse 1.5s ease infinite',
            }} />
          ))
        ) : stats && (
          <>
            <MetricCard label="Entities" value={stats.entities.total} icon={<Network size={14} />} />
            <MetricCard label="Connections" value={stats.connections.total} icon={<GitMerge size={14} />} />
            <MetricCard label="Merge candidates" value={stats.merge_candidates_count} color={stats.merge_candidates_count > 0 ? '#fbbf24' : undefined} />
            <MetricCard label="Orphans" value={stats.orphan_count} color={stats.orphan_count > 0 ? '#f43f5e' : undefined} />
          </>
        )}
      </div>

      {/* Merge candidates */}
      <div>
        <div style={{
          fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
        }}>
          Merge candidates
        </div>

        {candidatesLoading ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading...</div>
        ) : candidates.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No merge candidates found</div>
        ) : (
          <>
            {/* Toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 8, padding: '6px 10px',
              background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
            }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)',
                userSelect: 'none',
              }}>
                <Checkbox checked={allSelected} indeterminate={selected.size > 0 && !allSelected} onClick={handleSelectAll} disabled={merging} />
                Select all
              </label>
              <div style={{ flex: 1 }} />
              {merging && (
                <Loader2 size={14} style={{ color: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
              )}
              {selected.size > 0 && (
                <button
                  onClick={handleMergeSelected}
                  disabled={merging}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--amber)', background: 'transparent',
                    color: 'var(--amber)', fontSize: '0.75rem',
                    fontFamily: 'var(--font-sans)', cursor: merging ? 'wait' : 'pointer',
                    opacity: merging ? 0.5 : 1,
                  }}
                >
                  <GitMerge size={12} />
                  Merge selected ({selected.size})
                </button>
              )}
              <button
                onClick={handleMergeAll}
                disabled={merging}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--amber)',
                  color: '#06060a', fontSize: '0.75rem', fontWeight: 600,
                  fontFamily: 'var(--font-sans)', cursor: merging ? 'wait' : 'pointer',
                  opacity: merging ? 0.5 : 1,
                }}
              >
                <GitMerge size={12} />
                Merge all ({visible.length})
              </button>
            </div>

            {/* Candidate rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {visible.map((c, i) => {
                const isSelected = selected.has(i);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px',
                    background: isSelected ? 'rgba(212, 160, 23, 0.1)' : 'var(--surface)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                    onClick={(e) => {
                      // Don't toggle selection when clicking action buttons
                      if ((e.target as HTMLElement).closest('button')) return;
                      handleRowClick(i, e);
                    }}
                  >
                    <Checkbox checked={isSelected} onClick={(e) => handleRowClick(i, e)} disabled={merging} />
                    <span style={{ flex: 1, color: 'var(--text)' }}>
                      {c.entity_a_name}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>↔</span>
                    <span style={{ flex: 1, color: 'var(--text)' }}>
                      {c.entity_b_name}
                    </span>
                    <span style={{
                      fontSize: '0.625rem', fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                    }}>
                      {(c.name_similarity * 100).toFixed(0)}%
                    </span>
                    <button
                      onClick={() => handleMerge(c.entity_a_id, c.entity_b_id)}
                      title="Merge (keep first)"
                      disabled={merging}
                      style={{
                        background: 'none', border: 'none', cursor: merging ? 'wait' : 'pointer',
                        color: 'var(--amber)', padding: 2, display: 'flex',
                        opacity: merging ? 0.3 : 1,
                      }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => handleDismiss(c.entity_a_id, c.entity_b_id)}
                      title="Dismiss"
                      disabled={merging}
                      style={{
                        background: 'none', border: 'none', cursor: merging ? 'wait' : 'pointer',
                        color: 'var(--text-muted)', padding: 2, display: 'flex',
                        opacity: merging ? 0.3 : 1,
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Orphan cleanup */}
      {stats && stats.orphan_count > 0 && (
        <div>
          <div style={{
            fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
          }}>
            Orphan entities
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: '0.8125rem', color: 'var(--text-dim)',
          }}>
            <span>{stats.orphan_count} entities with no connections</span>
            <button
              onClick={handleCleanup}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--error)',
                background: 'transparent',
                color: 'var(--error)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={12} />
              Clean up
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Checkbox component ──────────────────────────────────────

function Checkbox({ checked, indeterminate, onClick, disabled }: {
  checked: boolean;
  indeterminate?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      style={{
        width: 16, height: 16,
        borderRadius: 3,
        border: `1.5px solid ${checked || indeterminate ? 'var(--amber)' : 'var(--border)'}`,
        background: checked || indeterminate ? 'var(--amber)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
        transition: 'all 0.1s',
      }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5L4.5 7.5L8 3" stroke="#06060a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {indeterminate && !checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2.5 5H7.5" stroke="#06060a" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

// ─── MetricCard component ────────────────────────────────────

function MetricCard({ label, value, icon, color }: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  color?: string;
}) {
  return (
    <div style={{
      flex: '1 1 120px',
      padding: '12px 16px',
      background: 'var(--surface)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: '0.6875rem', color: 'var(--text-muted)',
        marginBottom: 4,
      }}>
        {icon}
        {label}
      </div>
      <div style={{
        fontSize: '1.25rem',
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        color: color ?? 'var(--text)',
      }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
