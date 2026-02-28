import { Lock, X } from 'lucide-react';

interface ProUpsellModalProps {
  feature: string;
  description: string;
  onClose: () => void;
}

export function ProUpsellModal({ feature, description, onClose }: ProUpsellModalProps) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 500,
        }}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 380,
        maxWidth: '90vw',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 501,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={16} style={{ color: 'var(--amber)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              Pro Feature
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2 }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            {feature}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
            {description}
          </div>
          <button
            style={{
              padding: '8px 24px',
              background: 'var(--amber)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: '#000',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    </>
  );
}
