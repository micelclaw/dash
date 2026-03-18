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

import { Fragment } from 'react';
import { ChevronRight, ChevronDown, Cpu, Disc3 } from 'lucide-react';
import { formatFileSize } from '@/lib/file-utils';
import { useStorageStore } from '@/stores/storage.store';
import type { Disk, Partition } from '../types';

const TYPE_CONFIG: Record<string, { icon: typeof Cpu; color: string; label: string }> = {
  ssd: { icon: Cpu, color: '#3b82f6', label: 'SSD' },
  hdd: { icon: Disc3, color: '#6b7280', label: 'HDD' },
  unknown: { icon: Disc3, color: '#6b7280', label: 'Disk' },
};

function MiniBar({ percent }: { percent: number }) {
  return (
    <div style={{ width: 50, height: 5, background: 'var(--card)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.min(percent, 100)}%`,
        background: percent > 90 ? '#f43f5e' : percent > 80 ? '#f97316' : 'var(--amber)',
        borderRadius: 3,
      }} />
    </div>
  );
}

function PartitionTable({ partitions }: { partitions: Partition[] }) {
  if (!partitions.length) {
    return <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 0 4px 28px' }}>No partitions</div>;
  }
  return (
    <div style={{ padding: '4px 0 8px 28px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'var(--font-sans)' }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Partition</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Mount</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>FS</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>Size</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>Used</th>
            <th style={{ padding: '4px 8px', width: 50 }} />
          </tr>
        </thead>
        <tbody>
          {partitions.map((p) => {
            const percent = p.used_bytes != null && p.size_bytes > 0 ? (p.used_bytes / p.size_bytes) * 100 : 0;
            return (
              <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '5px 8px', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>{p.id}</td>
                <td style={{ padding: '5px 8px', color: p.mount ? 'var(--text)' : 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>{p.mount ?? '—'}</td>
                <td style={{ padding: '5px 8px', color: 'var(--text-dim)' }}>{p.filesystem ?? '—'}</td>
                <td style={{ padding: '5px 8px', color: 'var(--text-dim)', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}>{formatFileSize(p.size_bytes)}</td>
                <td style={{ padding: '5px 8px', color: 'var(--text-dim)', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}>{p.used_bytes != null ? formatFileSize(p.used_bytes) : '—'}</td>
                <td style={{ padding: '5px 8px' }}>{p.used_bytes != null ? <MiniBar percent={percent} /> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DiskRow({ disk }: { disk: Disk }) {
  const expanded_disks = useStorageStore((s) => s.expanded_disks);
  const toggleDisk = useStorageStore((s) => s.toggleDisk);
  const smart_cache = useStorageStore((s) => s.smart_cache);
  const capabilities = useStorageStore((s) => s.capabilities);

  const isExpanded = expanded_disks.includes(disk.id);
  const cfg = TYPE_CONFIG[disk.type] || { icon: Disc3, color: '#6b7280', label: 'Disk' };
  const Icon = cfg.icon;
  const smart = smart_cache[disk.id];

  return (
    <Fragment>
      <div
        onClick={() => toggleDisk(disk.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
          cursor: 'pointer', borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {isExpanded ? <ChevronDown size={14} style={{ color: 'var(--text-dim)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />}
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', color: 'var(--text)' }}>{disk.device}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{disk.model}</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '1px 6px', background: `${cfg.color}18`, borderRadius: 'var(--radius-sm)',
          fontSize: '0.6875rem', color: cfg.color,
        }}>
          <Icon size={10} /> {cfg.label}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
          {formatFileSize(disk.size_bytes)}
        </span>
        {/* Inline SMART temp if expanded + available */}
        {isExpanded && capabilities?.can_get_smart && smart && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {smart.temperature_c != null ? `${smart.temperature_c}°C` : ''}
          </span>
        )}
      </div>
      {isExpanded && (
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <PartitionTable partitions={disk.partitions} />
        </div>
      )}
    </Fragment>
  );
}

export function DiskList() {
  const disks = useStorageStore((s) => s.disks);

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{
          fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
          fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Physical Disks
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
          {disks.length} {disks.length === 1 ? 'disk' : 'disks'}
        </span>
      </div>
      {disks.length === 0 ? (
        <div style={{ padding: '20px 14px', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          No disks detected
        </div>
      ) : (
        disks.map((disk) => <DiskRow key={disk.id} disk={disk} />)
      )}
    </div>
  );
}
