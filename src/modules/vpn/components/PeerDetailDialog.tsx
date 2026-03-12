/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { VpnPeer, VpnPeerUpdate } from '../hooks/use-vpn';

interface PeerDetailDialogProps {
  open: boolean;
  peer: VpnPeer | null;
  onClose: () => void;
  onSave: (peerId: string, update: VpnPeerUpdate) => Promise<void>;
}

export function PeerDetailDialog({ open, peer, onClose, onSave }: PeerDetailDialogProps) {
  const [name, setName] = useState('');
  const [allowedIps, setAllowedIps] = useState('');
  const [keepalive, setKeepalive] = useState(0);
  const [endpoint, setEndpoint] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (peer) {
      setName(peer.name);
      setAllowedIps(peer.allowed_ips);
      setKeepalive(0);
      setEndpoint('');
    }
  }, [peer]);

  if (!open || !peer) return null;

  const handleSave = async () => {
    setSaving(true);
    const update: VpnPeerUpdate = {};
    if (name !== peer.name) update.name = name;
    if (allowedIps !== peer.allowed_ips) update.allowed_ips = allowedIps;
    if (keepalive > 0) update.persistent_keepalive = keepalive;
    if (endpoint) update.endpoint = endpoint;

    if (Object.keys(update).length > 0) {
      await onSave(peer.id, update);
    }
    setSaving(false);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        width: 420,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            Edit Peer
          </span>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </FormField>

          <FormField label="Allowed IPs">
            <input
              value={allowedIps}
              onChange={(e) => setAllowedIps(e.target.value)}
              placeholder="0.0.0.0/0 or 10.13.13.0/24"
              style={{ ...inputStyle, fontFamily: 'var(--font-mono, monospace)' }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <SmallBtn label="Full tunnel" active={allowedIps === '0.0.0.0/0'} onClick={() => setAllowedIps('0.0.0.0/0')} />
              <SmallBtn label="Split tunnel" active={allowedIps.includes('10.13.13')} onClick={() => setAllowedIps('10.13.13.0/24')} />
            </div>
          </FormField>

          <FormField label="Persistent Keepalive (seconds)">
            <input
              type="number"
              value={keepalive}
              onChange={(e) => setKeepalive(parseInt(e.target.value) || 0)}
              min={0} max={600}
              style={{ ...inputStyle, width: 100, fontFamily: 'var(--font-mono, monospace)' }}
            />
          </FormField>

          <FormField label="Endpoint Override (optional)">
            <input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="IP:port or leave empty"
              style={{ ...inputStyle, fontFamily: 'var(--font-mono, monospace)' }}
            />
          </FormField>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1, height: 34,
                background: 'var(--amber)', color: '#06060a',
                border: 'none', borderRadius: 'var(--radius-sm)',
                fontSize: '0.8125rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onClose}
              style={{
                height: 34, padding: '0 16px',
                background: 'transparent', color: 'var(--text-dim)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 34, padding: '0 10px',
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)',
  fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', outline: 'none',
  boxSizing: 'border-box',
};

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)', display: 'block', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SmallBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 22, padding: '0 8px',
        background: active ? 'rgba(212, 160, 23, 0.15)' : 'transparent',
        border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        fontSize: '0.625rem', fontWeight: 500,
        color: active ? 'var(--amber)' : 'var(--text-muted)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {label}
    </button>
  );
}
