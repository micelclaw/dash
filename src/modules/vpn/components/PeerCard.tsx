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

import { useState } from 'react';
import {
  ChevronDown, ChevronRight, Smartphone, Monitor, Server,
  Copy, Check, Trash2, Eye, Power, Edit3,
} from 'lucide-react';
import type { VpnPeer } from '../hooks/use-vpn';

interface PeerCardProps {
  peer: VpnPeer;
  onEdit: () => void;
  onShowConfig: () => void;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
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

function getOnlineStatus(peer: VpnPeer): { label: string; color: string } {
  if (!peer.last_handshake) return { label: 'Offline', color: '#6b7280' };
  const diff = Date.now() - new Date(peer.last_handshake).getTime();
  if (diff < 180_000) return { label: 'Online', color: '#22c55e' };
  if (diff < 900_000) return { label: 'Recent', color: '#f59e0b' };
  return { label: 'Offline', color: '#6b7280' };
}

function getDeviceIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('phone') || lower.includes('iphone') || lower.includes('android') || lower.includes('móvil') || lower.includes('movil'))
    return Smartphone;
  if (lower.includes('server') || lower.includes('router') || lower.includes('nas'))
    return Server;
  return Monitor;
}

export function PeerCard({ peer, onEdit, onShowConfig, onToggle, onRemove }: PeerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const status = getOnlineStatus(peer);
  const DeviceIcon = getDeviceIcon(peer.name);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(peer.public_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        overflow: 'hidden',
        transition: 'border-color var(--transition-fast)',
        borderColor: hovered ? 'var(--border-hover, var(--border))' : 'var(--border)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px',
        cursor: 'pointer',
      }}
        onClick={() => setExpanded(!expanded)}
      >
        <DeviceIcon size={18} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
              {peer.name}
            </span>
            <span style={{
              fontSize: '0.6875rem', fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-muted)',
              background: 'var(--bg)',
              padding: '1px 6px', borderRadius: 'var(--radius-full)',
            }}>
              {peer.allowed_ips}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 3 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem' }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: status.color,
              }} />
              <span style={{ color: status.color }}>{status.label}</span>
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
              ↓ {formatBytes(peer.transfer_rx)}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
              ↑ {formatBytes(peer.transfer_tx)}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              Last: {timeAgo(peer.last_handshake)}
            </span>
          </div>
        </div>
        {expanded ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '12px 14px',
          background: 'var(--bg)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', marginBottom: 14 }}>
            <DetailRow label="Public Key">
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.6875rem' }}>
                {peer.public_key.slice(0, 20)}...
              </span>
              <button
                onClick={handleCopyKey}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: copied ? '#22c55e' : 'var(--text-muted)', padding: 2, display: 'flex',
                }}
                title="Copy full key"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </DetailRow>
            <DetailRow label="Allowed IPs">
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.6875rem' }}>
                {peer.allowed_ips}
              </span>
            </DetailRow>
            <DetailRow label="Transfer RX">
              <span style={{ fontSize: '0.6875rem' }}>{formatBytes(peer.transfer_rx)}</span>
            </DetailRow>
            <DetailRow label="Transfer TX">
              <span style={{ fontSize: '0.6875rem' }}>{formatBytes(peer.transfer_tx)}</span>
            </DetailRow>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <ActionBtn icon={Edit3} label="Edit" onClick={onEdit} />
            <ActionBtn icon={Eye} label="Config" onClick={onShowConfig} />
            <ActionBtn icon={Power} label={status.label === 'Offline' ? 'Enable' : 'Disable'} onClick={() => onToggle(status.label === 'Offline')} />
            <div style={{ flex: 1 }} />
            <ActionBtn icon={Trash2} label="Remove" onClick={onRemove} danger />
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', minWidth: 75, fontFamily: 'var(--font-sans)' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, danger }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        height: 26, padding: '0 8px',
        background: hovered ? (danger ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface-hover)') : 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        fontSize: '0.6875rem',
        color: danger ? '#ef4444' : 'var(--text-dim)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Icon size={11} />
      {label}
    </button>
  );
}
