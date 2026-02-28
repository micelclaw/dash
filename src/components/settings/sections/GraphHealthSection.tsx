import { useEffect } from 'react';
import { Network, GitMerge, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useIntelligenceStore } from '@/stores/intelligence.store';
import { useAuthStore } from '@/stores/auth.store';
import { ProUpsellPanel } from '@/components/shared/ProUpsellPanel';

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

  useEffect(() => {
    if (!isPro) return;
    fetchStats();
    fetchCandidates();
  }, [isPro, fetchStats, fetchCandidates]);

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

  const handleCleanup = async () => {
    try {
      const result = await cleanupOrphans();
      toast.success(`Removed ${result.deleted_count} orphan entities`);
      fetchStats();
    } catch {
      toast.error('Cleanup failed');
    }
  };

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {candidates.slice(0, 20).map((c, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px',
                background: 'var(--surface)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8125rem',
              }}>
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
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--amber)', padding: 2, display: 'flex',
                  }}
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => handleDismiss(c.entity_a_id, c.entity_b_id)}
                  title="Dismiss"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 2, display: 'flex',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
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
    </div>
  );
}

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
