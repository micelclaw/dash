import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Newspaper, Lightbulb, ChevronRight } from 'lucide-react';
import { useDigestStore, type DigestEntry } from '@/stores/digest.store';

const ALERT_COLORS: Record<string, string> = {
  SILENT: 'var(--text-muted)',
  NORMAL: 'var(--amber)',
  URGENT: '#ef4444',
};

const DOMAIN_ROUTE: Record<string, string> = {
  notes: '/notes',
  emails: '/mail',
  email: '/mail',
  events: '/calendar',
  event: '/calendar',
  contacts: '/contacts',
  contact: '/contacts',
  diary_entries: '/diary',
  diary: '/diary',
  files: '/drive',
  file: '/drive',
  photos: '/photos',
  bookmarks: '/bookmarks',
};

const DOMAIN_LABEL: Record<string, string> = {
  notes: 'Notes',
  emails: 'Mail',
  email: 'Mail',
  events: 'Calendar',
  event: 'Calendar',
  contacts: 'Contacts',
  contact: 'Contacts',
  diary_entries: 'Diary',
  diary: 'Diary',
  files: 'Drive',
  file: 'Drive',
  photos: 'Photos',
  bookmarks: 'Bookmarks',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface DigestItemProps {
  entry: DigestEntry;
  onNavigate: (path: string) => void;
  onClose: () => void;
}

function DigestItem({ entry, onNavigate, onClose }: DigestItemProps) {
  const color = ALERT_COLORS[entry.alert_level || 'SILENT'] || 'var(--text-muted)';
  const summary = entry.intelligent_summary || entry.raw_summary;

  const handleDomainClick = (domain: string) => {
    const route = DOMAIN_ROUTE[domain];
    if (route) {
      onClose();
      onNavigate(route);
    }
  };

  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Header: time + alert level + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: color, flexShrink: 0,
        }} />
        <span style={{
          fontSize: '0.75rem', color: 'var(--text-muted)',
          fontFamily: 'var(--font-sans)',
        }}>
          {formatTime(entry.delivered_at)}
        </span>
        <span style={{
          fontSize: '0.625rem', padding: '1px 6px',
          borderRadius: 'var(--radius-sm)',
          background: `${color}20`,
          color,
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {entry.alert_level || 'SILENT'}
        </span>
        {entry.changes_count > 0 && (
          <span style={{
            fontSize: '0.625rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-sans)',
          }}>
            {entry.changes_count} change{entry.changes_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Summary */}
      <div style={{
        fontSize: '0.8125rem', color: 'var(--text)',
        fontFamily: 'var(--font-sans)', lineHeight: 1.5,
        paddingLeft: 14,
      }}>
        {summary}
      </div>

      {/* Domain chips */}
      {entry.domains.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4,
          paddingLeft: 14, marginTop: 6,
        }}>
          {entry.domains.map((domain) => {
            const route = DOMAIN_ROUTE[domain];
            const label = DOMAIN_LABEL[domain] || domain.replace(/_/g, ' ');
            return (
              <button
                key={domain}
                onClick={route ? () => handleDomainClick(domain) : undefined}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 8px',
                  fontSize: '0.6875rem',
                  fontFamily: 'var(--font-sans)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 999,
                  color: route ? 'var(--amber)' : 'var(--text-muted)',
                  cursor: route ? 'pointer' : 'default',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (route) {
                    e.currentTarget.style.background = 'var(--card)';
                    e.currentTarget.style.borderColor = 'var(--amber)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                {label}
                {route && <ChevronRight size={10} />}
              </button>
            );
          })}
        </div>
      )}

      {/* Action suggested */}
      {entry.action_suggested && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 6,
          fontSize: '0.75rem', color: 'var(--amber)',
          fontFamily: 'var(--font-sans)', marginTop: 6,
          padding: '6px 12px 6px 14px',
          background: 'rgba(212, 160, 23, 0.06)',
          borderRadius: 'var(--radius-sm)',
          lineHeight: 1.4,
        }}>
          <Lightbulb size={12} style={{ flexShrink: 0, marginTop: 2 }} />
          {entry.action_suggested}
        </div>
      )}
    </div>
  );
}

export function BriefingPanel() {
  const panelOpen = useDigestStore((s) => s.panelOpen);
  const setPanelOpen = useDigestStore((s) => s.setPanelOpen);
  const todayDigests = useDigestStore((s) => s.todayDigests);
  const loading = useDigestStore((s) => s.loading);
  const fetchTodayHistory = useDigestStore((s) => s.fetchTodayHistory);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (panelOpen) {
      fetchTodayHistory();
    }
  }, [panelOpen, fetchTodayHistory]);

  // Click outside to close
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelOpen, setPanelOpen]);

  if (!panelOpen) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute', top: 44, right: 0,
        width: 360, maxHeight: 480,
        background: 'rgba(17, 17, 24, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 'var(--z-dropdown, 100)' as any,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <Newspaper size={16} style={{ color: 'var(--amber)' }} />
        <span style={{
          fontSize: '0.875rem', fontWeight: 600,
          color: 'var(--text)', fontFamily: 'var(--font-sans)',
        }}>
          Today's Briefing
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        {loading && todayDigests.length === 0 ? (
          <div style={{
            padding: '24px 0', textAlign: 'center',
            fontSize: '0.8125rem', color: 'var(--text-muted)',
            fontFamily: 'var(--font-sans)',
          }}>
            Loading...
          </div>
        ) : todayDigests.length === 0 ? (
          <div style={{
            padding: '24px 0', textAlign: 'center',
            fontSize: '0.8125rem', color: 'var(--text-muted)',
            fontFamily: 'var(--font-sans)',
          }}>
            No digests today yet.
          </div>
        ) : (
          todayDigests.map((entry) => (
            <DigestItem
              key={entry.id}
              entry={entry}
              onNavigate={navigate}
              onClose={() => setPanelOpen(false)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid var(--border)',
      }}>
        <button
          onClick={() => {
            setPanelOpen(false);
            navigate('/settings/digest');
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
            padding: '4px 0',
          }}
        >
          View full history
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
