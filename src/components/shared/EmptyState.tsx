import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant: 'primary' | 'secondary';
  }>;
}

export function EmptyState({ icon: Icon, title, description, actions }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        maxWidth: 400,
        margin: '0 auto',
        padding: 32,
        textAlign: 'center',
        gap: 12,
      }}
    >
      <Icon size={48} style={{ color: 'var(--text-muted)' }} />
      <h3 style={{ fontSize: '1.125rem', fontWeight: 500, color: 'var(--text)', margin: 0 }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)', margin: 0, lineHeight: 1.5 }}>
          {description}
        </p>
      )}
      {actions && actions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                border: action.variant === 'primary' ? 'none' : '1px solid var(--border)',
                background: action.variant === 'primary' ? 'var(--amber)' : 'transparent',
                color: action.variant === 'primary' ? '#06060a' : 'var(--text-dim)',
                fontWeight: action.variant === 'primary' ? 600 : 400,
                transition: 'background var(--transition-fast)',
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
