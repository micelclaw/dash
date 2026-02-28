import {
  StickyNote, Calendar, Mail, Users, BookOpen,
  FolderOpen, MessageSquare,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { HeatBadge } from '@/components/shared/HeatBadge';
import { useSearchStore } from '@/stores/search.store';
import { ProvenanceBreakdown } from './ProvenanceBreakdown';
import type { SearchResult } from '@/types/search';
import type { LucideIcon } from 'lucide-react';

const DOMAIN_META: Record<string, { icon: LucideIcon; color: string; route: string; label: string }> = {
  note:         { icon: StickyNote,    color: 'var(--mod-notes)',    route: '/notes',    label: 'Note' },
  event:        { icon: Calendar,      color: 'var(--mod-calendar)', route: '/calendar', label: 'Event' },
  email:        { icon: Mail,          color: 'var(--mod-mail)',     route: '/mail',     label: 'Email' },
  contact:      { icon: Users,         color: 'var(--mod-contacts)', route: '/contacts', label: 'Contact' },
  diary:        { icon: BookOpen,      color: 'var(--mod-diary)',    route: '/diary',    label: 'Diary' },
  file:         { icon: FolderOpen,    color: 'var(--mod-drive)',    route: '/drive',    label: 'File' },
  conversation: { icon: MessageSquare, color: 'var(--mod-chat)',     route: '/chat',     label: 'Chat' },
};

function getTitle(r: SearchResult): string {
  const rec = r.record as Record<string, unknown> | null;
  if (!rec) return r.snippet.slice(0, 60);
  return (
    (rec.title as string) ||
    (rec.subject as string) ||
    (rec.display_name as string) ||
    (rec.filename as string) ||
    r.snippet.slice(0, 60)
  );
}

export function SearchResultsList() {
  const navigate = useNavigate();
  const results = useSearchStore(s => s.results);
  const selectedResult = useSearchStore(s => s.selectedResult);
  const setSelectedResult = useSearchStore(s => s.setSelectedResult);
  const loading = useSearchStore(s => s.loading);
  const total = useSearchStore(s => s.total);
  const queryTimeMs = useSearchStore(s => s.queryTimeMs);
  const searchType = useSearchStore(s => s.searchType);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            height: 48, background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
            animation: 'pulse 1.5s ease infinite',
          }} />
        ))}
      </div>
    );
  }

  if (results.length === 0) return null;

  return (
    <div>
      {/* Meta row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.6875rem', color: 'var(--text-muted)',
        fontFamily: 'var(--font-sans)', padding: '4px 0 8px',
      }}>
        <span>{total} result{total !== 1 ? 's' : ''}</span>
        {queryTimeMs != null && <span>in {queryTimeMs}ms</span>}
        {searchType && <span style={{ fontFamily: 'var(--font-mono)' }}>({searchType})</span>}
      </div>

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {results.map((r, i) => {
          const meta = DOMAIN_META[r.domain];
          const Icon = meta?.icon ?? StickyNote;
          const isSelected = selectedResult?.record_id === r.record_id && selectedResult?.domain === r.domain;
          const heatScore = r.provenance?.heat_score ?? (r.record as Record<string, unknown> | null)?.heat_score as number ?? 0;

          return (
            <div key={`${r.domain}-${r.record_id}-${i}`}>
              <button
                onClick={() => setSelectedResult(isSelected ? null : r)}
                onDoubleClick={() => {
                  if (meta?.route) navigate(`${meta.route}?id=${r.record_id}`);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 10px',
                  background: isSelected ? 'var(--surface-hover)' : 'transparent',
                  border: isSelected ? '1px solid var(--amber)' : '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={16} style={{ color: meta?.color ?? 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{
                  flex: 1, fontSize: '0.8125rem', color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {getTitle(r)}
                </span>
                <HeatBadge score={heatScore} />
                <span style={{
                  fontSize: '0.625rem', fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)', flexShrink: 0,
                }}>
                  {r.score.toFixed(4)}
                </span>
              </button>

              {/* Provenance breakdown when selected */}
              {isSelected && (
                <div style={{
                  padding: '8px 10px 12px 34px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{
                    fontSize: '0.75rem', color: 'var(--text-dim)',
                    marginBottom: 6, lineHeight: 1.4,
                  }}>
                    {r.snippet}
                  </div>
                  <ProvenanceBreakdown result={r} />
                  <button
                    onClick={() => { if (meta?.route) navigate(`${meta.route}?id=${r.record_id}`); }}
                    style={{
                      marginTop: 8,
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--amber)',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-sans)',
                      cursor: 'pointer',
                    }}
                  >
                    Open {meta?.label ?? r.domain}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
