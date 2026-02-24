interface SettingSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingSection({ title, description, children }: SettingSectionProps) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3
        style={{
          fontSize: '0.9375rem',
          fontWeight: 600,
          color: 'var(--text)',
          margin: '0 0 4px 0',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            margin: '0 0 12px 0',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {description}
        </p>
      )}
      <div>{children}</div>
    </div>
  );
}
