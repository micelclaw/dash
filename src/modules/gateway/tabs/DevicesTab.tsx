/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { RefreshCw, Check, X, Settings2, Monitor, Smartphone, Terminal, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as gwService from '@/services/gateway.service';

const PLATFORM_ICONS: Record<string, typeof Monitor> = {
  linux: Terminal,
  Win32: Monitor,
  darwin: Monitor,
  ios: Smartphone,
  android: Smartphone,
};

function formatTimestamp(ms: number | undefined): string {
  if (!ms) return 'Never';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function DevicesTab() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<gwService.PendingDevice[]>([]);
  const [paired, setPaired] = useState<gwService.PairedDevice[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const handleApprove = async (requestId: string) => {
    setActionLoading(`approve-${requestId}`);
    try {
      await gwService.approveDevice(requestId);
      toast.success('Device approved');
      fetchDevices();
    } catch { toast.error('Failed to approve device'); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (requestId: string) => {
    setActionLoading(`reject-${requestId}`);
    try {
      await gwService.rejectDevice(requestId);
      toast.success('Device rejected');
      fetchDevices();
    } catch { toast.error('Failed to reject device'); }
    finally { setActionLoading(null); }
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading devices...</div>;
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div style={{ padding: 20, maxWidth: 800 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            {paired.length} paired{pending.length > 0 ? `, ${pending.length} pending` : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/settings/devices')} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-dim)',
              fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
            }}>
              <Settings2 size={14} /> Manage in Settings
            </button>
            <button onClick={fetchDevices} style={{
              background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '6px 8px', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center',
            }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Pending */}
        {pending.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pending ({pending.length})
            </h3>
            {pending.map(dev => {
              const Icon = PLATFORM_ICONS[dev.platform] ?? Globe;
              return (
                <div key={dev.request_id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  background: '#f59e0b08', border: '1px solid #f59e0b25', borderRadius: 'var(--radius-md)', marginBottom: 4,
                }}>
                  <Icon size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>
                      {dev.display_name ?? dev.client_id}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginLeft: 6 }}>
                      {dev.platform} · {dev.role} · {formatTimestamp(dev.created_at_ms)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleApprove(dev.request_id)} disabled={!!actionLoading} style={{
                      display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px',
                      background: '#22c55e', border: 'none', borderRadius: 'var(--radius-sm)',
                      color: '#fff', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}>
                      <Check size={10} /> Approve
                    </button>
                    <button onClick={() => handleReject(dev.request_id)} disabled={!!actionLoading} style={{
                      display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px',
                      background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-dim)', fontSize: '0.6875rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}>
                      <X size={10} /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paired */}
        <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Paired ({paired.length})
        </h3>
        {paired.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No devices paired</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {paired.map(dev => {
              const Icon = PLATFORM_ICONS[dev.platform] ?? Globe;
              const tokenEntries = Object.entries(dev.tokens ?? {});
              const lastUsed = tokenEntries.reduce((max, [, t]) => Math.max(max, t.last_used_at_ms ?? 0), 0);
              return (
                <div key={dev.device_id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                }}>
                  <Icon size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>
                      {dev.display_name ?? dev.client_id}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginLeft: 6 }}>
                      {dev.platform} · {dev.client_mode}
                    </span>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {(dev.approved_scopes ?? dev.scopes).join(', ')}
                      {lastUsed > 0 && ` · Last used ${formatTimestamp(lastUsed)}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
