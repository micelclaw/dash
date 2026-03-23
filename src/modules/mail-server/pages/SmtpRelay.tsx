import { useState, useEffect } from 'react';
import { useRelayConfig } from '@micelclaw/mail-admin-ui';
import { RefreshCw, Info, Send, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface ProviderPreset {
  name: string;
  host: string;
  port: number;
  encryption: 'tls' | 'starttls' | 'none';
}

const PRESETS: ProviderPreset[] = [
  { name: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, encryption: 'starttls' },
  { name: 'Mailgun', host: 'smtp.mailgun.org', port: 587, encryption: 'starttls' },
  { name: 'Brevo', host: 'smtp-relay.brevo.com', port: 587, encryption: 'starttls' },
  { name: 'Amazon SES', host: 'email-smtp.us-east-1.amazonaws.com', port: 465, encryption: 'tls' },
];

export default function SmtpRelay() {
  const { available, config, loading, error, refetch, update, testRelay } = useRelayConfig();

  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState(587);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [encryption, setEncryption] = useState<'tls' | 'starttls' | 'none'>('starttls');
  const [provider, setProvider] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setHost(config.host || '');
      setPort(config.port || 587);
      setUsername(config.username || '');
      setPassword(config.password || '');
      setEncryption(config.encryption || 'starttls');
      setProvider(config.provider || '');
    }
  }, [config]);

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

  const applyPreset = (preset: ProviderPreset) => {
    setHost(preset.host);
    setPort(preset.port);
    setEncryption(preset.encryption);
    setProvider(preset.name);
    setEnabled(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await update({
        enabled, host, port, username, password, encryption,
        provider: provider || undefined,
      });
      toast.success('Configuración de relay guardada');
      refetch();
    } catch {
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await testRelay();
      toast.success('Conexión de relay verificada correctamente');
    } catch {
      toast.error('Error al probar la conexión de relay');
    } finally {
      setTesting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '8px 12px',
    color: 'var(--text)', fontSize: '0.8125rem', outline: 'none',
    fontFamily: 'var(--font-sans)', width: '100%',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)',
    marginBottom: 4, display: 'block',
  };

  return (
    <div style={{ padding: 24, maxWidth: 720, fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>
          SMTP Relay
        </h1>
        <button
          onClick={() => refetch()}
          style={{
            background: 'transparent', color: 'var(--text-dim)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            padding: '6px 14px', cursor: 'pointer', fontSize: '0.8125rem',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <RefreshCw size={14} />
        </button>
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

      {(config || !loading) && (
        <>
          {/* Mode selection */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 24,
          }}>
            <button
              onClick={() => setEnabled(false)}
              style={{
                flex: 1, padding: 16, borderRadius: 'var(--radius-md)',
                background: !enabled ? 'var(--surface)' : 'transparent',
                border: `1px solid ${!enabled ? 'var(--amber)' : 'var(--border)'}`,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Send size={14} style={{ color: !enabled ? 'var(--amber)' : 'var(--text-dim)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: !enabled ? 'var(--text)' : 'var(--text-dim)' }}>
                  Envío directo
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                El servidor envía correos directamente
              </span>
            </button>
            <button
              onClick={() => setEnabled(true)}
              style={{
                flex: 1, padding: 16, borderRadius: 'var(--radius-md)',
                background: enabled ? 'var(--surface)' : 'transparent',
                border: `1px solid ${enabled ? 'var(--amber)' : 'var(--border)'}`,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Zap size={14} style={{ color: enabled ? 'var(--amber)' : 'var(--text-dim)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: enabled ? 'var(--text)' : 'var(--text-dim)' }}>
                  Relay SMTP
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Enviar a través de un proveedor externo
              </span>
            </button>
          </div>

          {enabled && (
            <>
              {/* Provider presets */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                  Proveedores
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {PRESETS.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      style={{
                        padding: '10px 12px', borderRadius: 'var(--radius-md)',
                        background: provider === preset.name ? 'var(--surface)' : 'transparent',
                        border: `1px solid ${provider === preset.name ? 'var(--amber)' : 'var(--border)'}`,
                        cursor: 'pointer', textAlign: 'center',
                        fontSize: '0.8125rem', fontWeight: 500,
                        color: provider === preset.name ? 'var(--text)' : 'var(--text-dim)',
                      }}
                      onMouseEnter={e => { if (provider !== preset.name) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={e => { if (provider !== preset.name) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: 20,
                display: 'flex', flexDirection: 'column', gap: 16,
                marginBottom: 24,
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Host</label>
                    <input
                      value={host}
                      onChange={e => setHost(e.target.value)}
                      placeholder="smtp.example.com"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Puerto</label>
                    <input
                      type="number"
                      value={port}
                      onChange={e => setPort(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Usuario</label>
                    <input
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="apikey o usuario"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Contraseña</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Contraseña o API key"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Cifrado</label>
                  <select
                    value={encryption}
                    onChange={e => setEncryption(e.target.value as 'tls' | 'starttls' | 'none')}
                    style={{ ...inputStyle, cursor: 'pointer', width: 200 }}
                  >
                    <option value="tls">TLS (puerto 465)</option>
                    <option value="starttls">STARTTLS (puerto 587)</option>
                    <option value="none">Sin cifrado</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {enabled && (
              <button
                onClick={handleTest}
                disabled={testing}
                style={{
                  background: 'transparent', color: 'var(--text-dim)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  padding: '6px 14px', cursor: 'pointer', fontSize: '0.8125rem',
                  opacity: testing ? 0.6 : 1,
                }}
              >
                {testing ? 'Probando...' : 'Probar conexión'}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: 'var(--amber)', color: '#000', fontWeight: 600,
                border: 'none', borderRadius: 'var(--radius-md)',
                padding: '6px 14px', cursor: 'pointer', fontSize: '0.8125rem',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
