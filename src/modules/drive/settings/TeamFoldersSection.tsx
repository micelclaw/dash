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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FolderTree, Plus, RefreshCw, Trash2, UserPlus, X, AlertCircle, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ShareWithUserModal } from '../components/ShareWithUserModal';
import { formatFileSize } from '@/lib/file-utils';
import { timeAgo } from '@/lib/time';
import { api, ApiError } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse } from '@/types/api';
import type { FileRecord } from '@/types/files';

type TeamFolderStatus = 'pending' | 'scanning' | 'active' | 'error';

interface TeamFolder {
  id: string;
  owner_user_id: string;
  name: string;
  host_path: string;
  read_only: boolean;
  status: TeamFolderStatus;
  last_scanned_at: string | null;
  last_error: string | null;
  // Populated by the scan; absent on a freshly-created (pending) row.
  file_count?: number;
  total_bytes?: number;
  created_at: string;
}

const STATUS_META: Record<TeamFolderStatus, { label: string; color: string; pulse?: boolean }> = {
  pending: { label: 'Pending', color: 'var(--text-muted)' },
  scanning: { label: 'Scanning', color: 'var(--warning)', pulse: true },
  active: { label: 'Active', color: 'var(--success)' },
  error: { label: 'Error', color: 'var(--error)' },
};

/**
 * Drive Settings → Team Folders. Lets an admin/owner index a host directory
 * into the shared Drive (GET/POST/PATCH/DELETE /files/team-folders), rescan
 * it, toggle read-only, share it with a user, and remove it from the index
 * (host data untouched). Non-admins get an empty state.
 */
export function TeamFoldersSection() {
  const role = useAuthStore(s => s.user?.role);
  const isAdmin = role === 'admin' || role === 'owner';

  const [folders, setFolders] = useState<TeamFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [rescanning, setRescanning] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<TeamFolder | null>(null);
  const [shareFile, setShareFile] = useState<FileRecord | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get<ApiResponse<TeamFolder[]>>('/files/team-folders');
      setFolders(res.data);
    } catch {
      if (!silent) toast.error('Could not load team folders');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    void load();
  }, [isAdmin, load]);

  // Soft polling while any folder is still indexing.
  useEffect(() => {
    const busy = folders.some(f => f.status === 'scanning' || f.status === 'pending');
    if (busy && !pollRef.current) {
      pollRef.current = setInterval(() => { void load(true); }, 2000);
    } else if (!busy && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [folders, load]);

  const handleRescan = async (folder: TeamFolder) => {
    setRescanning(prev => new Set(prev).add(folder.id));
    try {
      await api.post(`/files/team-folders/${folder.id}/scan`);
      toast.success(`Rescanning "${folder.name}"`);
      await load(true);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      if (code === 'SCAN_IN_PROGRESS') toast.info('A scan is already in progress');
      else toast.error('Could not start scan');
    } finally {
      setRescanning(prev => { const next = new Set(prev); next.delete(folder.id); return next; });
    }
  };

  const handleToggleReadOnly = async (folder: TeamFolder) => {
    const next = !folder.read_only;
    // Optimistic.
    setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, read_only: next } : f));
    try {
      await api.patch(`/files/team-folders/${folder.id}`, { read_only: next });
    } catch {
      setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, read_only: folder.read_only } : f));
      toast.error('Could not update read-only');
    }
  };

  const handleDelete = async (folder: TeamFolder) => {
    try {
      await api.delete(`/files/team-folders/${folder.id}`);
      toast.success(`Removed "${folder.name}" from Drive`);
      setFolders(prev => prev.filter(f => f.id !== folder.id));
    } catch {
      toast.error('Could not remove team folder');
    }
  };

  // Locate the indexed root-directory row so it can be shared as a unit.
  const handleShare = async (folder: TeamFolder) => {
    try {
      const res = await api.get<ApiResponse<FileRecord[]>>('/files', {
        parent_folder: '/drive/',
        search: folder.name,
        no_cache: true,
      });
      const dir = res.data.find(r => r.is_directory && r.filename === folder.name);
      if (!dir) {
        toast.error('Could not find the folder in the index yet — rescan and retry');
        return;
      }
      setShareFile(dir);
    } catch {
      toast.error('Could not load the folder for sharing');
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 560 }}>
        <SectionHeader title="Team Folders" description="Index host directories into the shared Drive." />
        <EmptyState
          icon={ShieldAlert}
          title="Solo administradores"
          description="Solo los administradores pueden gestionar team folders."
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <SectionHeader
            title="Team Folders"
            description="Index an existing host directory into the shared Drive. The files stay on disk; Drive just tracks and serves them."
          />
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={primaryBtn}
        >
          <Plus size={14} /> Add team folder
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', padding: '16px 0' }}>Loading…</div>
      ) : folders.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No team folders yet"
          description="Add a host directory to make it available across the shared Drive."
          actions={[{ label: 'Add team folder', onClick: () => setShowAdd(true), variant: 'primary' }]}
        />
      ) : (
        <div style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          overflow: 'hidden', background: 'var(--card)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <Th>Name</Th>
                <Th>Host path</Th>
                <Th>Status</Th>
                <Th align="right">Files</Th>
                <Th align="right">Size</Th>
                <Th align="center">Read-only</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {folders.map(folder => {
                const meta = STATUS_META[folder.status];
                const isRescanning = rescanning.has(folder.id) || folder.status === 'scanning';
                return (
                  <tr key={folder.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <Td>
                      <span style={{ fontWeight: 500, color: 'var(--text)' }}>{folder.name}</span>
                    </Td>
                    <Td>
                      <span style={{
                        fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem',
                        color: 'var(--text-dim)',
                      }}>
                        {folder.host_path}
                      </span>
                    </Td>
                    <Td>
                      <span
                        title={folder.status === 'error' && folder.last_error ? folder.last_error : undefined}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          fontSize: '0.75rem', color: meta.color,
                        }}
                      >
                        <span
                          style={{
                            width: 7, height: 7, borderRadius: '50%', background: meta.color,
                            display: 'inline-block',
                            animation: meta.pulse ? 'tf-pulse 1.2s ease-in-out infinite' : undefined,
                          }}
                        />
                        {meta.label}
                        {folder.status === 'error' && <AlertCircle size={12} />}
                      </span>
                    </Td>
                    <Td align="right">{(folder.file_count ?? 0).toLocaleString()}</Td>
                    <Td align="right">{formatFileSize(folder.total_bytes ?? 0)}</Td>
                    <Td align="center">
                      <input
                        type="checkbox"
                        checked={folder.read_only}
                        onChange={() => { void handleToggleReadOnly(folder); }}
                        title="Read-only"
                        style={{ width: 15, height: 15, accentColor: 'var(--mod-drive)', cursor: 'pointer' }}
                      />
                    </Td>
                    <Td align="right">
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <IconBtn title="Share" onClick={() => { void handleShare(folder); }}>
                          <UserPlus size={14} />
                        </IconBtn>
                        <IconBtn
                          title="Rescan"
                          disabled={isRescanning}
                          onClick={() => { void handleRescan(folder); }}
                        >
                          <RefreshCw
                            size={14}
                            style={{ animation: isRescanning ? 'tf-spin 0.9s linear infinite' : undefined }}
                          />
                        </IconBtn>
                        <IconBtn title="Delete" danger onClick={() => setConfirmDelete(folder)}>
                          <Trash2 size={14} />
                        </IconBtn>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {folders.some(f => f.last_scanned_at) && (
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 8 }}>
          {folders
            .filter(f => f.last_scanned_at)
            .map(f => `${f.name}: scanned ${timeAgo(f.last_scanned_at!)}`)
            .join(' · ')}
        </div>
      )}

      {showAdd && (
        <AddTeamFolderModal
          onClose={() => setShowAdd(false)}
          onCreated={(folder) => {
            setFolders(prev => [folder, ...prev]);
            setShowAdd(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={`Remove "${confirmDelete?.name}"?`}
        description="This removes the folder from your Drive and its index entries. The files on the host folder are NOT deleted."
        confirmLabel="Remove"
        variant="danger"
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) void handleDelete(confirmDelete); }}
      />

      <ShareWithUserModal
        open={!!shareFile}
        files={shareFile ? [shareFile] : []}
        onClose={() => setShareFile(null)}
        onShared={() => setShareFile(null)}
      />

      <style>{`
        @keyframes tf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes tf-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}

/** Add-team-folder modal with inline server-error reporting. */
function AddTeamFolderModal({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: (folder: TeamFolder) => void;
}) {
  const [name, setName] = useState('');
  const [hostPath, setHostPath] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<ApiResponse<TeamFolder>>('/files/team-folders', {
        name: name.trim(),
        host_path: hostPath.trim(),
        read_only: readOnly,
      });
      toast.success(`Added "${res.data.name}"`);
      onCreated(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add team folder');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = name.trim().length > 0 && hostPath.trim().length > 0 && !submitting;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          width: 440, maxWidth: '92vw', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', fontFamily: 'var(--font-sans)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{
            margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <FolderTree size={15} style={{ color: 'var(--mod-drive)' }} />
            Add team folder
          </h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', padding: 2, display: 'flex',
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Name" hint="How the folder appears in the Drive">
            <input
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setError(null); }}
              placeholder="Marketing assets"
              style={inputStyle}
            />
          </Field>
          <Field label="Host path" hint="Absolute path of the directory on the host">
            <input
              value={hostPath}
              onChange={e => { setHostPath(e.target.value); setError(null); }}
              placeholder="/srv/shared/marketing"
              style={{ ...inputStyle, fontFamily: 'var(--font-mono, monospace)' }}
            />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={readOnly}
              onChange={e => setReadOnly(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: 'var(--mod-drive)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Read-only</span>
          </label>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              fontSize: '0.75rem', color: 'var(--error)',
              background: 'color-mix(in srgb, var(--error) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--error) 35%, transparent)',
              borderRadius: 'var(--radius-sm)', padding: '8px 10px',
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end',
          padding: '12px 20px', borderTop: '1px solid var(--border)',
        }}>
          <button onClick={onClose} style={{
            padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
            fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}>
            Cancel
          </button>
          <button
            onClick={() => { void handleCreate(); }}
            disabled={!canSubmit}
            style={{
              padding: '6px 14px',
              background: canSubmit ? 'var(--amber)' : 'var(--surface)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: canSubmit ? '#000' : 'var(--text-muted)',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)',
            }}
          >
            {submitting ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>{label}</div>
      {hint && <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{title}</h2>
      <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th style={{
      textAlign: align, padding: '9px 12px', fontSize: '0.6875rem', fontWeight: 600,
      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <td style={{ textAlign: align, padding: '9px 12px', color: 'var(--text)', verticalAlign: 'middle' }}>
      {children}
    </td>
  );
}

function IconBtn({
  children, title, onClick, disabled, danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)', background: 'transparent',
        color: danger ? 'var(--error)' : 'var(--text-dim)',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', background: 'var(--amber)', border: 'none',
  borderRadius: 'var(--radius-sm)', color: '#000', fontSize: '0.8125rem',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', padding: '7px 10px',
  fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-sans)', outline: 'none',
};
