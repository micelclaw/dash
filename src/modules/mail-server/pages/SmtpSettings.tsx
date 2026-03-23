import { useRelayConfig } from '@micelclaw/mail-admin-ui';
import { useNavigate } from 'react-router';
import { Info, Server, Lock, Globe, ArrowRight, Send } from 'lucide-react';

const encryptionLabels: Record<string, string> = {
  tls: 'TLS', starttls: 'STARTTLS', none: 'Sin cifrado',
};

export default function SmtpSettings() {
  const { available, config, loading, error } = useRelayConfig();
  const navigate = useNavigate();

  if (!available) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: 24, display: 'flex',
          alignItems: 'center', gap: 12, color: 'var(--text-dim)', fontSize: '0.875rem',
        }}>
          <Info size={16} style={{ color: '#3b82f6' }} />
          Esta funcionalidad requiere Claw Core
        </div>
      </div>
    );
  }

  const infoItems = config ? [
    {
      icon: Send,
      label: 'Modo de envío',
      value: config.enabled ? 'Relay SMTP' : 'Envío directo',
      color: config.enabled ? '#8b5cf6' : '#22c55e',
    },
    ...(config.enabled ? [
      {
        icon: Server,
        label: 'Host',
        value: config.host ? `${config.host}:${config.port}` : 'No configurado',
        color: '#3b82f6',
      },
      {
        icon: Lock,
        label: 'Cifrado',
        value: encryptionLabels[config.encryption] || config.encryption,
        color: '#f97316',
      },
      ...(config.provider ? [{
        icon: Globe,
        label: 'Proveedor',
        value: config.provider,
        color: 'var(--amber)',
      }] : []),
    ] : []),
  ] : [];

  return (
    <div style={{ padding: 24, maxWidth: 720, fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>
          Configuración SMTP
        </h1>
      </div>

      {loading && !config && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: 32, textAlign: 'center' }}>
          Cargando configuración...
        </div>
      )}

      {error && (
        <div style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: 16 }}>
          Error: {String(error)}
        </div>
      )}

      {config && (
        <>
          {/* Info cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {infoItems.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.label} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: 16,
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius-md)',
                    background: `${typeof item.color === 'string' && item.color.startsWith('#') ? item.color : 'var(--amber)'}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={16} style={{ color: item.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
                      {item.value}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Username info if relay is enabled */}
          {config.enabled && config.username && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 24,
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                Usuario de autenticación
              </div>
              <div style={{
                fontSize: '0.8125rem', fontFamily: 'var(--font-mono)',
                color: 'var(--text)',
              }}>
                {config.username}
              </div>
            </div>
          )}

          {/* Link to SMTP Relay page */}
          <button
            onClick={() => navigate('/mail-server/delivery/relay')}
            style={{
              background: 'transparent', color: 'var(--text-dim)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              padding: '10px 16px', cursor: 'pointer', fontSize: '0.8125rem',
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', justifyContent: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Editar configuración de relay
            <ArrowRight size={14} />
          </button>
        </>
      )}
    </div>
  );
}
