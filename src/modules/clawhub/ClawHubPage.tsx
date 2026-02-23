import { Puzzle } from 'lucide-react';

export function Component() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 16, textAlign: 'center', padding: 32,
    }}>
      <Puzzle size={48} style={{ color: 'var(--text-dim)' }} />
      <h2 style={{ fontSize: '1.125rem', fontWeight: 500, color: 'var(--text)', margin: 0, fontFamily: 'var(--font-sans)' }}>
        ClawHub
      </h2>
      <p style={{
        fontSize: '0.875rem', color: 'var(--text-dim)', margin: 0, maxWidth: 400,
        lineHeight: 1.5, fontFamily: 'var(--font-sans)',
      }}>
        Skill marketplace — install, manage, and publish skills for your agents.
        Available in Phase 11.
      </p>
    </div>
  );
}
