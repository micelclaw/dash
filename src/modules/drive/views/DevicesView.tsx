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
import { useNavigate } from 'react-router';
import {
  HardDrive, Cloud, Bot, Server, FolderOpen, MonitorSmartphone, Lock,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { api } from '@/services/api';
import type { VFSMount } from '@/modules/explorer/hooks/use-vfs';

const PROVIDER_ICONS: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  local: HardDrive,
  gdrive: Cloud,
  dropbox: Cloud,
  'agent-workspace': Bot,
};

const PROVIDER_LABELS: Record<string, string> = {
  local: 'Local volume',
  gdrive: 'Google Drive',
  dropbox: 'Dropbox',
  'agent-workspace': 'Agent workspace',
};

/**
 * Devices — the mounted volumes (GET /vfs/mounts) as cards, plus a
 * placeholder card for the future MiniMicel device sync.
 */
export function DevicesView() {
  const navigate = useNavigate();
  const [mounts, setMounts] = useState<VFSMount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void api.get<{ data: VFSMount[] }>('/vfs/mounts')
      .then(res => { if (!cancelled) setMounts(res.data); })
      .catch(() => { /* show empty state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (!loading && mounts.length === 0) {
    return (
      <EmptyState
        icon={Server}
        title="No mounted volumes"
        description="Add local or cloud storage from the File Explorer."
        actions={[{ label: 'Open File Explorer', onClick: () => navigate('/explorer'), variant: 'primary' }]}
      />
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16, fontFamily: 'var(--font-sans)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {mounts.map(mount => (
          <MountCard key={mount.id} mount={mount} onExplore={() => navigate('/explorer')} />
        ))}

        {/* MiniMicel teaser */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 14,
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border)',
            background: 'transparent',
            opacity: 0.6,
            cursor: 'not-allowed',
            minHeight: 120,
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <MonitorSmartphone size={22} style={{ color: 'var(--text-muted)' }} />
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontWeight: 500 }}>
            Sync your devices
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            MiniMicel — coming soon
          </div>
        </div>
      </div>
      {loading && (
        <div style={{ padding: '12px 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Loading…</div>
      )}
    </div>
  );
}

function MountCard({ mount, onExplore }: { mount: VFSMount; onExplore: () => void }) {
  const [hovered, setHovered] = useState(false);
  const Icon = PROVIDER_ICONS[mount.provider_type] ?? Server;
  const typeLabel = PROVIDER_LABELS[mount.provider_type] ?? mount.provider_type;
  const isActive = mount.status === 'active' || mount.status === 'connected' || mount.status === 'ok';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 14,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: hovered ? 'var(--surface-hover)' : 'var(--surface)',
        transition: 'background var(--transition-fast), box-shadow var(--transition-fast)',
        boxShadow: hovered ? 'var(--shadow-md)' : 'none',
        minHeight: 120,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34,
            borderRadius: 'var(--radius-sm)',
            background: 'color-mix(in srgb, var(--mod-drive) 15%, transparent)',
            flexShrink: 0,
          }}
        >
          <Icon size={17} style={{ color: 'var(--mod-drive)' }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {mount.name}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{typeLabel}</div>
        </div>
      </div>

      <div style={{
        fontSize: '0.6875rem', color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono, monospace)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {mount.mount_path}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
        {/* Status */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: isActive ? 'var(--success)' : 'var(--warning)',
            display: 'inline-block',
          }} />
          {mount.status}
        </span>

        {/* Read-only badge */}
        {mount.read_only && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: '0.625rem', color: 'var(--text-dim)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-full)',
            padding: '1px 7px',
          }}>
            <Lock size={9} />
            Read-only
          </span>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={onExplore}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-dim)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <FolderOpen size={12} />
          Explore
        </button>
      </div>
    </div>
  );
}
