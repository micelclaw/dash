import { X } from 'lucide-react';

const SHORTCUTS = [
  {
    category: 'Navigation',
    items: [
      { keys: 'Escape', desc: 'Close card detail / clear selection' },
      { keys: '/', desc: 'Focus search' },
      { keys: '?', desc: 'Toggle shortcuts help' },
    ],
  },
  {
    category: 'Views',
    items: [
      { keys: 'Alt+1', desc: 'Board view' },
      { keys: 'Alt+2', desc: 'Table view' },
      { keys: 'Alt+3', desc: 'Gantt view' },
      { keys: 'Alt+4', desc: 'Calendar view' },
      { keys: 'Alt+5', desc: 'Dashboard view' },
    ],
  },
  {
    category: 'Card Operations',
    items: [
      { keys: '1-4', desc: 'Set priority (1=urgent, 4=low)' },
      { keys: 'x', desc: 'Toggle multi-select' },
      { keys: 'Delete', desc: 'Delete selected card' },
    ],
  },
];

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(25px)' }} onClick={onClose} />
      <div style={{
        position: 'relative',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        width: '100%',
        maxWidth: 480,
        maxHeight: '70vh',
        overflow: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>Keyboard Shortcuts</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {SHORTCUTS.map((group) => (
            <div key={group.category} style={{ marginBottom: 16 }}>
              <div style={{
                color: 'var(--text-dim)',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
              }}>
                {group.category}
              </div>
              {group.items.map((item) => (
                <div
                  key={item.keys}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                  }}
                >
                  <span style={{ color: 'var(--text)', fontSize: 12 }}>{item.desc}</span>
                  <kbd style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 11,
                    color: 'var(--text-dim)',
                    fontFamily: 'var(--font-mono, monospace)',
                    minWidth: 28,
                    textAlign: 'center',
                  }}>
                    {item.keys}
                  </kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
