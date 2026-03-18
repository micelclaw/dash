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
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStorageStore } from '@/stores/storage.store';
import type { ShareConfig } from '../types';

export function ShareSection() {
  const shares = useStorageStore((s) => s.shares);
  const createShare = useStorageStore((s) => s.createShare);
  const deleteShare = useStorageStore((s) => s.deleteShare);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [protocol, setProtocol] = useState<ShareConfig['protocol']>('smb');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canCreate = name.trim().length > 0 && path.trim().length > 0;

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createShare({ name: name.trim(), path: path.trim(), protocol });
      toast.success(`Share "${name}" created`);
      setShowCreate(false);
      setName('');
      setPath('');
    } catch {
      toast.error('Failed to create share');
    }
    setCreating(false);
  };

  const handleDelete = async (id: string, shareName: string) => {
    if (!confirm(`Delete share "${shareName}"?`)) return;
    setDeletingId(id);
    try {
      await deleteShare(id);
      toast.success(`Share "${shareName}" deleted`);
    } catch {
      toast.error('Failed to delete share');
    }
    setDeletingId(null);
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
          Shared Folders
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
          <Plus size={12} /> Create Share
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ padding: '14px', borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <input
              placeholder="Share name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                flex: '1 1 140px', padding: '7px 10px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', outline: 'none',
              }}
            />
            <input
              placeholder="/data/path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              style={{
                flex: '2 1 200px', padding: '7px 10px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono, monospace)', outline: 'none',
              }}
            />
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as ShareConfig['protocol'])}
              style={{
                flex: '0 0 160px', padding: '7px 10px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', outline: 'none',
              }}
            >
              <option value="smb">SMB (Windows/macOS)</option>
              <option value="nfs">NFS (Linux)</option>
            </select>
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
            }}>{creating ? 'Creating...' : 'Create Share'}</button>
          </div>
        </div>
      )}

      {/* Share list */}
      {shares.length === 0 && !showCreate ? (
        <div style={{ padding: '20px 14px', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          No shared folders configured
        </div>
      ) : shares.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)' }}>
            <thead>
              <tr>
                {['Name', 'Protocol', 'Path', 'Status', ''].map((h) => (
                  <th key={h || 'actions'} style={{
                    textAlign: 'left', padding: '8px 12px', fontSize: '0.6875rem', fontWeight: 500,
                    color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
                    textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shares.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', color: 'var(--text)', fontWeight: 500 }}>{s.name}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      padding: '1px 6px', fontSize: '0.6875rem',
                      background: s.protocol === 'smb' ? '#3b82f618' : '#10b98118',
                      color: s.protocol === 'smb' ? '#3b82f6' : '#10b981',
                      borderRadius: 'var(--radius-sm)', textTransform: 'uppercase',
                      fontFamily: 'var(--font-mono, monospace)',
                    }}>{s.protocol}</span>
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>{s.path}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: s.enabled ? '#22c55e' : '#6b7280' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.enabled ? '#22c55e' : '#6b7280' }} />
                      {s.enabled ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      disabled={deletingId === s.id}
                      title="Delete share"
                      style={{
                        display: 'flex', alignItems: 'center', padding: 4,
                        background: 'transparent', border: 'none', color: 'var(--text-muted)',
                        cursor: 'pointer', opacity: deletingId === s.id ? 0.5 : 1,
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
