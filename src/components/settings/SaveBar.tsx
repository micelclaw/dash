interface SaveBarProps {
  visible: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function SaveBar({ visible, saving, onSave, onDiscard }: SaveBarProps) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'rgba(212, 160, 23, 0.08)',
        borderTop: '1px solid var(--amber)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        fontFamily: 'var(--font-sans)',
        zIndex: 10,
      }}
    >
      <span style={{ fontSize: '0.8125rem', color: 'var(--amber)', fontWeight: 500 }}>
        Unsaved changes
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onDiscard}
          disabled={saving}
          style={{
            height: 32,
            padding: '0 16px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-dim)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          Discard
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            height: 32,
            padding: '0 16px',
            background: saving ? 'var(--text-muted)' : 'var(--amber)',
            color: '#06060a',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
