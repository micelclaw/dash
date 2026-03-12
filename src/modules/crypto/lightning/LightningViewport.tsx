import { Zap } from 'lucide-react';

export function Component() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-dim)' }}>
      <Zap size={32} style={{ color: '#f59e0b' }} />
      <span style={{ fontSize: 16, fontWeight: 500 }}>Lightning Management</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Coming soon — channel management, payments, and forwarding via CLNRest</span>
    </div>
  );
}
