interface SettingSelectProps {
  label: string;
  description?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SettingSelect({ label, description, value, options, onChange, disabled }: SettingSelectProps) {
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          height: 32,
          padding: '0 28px 0 10px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text)',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-sans)',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          minWidth: 140,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
