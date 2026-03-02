import { Clipboard } from 'lucide-react';
import { useClipboardStore } from '@/stores/clipboard.store';
import { ClipboardPanel } from './ClipboardPanel';

export function ClipboardButton() {
  const panelOpen = useClipboardStore((s) => s.panelOpen);
  const togglePanel = useClipboardStore((s) => s.togglePanel);
  const count = useClipboardStore((s) => s.entries.length);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); togglePanel(); }}
        title="Clipboard"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: panelOpen ? 'var(--amber)' : 'var(--text-dim)',
          padding: 6,
          display: 'flex',
          borderRadius: 'var(--radius-md)',
          transition: 'background var(--transition-fast)',
          position: 'relative',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <Clipboard size={18} />
        {count > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--amber)',
              color: '#06060a',
              fontSize: '0.5625rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-full)',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      <ClipboardPanel open={panelOpen} onClose={() => useClipboardStore.getState().setPanelOpen(false)} />
    </div>
  );
}
