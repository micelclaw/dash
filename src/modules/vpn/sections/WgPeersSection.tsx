import { useState } from 'react';
import { Plus, Trash2, QrCode, Download, Power, Copy, Check, X, AlertTriangle } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { WgClient } from '../hooks/use-wg-clients';

interface WgPeersSectionProps {
  clients: WgClient[];
  loading: boolean;
  endpointChanged: boolean;
  endpointReachable: boolean;
  endpointMethod: string;
  onDismissIpChange: () => Promise<void>;
  onCreate: (name: string) => Promise<WgClient | null>;
  onRemove: (id: string) => Promise<void>;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onGetConfig: (id: string) => Promise<string | null>;
  onGetQrCode: (id: string) => Promise<string | null>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

function peerStatus(client: WgClient): { label: string; color: string } {
  if (!client.enabled) return { label: 'Disabled', color: '#6b7280' };
  if (!client.latest_handshake_at) return { label: 'Waiting', color: '#6b7280' };
  const diff = Date.now() - new Date(client.latest_handshake_at).getTime();
  if (diff < 180_000) return { label: 'Online', color: '#22c55e' };
  if (diff < 900_000) return { label: 'Recent', color: '#f59e0b' };
  return { label: 'Offline', color: '#6b7280' };
}

export function WgPeersSection({
  clients, loading, endpointChanged, endpointReachable, endpointMethod, onDismissIpChange, onCreate, onRemove, onToggle, onRename, onGetConfig, onGetQrCode,
}: WgPeersSectionProps) {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [deletePeer, setDeletePeer] = useState<WgClient | null>(null);
  const [configModal, setConfigModal] = useState<{ client: WgClient; config: string } | null>(null);
  const [qrModal, setQrModal] = useState<{ client: WgClient; svg: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    await onCreate(newName.trim());
    setNewName('');
    setCreating(false);
    setShowAdd(false);
  };

  const handleShowConfig = async (client: WgClient) => {
    const config = await onGetConfig(client.id);
    if (config) setConfigModal({ client, config });
  };

  const handleShowQr = async (client: WgClient) => {
    const svg = await onGetQrCode(client.id);
    if (svg) setQrModal({ client, svg });
  };

  const handleCopyConfig = () => {
    if (!configModal) return;
    navigator.clipboard.writeText(configModal.config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadConfig = () => {
    if (!configModal) return;
    const blob = new Blob([configModal.config], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${configModal.client.name.replace(/\s+/g, '-')}.conf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Loading peers...
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', margin: 0, fontFamily: 'var(--font-sans)' }}>
          Peers ({clients.length})
        </h2>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', background: 'var(--amber)', color: '#06060a',
            border: 'none', borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Plus size={14} /> New Peer
        </button>
      </div>

      {/* IP changed warning */}
      {endpointChanged && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', marginBottom: 16,
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid var(--amber, #f59e0b)',
          borderRadius: 'var(--radius-md)',
          color: '#f59e0b',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-sans)',
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            Your public IP has changed. Re-scan the QR code on your devices to update the VPN connection.
          </span>
          <button
            onClick={onDismissIpChange}
            title="Dismiss"
            style={{
              padding: '4px', background: 'transparent', border: 'none',
              color: '#f59e0b', cursor: 'pointer', display: 'flex', flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Endpoint unreachable warning */}
      {!endpointReachable && endpointMethod === 'none' && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 16px', marginBottom: 16,
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.5,
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, color: '#ef4444', marginTop: 1 }} />
          <div style={{ color: 'var(--text-dim)' }}>
            <strong style={{ color: '#ef4444' }}>WireGuard is not reachable from the internet.</strong>
            <br />
            Your router does not support UPnP or port 51820/UDP is blocked.
            <br />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Use <strong>Tailscale</strong> for zero-config remote access, or open port 51820/UDP on your router manually.
            </span>
          </div>
        </div>
      )}

      {/* Add peer inline form */}
      {showAdd && (
        <div style={{
          padding: 16, marginBottom: 16,
          border: '1px solid var(--amber)', borderRadius: 'var(--radius-md)',
          background: 'var(--surface)', display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Peer name (e.g. iPhone, Laptop)"
            style={{
              flex: 1, padding: '8px 12px',
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', outline: 'none',
            }}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            style={{
              padding: '8px 20px', background: 'var(--amber)', color: '#06060a',
              border: 'none', borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)', opacity: creating || !newName.trim() ? 0.5 : 1,
            }}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
          <button
            onClick={() => { setShowAdd(false); setNewName(''); }}
            style={{
              padding: '6px', background: 'transparent', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer', display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Peer list */}
      {clients.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center',
          border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)',
          color: 'var(--text-muted)', fontSize: '0.875rem',
        }}>
          No peers configured. Click "New Peer" to add one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {clients.map((client) => {
            const status = peerStatus(client);
            return (
              <div
                key={client.id}
                style={{
                  padding: '14px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex', alignItems: 'center', gap: 12,
                  opacity: client.enabled ? 1 : 0.6,
                }}
              >
                {/* Status dot */}
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: status.color, flexShrink: 0,
                }} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {client.name}
                    </span>
                    <span style={{
                      fontSize: '0.6875rem', color: status.color, fontWeight: 500,
                    }}>
                      {status.label}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', gap: 16, marginTop: 4,
                    fontSize: '0.75rem', color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}>
                    <span>{client.address}</span>
                    <span>Handshake: {timeAgo(client.latest_handshake_at)}</span>
                    <span>↓ {formatBytes(client.transfer_rx)}</span>
                    <span>↑ {formatBytes(client.transfer_tx)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <IconButton title="Toggle" onClick={() => onToggle(client.id, !client.enabled)}>
                    <Power size={14} style={{ color: client.enabled ? '#22c55e' : '#6b7280' }} />
                  </IconButton>
                  <IconButton title="QR Code" onClick={() => handleShowQr(client)}>
                    <QrCode size={14} />
                  </IconButton>
                  <IconButton title="Download Config" onClick={() => handleShowConfig(client)}>
                    <Download size={14} />
                  </IconButton>
                  <IconButton title="Delete" onClick={() => setDeletePeer(client)}>
                    <Trash2 size={14} style={{ color: '#ef4444' }} />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deletePeer}
        onClose={() => setDeletePeer(null)}
        onConfirm={async () => {
          if (deletePeer) await onRemove(deletePeer.id);
          setDeletePeer(null);
        }}
        title="Delete Peer?"
        description={`This will permanently remove "${deletePeer?.name}" and revoke their VPN access.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Config modal */}
      {configModal && (
        <ModalOverlay onClose={() => { setConfigModal(null); setCopied(false); }}>
          <div style={{ width: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: 0, fontFamily: 'var(--font-sans)' }}>
                {configModal.client.name} — Config
              </h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleCopyConfig} style={actionBtnStyle}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button onClick={handleDownloadConfig} style={actionBtnStyle}>
                  <Download size={14} /> Download
                </button>
              </div>
            </div>
            <pre style={{
              padding: 16, background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', lineHeight: 1.6,
              color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)',
              overflow: 'auto', maxHeight: 400, margin: 0, whiteSpace: 'pre-wrap',
            }}>
              {configModal.config}
            </pre>
          </div>
        </ModalOverlay>
      )}

      {/* QR modal */}
      {qrModal && (
        <ModalOverlay onClose={() => setQrModal(null)}>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 16px', fontFamily: 'var(--font-sans)' }}>
              {qrModal.client.name} — QR Code
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
              Scan with the WireGuard app on your device
            </p>
            <div
              style={{
                display: 'inline-block', padding: 16, background: '#fff', borderRadius: 'var(--radius-md)',
              }}
              dangerouslySetInnerHTML={{ __html: qrModal.svg }}
            />
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

function IconButton({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        color: 'var(--text-dim)', transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.6)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: '90vw', maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '6px 12px', background: 'transparent',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 500,
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
