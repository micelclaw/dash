interface SettingToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function SettingToggle({ label, description, checked, onChange, disabled }: SettingToggleProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {label}
        </div>
        {description && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginTop: 2,
              lineHeight: 1.4,
              fontFamily: 'var(--font-sans)',
            }}
          >
            {description}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          position: 'relative',
          width: 36,
          height: 20,
          borderRadius: 10,
          border: 'none',
          background: checked ? 'var(--amber)' : 'var(--surface)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s ease',
          flexShrink: 0,
          padding: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: checked ? '#06060a' : 'var(--text-dim)',
            transition: 'left 0.15s ease',
          }}
        />
      </button>
    </div>
  );
}
