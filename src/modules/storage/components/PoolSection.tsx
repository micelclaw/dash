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
import { Plus, Trash2, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { formatFileSize } from '@/lib/file-utils';
import { useStorageStore } from '@/stores/storage.store';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import type { PoolConfig, StoragePool } from '../types';

const RAID_TYPES = [
  { value: 'raid1', label: 'RAID 1 (Mirror)', min: 2 },
  { value: 'raid5', label: 'RAID 5 (Stripe + Parity)', min: 3 },
  { value: 'raid6', label: 'RAID 6 (Double Parity)', min: 4 },
  { value: 'raid10', label: 'RAID 10 (Mirror + Stripe)', min: 4 },
] as const;

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  degraded: '#f97316',
  inactive: '#6b7280',
};

export function PoolSection() {
  const pools = useStorageStore((s) => s.pools);
  const disks = useStorageStore((s) => s.disks);
  const createPool = useStorageStore((s) => s.createPool);
  const deletePool = useStorageStore((s) => s.deletePool);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [raidType, setRaidType] = useState<PoolConfig['type']>('raid1');
  const [selectedDisks, setSelectedDisks] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<StoragePool | null>(null);
  const [deleting, setDeleting] = useState(false);

  const raidCfg = RAID_TYPES.find((r) => r.value === raidType)!;
  const canCreate = name.trim().length > 0 && selectedDisks.length >= raidCfg.min;

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createPool({ name: name.trim(), type: raidType, disk_ids: selectedDisks });
      toast.success(`Pool "${name}" created`);
      setShowCreate(false);
      setName('');
      setSelectedDisks([]);
    } catch {
      toast.error('Failed to create pool');
    }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePool(deleteTarget.id);
      toast.success(`Pool "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete pool');
    }
    setDeleting(false);
  };

  const toggleDiskSelection = (id: string) => {
    setSelectedDisks((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);
  };

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
          RAID Pools
        </span>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', background: 'var(--amber)', color: '#06060a',
            border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.6875rem',
            fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
          }}
        >
          <Plus size={12} /> Create Pool
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ padding: '14px', borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <input
              placeholder="Pool name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                flex: '1 1 160px', padding: '7px 10px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', outline: 'none',
              }}
            />
            <select
              value={raidType}
              onChange={(e) => setRaidType(e.target.value as PoolConfig['type'])}
              style={{
                flex: '1 1 200px', padding: '7px 10px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', outline: 'none',
              }}
            >
              {RAID_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label} (min {r.min} disks)</option>)}
            </select>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>
            Select disks (min {raidCfg.min}):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            {disks.map((d) => (
              <label key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
                cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-sans)',
              }}>
                <input
                  type="checkbox"
                  checked={selectedDisks.includes(d.id)}
                  onChange={() => toggleDiskSelection(d.id)}
                />
                <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{d.device}</span>
                <span style={{ color: 'var(--text-dim)' }}>{d.model}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{formatFileSize(d.size_bytes)}</span>
              </label>
            ))}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#f97316', fontFamily: 'var(--font-sans)', marginBottom: 10 }}>
            This operation will erase all data on the selected disks.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowCreate(false)} style={{
              padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={handleCreate} disabled={!canCreate || creating} style={{
              padding: '6px 12px', background: canCreate ? 'var(--amber)' : 'var(--surface)',
              color: canCreate ? '#06060a' : 'var(--text-muted)', border: 'none',
              borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)', cursor: canCreate ? 'pointer' : 'default',
            }}>{creating ? 'Creating...' : 'Create Pool'}</button>
          </div>
        </div>
      )}

      {/* Pool list */}
      {pools.length === 0 && !showCreate ? (
        <div style={{ padding: '20px 14px', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          No RAID pools configured
        </div>
      ) : (
        pools.map((pool) => {
          const percent = pool.size_bytes > 0 ? (pool.used_bytes / pool.size_bytes) * 100 : 0;
          const statusColor = STATUS_COLORS[pool.status] ?? '#6b7280';
          return (
            <div key={pool.id} style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Layers size={14} style={{ color: '#3b82f6' }} />
                <span style={{ fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{pool.name}</span>
                <span style={{
                  padding: '1px 6px', fontSize: '0.6875rem', background: 'var(--card)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
                  fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase',
                }}>{pool.type}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: statusColor }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor }} />
                  {pool.status}
                </span>
                <button
                  onClick={() => setDeleteTarget(pool)}
                  title="Delete pool"
                  style={{
                    marginLeft: 'auto', display: 'flex', alignItems: 'center', padding: 4,
                    background: 'transparent', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
                Capacity: {formatFileSize(pool.size_bytes)} ({formatFileSize(pool.used_bytes)} used, {percent.toFixed(0)}%)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginTop: 2 }}>
                Members: {pool.disks.join(', ')}
              </div>
            </div>
          );
        })
      )}

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        title={`Delete Pool: ${deleteTarget?.name ?? ''}`}
        itemName={deleteTarget?.name ?? ''}
        details={`This will permanently destroy the RAID array "${deleteTarget?.name}" (${deleteTarget?.type.toUpperCase()}, ${deleteTarget ? formatFileSize(deleteTarget.size_bytes) : ''}) and all data on it. This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
