import { useState } from 'react';
import { X, Download, Copy, Check, AlertTriangle } from 'lucide-react';
import type { VpnPeerConfig, VpnPeerUpdate } from '../hooks/use-vpn';

interface AddPeerDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, options?: Partial<VpnPeerUpdate>) => Promise<VpnPeerConfig | null>;
}

export function AddPeerDialog({ open, onClose, onAdd }: AddPeerDialogProps) {
  const [name, setName] = useState('');
  const [tunnelMode, setTunnelMode] = useState<'full' | 'split'>('full');
  const [keepalive, setKeepalive] = useState(25);
  const [usePsk, setUsePsk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<VpnPeerConfig | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    const config = await onAdd(name.trim(), {
      allowed_ips: tunnelMode === 'full' ? '0.0.0.0/0' : '10.13.13.0/24',
      persistent_keepalive: keepalive,
      preshared_key: usePsk ? 'generate' : undefined,
    });
    setSubmitting(false);
    if (config) setResult(config);
  };

  const handleClose = () => {
    setName('');
    setTunnelMode('full');
    setKeepalive(25);
    setUsePsk(false);
    setResult(null);
    setCopied(false);
    onClose();
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result.config_file], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.peer.name.replace(/\s+/g, '-')}.conf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.config_file);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.6)',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        width: result ? 520 : 420, maxHeight: '85vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            {result ? 'Peer Created' : 'Add VPN Peer'}
          </span>
          <button
            onClick={handleClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {!result ? (
            /* ─── Form ─── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)', display: 'block', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>
                  Peer Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Paco iPhone"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  autoFocus
                  style={{
                    width: '100%', height: 36, padding: '0 10px',
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                    fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Tunnel Mode */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)', display: 'block', marginBottom: 6, fontFamily: 'var(--font-sans)' }}>
                  Tunnel Mode
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <ToggleOption
                    selected={tunnelMode === 'full'}
                    onClick={() => setTunnelMode('full')}
                    label="Full Tunnel"
                    description="Route all traffic through VPN"
                  />
                  <ToggleOption
                    selected={tunnelMode === 'split'}
                    onClick={() => setTunnelMode('split')}
                    label="Split Tunnel"
                    description="Only VPN subnet traffic"
                  />
                </div>
              </div>

              {/* Keepalive */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)', display: 'block', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>
                  Persistent Keepalive (seconds)
                </label>
                <input
                  type="number"
                  value={keepalive}
                  onChange={(e) => setKeepalive(parseInt(e.target.value) || 0)}
                  min={0}
                  max={600}
                  style={{
                    width: 100, height: 32, padding: '0 8px',
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                    fontSize: '0.8125rem', fontFamily: 'var(--font-mono, monospace)', outline: 'none',
                  }}
                />
              </div>

              {/* PSK */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={usePsk} onChange={(e) => setUsePsk(e.target.checked)} />
                <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                  Pre-shared key (extra security)
                </span>
              </label>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || submitting}
                style={{
                  height: 36, padding: '0 20px',
                  background: name.trim() ? 'var(--amber)' : 'var(--surface-hover)',
                  color: name.trim() ? '#06060a' : 'var(--text-muted)',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem', fontWeight: 600, cursor: name.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {submitting ? 'Creating...' : 'Create Peer'}
              </button>
            </div>
          ) : (
            /* ─── Result ─── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Warning */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontFamily: 'var(--font-sans)' }}>
                  Save this configuration now — it cannot be retrieved later
                </span>
              </div>

              {/* QR Code */}
              {result.qr_code && (
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={`data:image/png;base64,${result.qr_code}`}
                    alt="WireGuard QR Code"
                    style={{
                      width: 200, height: 200,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      background: '#fff',
                      padding: 8,
                    }}
                  />
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-sans)' }}>
                    Scan with WireGuard mobile app
                  </div>
                </div>
              )}

              {/* Config */}
              <div style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: 12,
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.6875rem',
                color: 'var(--text)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                maxHeight: 200,
                overflow: 'auto',
              }}>
                {result.config_file}
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleDownload}
                  style={{
                    flex: 1, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: 'var(--amber)', color: '#06060a', border: 'none',
                    borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  <Download size={14} /> Download .conf
                </button>
                <button
                  onClick={handleCopy}
                  style={{
                    flex: 1, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: 'transparent', color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem',
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy config</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleOption({ selected, onClick, label, description }: {
  selected: boolean; onClick: () => void; label: string; description: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '8px 10px',
        background: selected ? 'rgba(212, 160, 23, 0.1)' : 'var(--bg)',
        border: `1px solid ${selected ? 'var(--amber)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <div style={{ fontSize: '0.75rem', fontWeight: 500, color: selected ? 'var(--amber)' : 'var(--text)', fontFamily: 'var(--font-sans)' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
        {description}
      </div>
    </button>
  );
}
