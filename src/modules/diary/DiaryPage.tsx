import { BookOpen } from 'lucide-react';

export function Component() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
      <BookOpen size={48} style={{ color: 'var(--mod-diary)' }} />
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Diary</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Coming in Phase 9</p>
    </div>
  );
}
