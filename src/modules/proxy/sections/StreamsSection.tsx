import { Radio } from 'lucide-react';

export function StreamsSection() {
  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px', fontFamily: 'var(--font-sans)' }}>
        Streams (TCP/UDP)
      </h2>
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '48px 24px',
        textAlign: 'center',
      }}>
        <Radio size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
        <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', margin: '0 0 6px', fontWeight: 500 }}>
          TCP/UDP Stream Proxying
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 12px', maxWidth: 400, marginInline: 'auto', lineHeight: 1.5 }}>
          Proxy raw TCP and UDP traffic (databases, game servers, mail protocols) using Caddy's Layer 4 module.
          Requires building Caddy with xcaddy.
        </p>
        <span style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(107, 114, 128, 0.15)',
          color: '#6b7280',
          fontSize: '0.75rem',
          fontWeight: 600,
        }}>
          Coming Soon
        </span>
      </div>
    </div>
  );
}
