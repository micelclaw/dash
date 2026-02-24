import { useEffect, useRef } from 'react';
import { Newspaper, Lightbulb, ChevronRight } from 'lucide-react';
import { useDigestStore, type DigestEntry } from '@/stores/digest.store';

const ALERT_COLORS: Record<string, string> = {
  SILENT: 'var(--text-muted)',
  NORMAL: 'var(--amber)',
  URGENT: '#ef4444',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function DigestItem({ entry }: { entry: DigestEntry }) {
  const color = ALERT_COLORS[entry.alert_level || 'SILENT'] || 'var(--text-muted)';
  const summary = entry.intelligent_summary || entry.raw_summary;

  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
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
      </div>
      <div style={{
        fontSize: '0.8125rem', color: 'var(--text)',
        fontFamily: 'var(--font-sans)', lineHeight: 1.5,
        paddingLeft: 14,
      }}>
        {summary}
      </div>
      {entry.action_suggested && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: '0.75rem', color: 'var(--amber)',
          fontFamily: 'var(--font-sans)', marginTop: 4,
          paddingLeft: 14,
        }}>
          <Lightbulb size={12} />
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
        background: 'var(--card)',
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
            <DigestItem key={entry.id} entry={entry} />
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
            // Navigate to settings/digest or future full history view
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
