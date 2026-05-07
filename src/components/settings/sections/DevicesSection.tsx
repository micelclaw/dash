/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 *
 * ─── Idempotency contract (B7) ─────────────────────────────────────
 * May be mounted twice simultaneously: standalone at `/settings/devices`
 * and as a `<SettingsBlock>` inside Gateway (`/settings/gateway-auth`).
 * Each instance fetches and saves independently — no module-level
 * state, no shared refs. Lift to a store only if cross-instance sync
 * becomes a real requirement.
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Check, X, Trash2, RotateCcw, Ban, Copy, Monitor, Smartphone, Terminal, Globe } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';

const PLATFORM_ICONS: Record<string, typeof Monitor> = {
  linux: Terminal,
  Win32: Monitor,
  darwin: Monitor,
  ios: Smartphone,
  android: Smartphone,
};

const SCOPE_LABELS: Record<string, string> = {
  'operator.read': 'Read',
  'operator.write': 'Write',
  'operator.admin': 'Admin',
  'operator.approvals': 'Approvals',
  'operator.pairing': 'Pairing',
};

function formatTimestamp(ms: number | undefined): string {
  if (!ms) return 'Never';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function ScopeBadges({ scopes }: { scopes: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {scopes.map(s => (
        <span key={s} style={{
          padding: '1px 6px', fontSize: '0.625rem', fontWeight: 500,
          background: s.includes('admin') ? '#d4a01718' : '#22c55e18',
          color: s.includes('admin') ? 'var(--amber)' : '#22c55e',
          border: `1px solid ${s.includes('admin') ? '#d4a01730' : '#22c55e30'}`,
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-mono, var(--font-sans))',
        }}>
          {SCOPE_LABELS[s] ?? s.split('.').pop()}
        </span>
      ))}
    </div>
  );
}

export function DevicesSection() {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<gwService.PendingDevice[]>([]);
  const [paired, setPaired] = useState<gwService.PairedDevice[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rotatedToken, setRotatedToken] = useState<{ deviceId: string; role: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getDevices();
      setPending(data.pending ?? []);
      setPaired(data.paired ?? []);
    } catch {
      toast.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  // Poll for pending requests every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await gwService.getDevices();
        const newPending = data.pending ?? [];
        if (newPending.length > pending.length) {
          toast('New device pairing request', {
            description: `${newPending[0]?.platform ?? 'Unknown'} device wants to connect`,
            duration: Infinity, // Persistent until manually dismissed
            action: { label: 'View', onClick: () => {} },
          });
        }
        setPending(newPending);
        setPaired(data.paired ?? []);
      } catch { /* silent */ }
    }, 30_000);
    return () => clearInterval(interval);
  }, [pending.length]);

  const handleApprove = async (requestId: string) => {
    setActionLoading(`approve-${requestId}`);
    try {
      await gwService.approveDevice(requestId);
      toast.success('Device approved');
      fetchDevices();
    } catch {
      toast.error('Failed to approve device');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setActionLoading(`reject-${requestId}`);
    try {
      await gwService.rejectDevice(requestId);
      toast.success('Device rejected');
      fetchDevices();
    } catch {
      toast.error('Failed to reject device');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (deviceId: string) => {
    if (!confirm('Remove this device? It will need to re-pair to connect again.')) return;
    setActionLoading(`remove-${deviceId}`);
    try {
      await gwService.removeDevice(deviceId);
      toast.success('Device removed');
      fetchDevices();
    } catch {
      toast.error('Failed to remove device');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRotate = async (deviceId: string, role: string) => {
    if (!confirm('Rotate this token? The current token will be invalidated. You must copy the new token immediately.')) return;
    setActionLoading(`rotate-${deviceId}`);
    try {
      const result = await gwService.rotateDeviceToken(deviceId, role);
      setRotatedToken({ deviceId, role, token: result.token });
      setCopied(false);
      toast.success('Token rotated — copy it now!');
      fetchDevices();
    } catch {
      toast.error('Failed to rotate token');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (deviceId: string, role: string) => {
    if (!confirm('Revoke this token? The device will lose access for this role.')) return;
    setActionLoading(`revoke-${deviceId}`);
    try {
      await gwService.revokeDeviceToken(deviceId, role);
      toast.success('Token revoked');
      fetchDevices();
    } catch {
      toast.error('Failed to revoke token');
    } finally {
      setActionLoading(null);
    }
  };

  const copyToken = () => {
    if (rotatedToken) {
      navigator.clipboard.writeText(rotatedToken.token);
      setCopied(true);
      toast.success('Token copied to clipboard');
    }
  };

  if (loading) return <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading devices...</div>;

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>Devices</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            Manage devices that can connect to your Gateway. {paired.length} paired, {pending.length} pending.
          </p>
        </div>
        <button onClick={fetchDevices} style={{
          background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          padding: '6px 8px', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center',
        }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Token rotation modal */}
      {rotatedToken && (
        <div style={{
          padding: 16, marginBottom: 16, background: '#d4a01710', border: '1px solid var(--amber-dim)',
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--amber)', marginBottom: 8 }}>
            New token generated — copy it now!
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 8 }}>
            This token will NOT be shown again. Store it securely.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{
              flex: 1, padding: '8px 10px', fontSize: '0.6875rem',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all',
            }}>
              {rotatedToken.token}
            </code>
            <button onClick={copyToken} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
              background: copied ? '#22c55e' : 'var(--amber)', border: 'none',
              borderRadius: 'var(--radius-sm)', color: copied ? '#fff' : '#000',
              fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0,
            }}>
              <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button onClick={() => setRotatedToken(null)} style={{
            marginTop: 8, fontSize: '0.6875rem', color: 'var(--text-dim)', background: 'none',
            border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textDecoration: 'underline',
          }}>
            I've saved the token — dismiss
          </button>
        </div>
      )}

      {/* Pending requests */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#f59e0b', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending Requests ({pending.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pending.map(dev => {
              const Icon = PLATFORM_ICONS[dev.platform] ?? Globe;
              return (
                <div key={dev.request_id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  background: '#f59e0b08', border: '1px solid #f59e0b25',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <Icon size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
                      {dev.display_name ?? dev.client_id} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>({dev.platform})</span>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 2 }}>
                      Role: {dev.role} — {formatTimestamp(dev.created_at_ms)}
                    </div>
                    <ScopeBadges scopes={dev.scopes} />
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleApprove(dev.request_id)} disabled={!!actionLoading} style={{
                      display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px',
                      background: '#22c55e', border: 'none', borderRadius: 'var(--radius-sm)',
                      color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}>
                      <Check size={12} /> Approve
                    </button>
                    <button onClick={() => handleReject(dev.request_id)} disabled={!!actionLoading} style={{
                      display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px',
                      background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}>
                      <X size={12} /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Paired devices */}
      <div>
        <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Paired Devices ({paired.length})
        </h3>
        {paired.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No devices paired yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {paired.map(dev => {
              const Icon = PLATFORM_ICONS[dev.platform] ?? Globe;
              const tokenEntries = Object.entries(dev.tokens ?? {});
              return (
                <div key={dev.device_id} style={{
                  padding: '12px 14px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Icon size={18} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
                        {dev.display_name ?? dev.client_id}
                        <span style={{ color: 'var(--text-dim)', fontWeight: 400, marginLeft: 6 }}>({dev.platform})</span>
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 2 }}>
                        Mode: {dev.client_mode} — Paired {formatTimestamp(dev.approved_at_ms)}
                      </div>
                      <ScopeBadges scopes={dev.approved_scopes ?? dev.scopes} />
                    </div>
                    <button onClick={() => handleRemove(dev.device_id)} title="Remove device"
                      disabled={!!actionLoading} style={{
                        background: 'none', border: '1px solid transparent', borderRadius: 'var(--radius-sm)',
                        padding: 4, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
                      }}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Token management per role */}
                  {tokenEntries.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                      {tokenEntries.map(([role, tokenInfo]) => (
                        <div key={role} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text)', fontWeight: 500 }}>
                              Token: {role}
                            </span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                              {tokenInfo.rotated_at_ms ? `Rotated ${formatTimestamp(tokenInfo.rotated_at_ms)}` : `Created ${formatTimestamp(tokenInfo.created_at_ms)}`}
                              {tokenInfo.last_used_at_ms ? ` · Last used ${formatTimestamp(tokenInfo.last_used_at_ms)}` : ''}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => handleRotate(dev.device_id, role)} disabled={!!actionLoading} title="Rotate token" style={{
                              background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                              padding: '3px 8px', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 3,
                              fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
                            }}>
                              <RotateCcw size={10} /> Rotate
                            </button>
                            <button onClick={() => handleRevoke(dev.device_id, role)} disabled={!!actionLoading} title="Revoke token" style={{
                              background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                              padding: '3px 8px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 3,
                              fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
                            }}>
                              <Ban size={10} /> Revoke
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Device ID (truncated) */}
                  <div style={{ marginTop: 6, fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                    ID: {dev.device_id.slice(0, 16)}...
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
