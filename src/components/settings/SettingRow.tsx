interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  horizontal?: boolean;
}

export function SettingRow({ label, description, children, horizontal }: SettingRowProps) {
  return (
    <div
      style={{
        display: horizontal ? 'flex' : 'block',
        alignItems: horizontal ? 'center' : undefined,
        justifyContent: horizontal ? 'space-between' : undefined,
        gap: horizontal ? 16 : 0,
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ flex: horizontal ? 1 : undefined, minWidth: 0 }}>
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
      <div style={{ marginTop: horizontal ? 0 : 8 }}>{children}</div>
    </div>
  );
}
