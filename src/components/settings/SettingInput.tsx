interface SettingInputProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'url';
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
}

export function SettingInput({
  label,
  description,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled,
  min,
  max,
}: SettingInputProps) {
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
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        style={{
          height: 32,
          padding: '0 10px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text)',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-sans)',
          outline: 'none',
          boxSizing: 'border-box',
          width: type === 'number' ? 80 : 200,
          cursor: disabled ? 'not-allowed' : undefined,
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
      />
    </div>
  );
}
