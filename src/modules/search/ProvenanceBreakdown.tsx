import type { SearchResult } from '@/types/search';

interface ProvenanceBreakdownProps {
  result: SearchResult;
}

const SIGNALS = [
  { key: 'fulltext_score', label: 'Full-text', color: '#60a5fa' },
  { key: 'vector_score', label: 'Semantic', color: '#a78bfa' },
  { key: 'heat_score', label: 'Heat', color: '#f43f5e' },
  { key: 'graph_score', label: 'Graph', color: '#34d399' },
] as const;

export function ProvenanceBreakdown({ result }: ProvenanceBreakdownProps) {
  const prov = result.provenance;
  if (!prov) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        fontSize: '0.625rem',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontFamily: 'var(--font-sans)',
      }}>
        Signal breakdown
      </div>
      {SIGNALS.map(({ key, label, color }) => {
        const value = (prov as Record<string, number | null>)[key];
        const pct = value != null ? Math.min(Math.abs(value), 1) * 100 : 0;
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: '0.6875rem',
              color: 'var(--text-dim)',
              width: 56,
              flexShrink: 0,
              fontFamily: 'var(--font-sans)',
            }}>
              {label}
            </span>
            <div style={{
              flex: 1,
              height: 6,
              background: 'var(--surface)',
              borderRadius: 3,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: color,
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{
              fontSize: '0.625rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              width: 32,
              textAlign: 'right',
              flexShrink: 0,
            }}>
              {value != null ? (value * 100).toFixed(0) : '0'}
            </span>
          </div>
        );
      })}

      {/* RRF composite */}
      {prov.rrf_score != null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border)',
        }}>
          <span style={{
            fontSize: '0.6875rem', color: 'var(--text-dim)',
            width: 56, flexShrink: 0, fontFamily: 'var(--font-sans)',
          }}>
            RRF
          </span>
          <span style={{
            fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
            color: 'var(--amber)', fontWeight: 600,
          }}>
            {prov.rrf_score.toFixed(4)}
          </span>
        </div>
      )}
    </div>
  );
}
