import { useEffect, useRef } from 'react';
import { Copy, Trash2, ClipboardX } from 'lucide-react';
import { toast } from 'sonner';
import { useClipboardStore } from '@/stores/clipboard.store';

interface ClipboardPanelProps {
  open: boolean;
  onClose: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ClipboardPanel({ open, onClose }: ClipboardPanelProps) {
  const entries = useClipboardStore((s) => s.entries);
  const loading = useClipboardStore((s) => s.loading);
  const copyToClipboard = useClipboardStore((s) => s.copyToClipboard);
  const deleteEntry = useClipboardStore((s) => s.deleteEntry);
  const clearAll = useClipboardStore((s) => s.clearAll);
  const ref = useRef<HTMLDivElement>(null);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async (id: string) => {
    await copyToClipboard(id);
    toast.success('Copied to clipboard');
  };

  const handleClearAll = async () => {
    await clearAll();
    toast.success('Clipboard cleared');
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 4,
        width: 340,
        maxHeight: 420,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 'var(--z-dropdown)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
          Portapapeles
        </span>
        {entries.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); handleClearAll(); }}
            style={{
              fontSize: '0.6875rem',
              color: 'var(--amber)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-sans)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ClipboardX size={12} /> Clear all
          </button>
        )}
      </div>

      {/* Items */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && entries.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)' }}>
            Loading...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)' }}>
            No clipboard entries
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                gap: 8,
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-sans)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}>
                  {entry.content.slice(0, 120)}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                    {timeAgo(entry.createdAt)}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                    {entry.source}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopy(entry.id); }}
                  title="Copy"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', borderRadius: 'var(--radius-sm)' }}
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteEntry(entry.id); }}
                  title="Delete"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', borderRadius: 'var(--radius-sm)' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
