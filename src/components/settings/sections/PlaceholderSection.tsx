import type { LucideIcon } from 'lucide-react';

interface PlaceholderSectionProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function PlaceholderSection({ icon: Icon, title, description }: PlaceholderSectionProps) {
  return (
    <div style={{
      padding: '40px 24px',
      textAlign: 'center',
      border: '1px dashed var(--border)',
      borderRadius: 'var(--radius-lg)',
      marginTop: 24,
    }}>
      <Icon size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
      <div style={{
        fontSize: '0.9375rem',
        fontWeight: 500,
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-sans)',
        marginBottom: 6,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: '0.8125rem',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-sans)',
        maxWidth: 360,
        margin: '0 auto',
        lineHeight: 1.5,
      }}>
        {description}
      </div>
    </div>
  );
}
