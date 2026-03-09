import { useSearchStore } from '@/stores/search.store';
import { useAuthStore } from '@/stores/auth.store';
import { RankingSlider } from './RankingSlider';
import { ProUpsellPanel } from '@/components/shared/ProUpsellPanel';

type SortBy = 'relevance' | 'fulltext' | 'heat' | 'semantic' | 'graph' | 'recent';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'fulltext', label: 'Full-text' },
  { value: 'heat', label: 'Heat' },
  { value: 'semantic', label: 'Semantic' },
  { value: 'graph', label: 'Graph' },
  { value: 'recent', label: 'Last modified' },
];

const radioStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: '0.8125rem',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
};

export function RankingPanel() {
  const isPro = useAuthStore(s => s.user?.tier === 'pro');
  const sortBy = useSearchStore(s => s.sortBy);
  const weights = useSearchStore(s => s.weights);
  const setSortBy = useSearchStore(s => s.setSortBy);
  const setWeights = useSearchStore(s => s.setWeights);
  const resetWeights = useSearchStore(s => s.resetWeights);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: 16,
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Sort by */}
      <div>
        <div style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}>
          Sort by
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SORT_OPTIONS.map(opt => {
            const disabled = !isPro && opt.value !== 'relevance';
            return (
              <label key={opt.value} style={{ ...radioStyle, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                <input
                  type="radio"
                  name="sortBy"
                  value={opt.value}
                  checked={sortBy === opt.value}
                  onChange={() => { if (!disabled) setSortBy(opt.value); }}
                  disabled={disabled}
                  style={{ accentColor: 'var(--amber)' }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </div>

      {/* Advanced weights */}
      <div>
        <div style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}>
          Advanced weights
        </div>
        {!isPro ? (
          <ProUpsellPanel
            feature="Advanced Search"
            description="Tune ranking weights to customize how results are scored."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <RankingSlider label="Full-text" value={weights.fulltext} onChange={v => setWeights({ fulltext: v })} color="#60a5fa" />
            <RankingSlider label="Semantic" value={weights.semantic} onChange={v => setWeights({ semantic: v })} color="#a78bfa" />
            <RankingSlider label="Heat" value={weights.heat} onChange={v => setWeights({ heat: v })} color="#f43f5e" />
            <RankingSlider label="Graph" value={weights.graph} onChange={v => setWeights({ graph: v })} color="#34d399" />

            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                onClick={resetWeights}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-dim)',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
