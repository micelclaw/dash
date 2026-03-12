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

import { useState, useEffect, useCallback } from 'react';
import { X, FolderOpen, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface AddLocalSourceDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AddLocalSourceDialog({ open, onClose, onCreated }: AddLocalSourceDialogProps) {
  const [name, setName] = useState('');
  const [fsPath, setFsPath] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) { setName(''); setFsPath(''); }
  }, [open]);

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const canCreate = name.trim().length > 0 && fsPath.trim().startsWith('/') && slug.length > 0;

  const handleCreate = useCallback(async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      await api.post('/vfs/mounts', {
        name: name.trim(),
        provider_type: 'local',
        mount_path: `/user/${slug}`,
        config: { rootPath: fsPath.trim() },
        read_only: false,
      });
      toast.success(`"${name.trim()}" added`);
      onCreated();
    } catch (err: any) {
      const code = err?.code;
      if (code === 'CONFLICT') {
        toast.error('A source with this name already exists');
      } else {
        toast.error(err?.message || 'Failed to create source');
      }
    } finally {
      setCreating(false);
    }
  }, [canCreate, name, slug, fsPath, onCreated]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal)' as any,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', width: 420, maxWidth: '90vw',
        fontFamily: 'var(--font-sans)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <FolderOpen size={16} style={{ color: 'var(--amber)', marginRight: 8 }} />
          <span style={{ flex: 1, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            Add Local Folder
          </span>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Documents"
              style={inputStyle}
              autoFocus
            />
          </div>

          <div>
            <label style={labelStyle}>Filesystem Path</label>
            <input
              type="text"
              value={fsPath}
              onChange={e => setFsPath(e.target.value)}
              placeholder="e.g. /home/victor/Documents"
              style={inputStyle}
            />
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
              Absolute path on the server filesystem
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
            <button
              onClick={handleCreate}
              disabled={!canCreate || creating}
              style={{
                ...createBtnStyle,
                opacity: (!canCreate || creating) ? 0.5 : 1,
                cursor: (!canCreate || creating) ? 'default' : 'pointer',
              }}
            >
              {creating && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
              Add Source
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--text-dim)',
  marginBottom: 4,
  fontFamily: 'var(--font-sans)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-mono)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '7px 14px',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-dim)',
  cursor: 'pointer',
};

const createBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 14px',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  background: 'var(--amber)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: '#000',
};
