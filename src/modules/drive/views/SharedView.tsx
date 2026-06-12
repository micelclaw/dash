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
import { useNavigate } from 'react-router';
import { Users, Share2, Link2, Download, X, Copy as CopyIcon, KeyRound, Search, FolderOpen, Pencil, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs } from '@/components/shared/Tabs';
import { FileIcon } from '@/components/shared/FileIcon';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ContextMenu, type ContextMenuItem } from '@/components/shared/ContextMenu';
import { formatFileSize } from '@/lib/file-utils';
import { formatRelative } from '@/lib/date-helpers';
import { downloadFile } from '@/lib/file-download';
import { api } from '@/services/api';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { FileRecord } from '@/types/files';

type SharedSub = 'with-me' | 'by-me' | 'links';

/** Separator entry for the bespoke ContextMenu rows (P2). */
const menuSep = (): ContextMenuItem => ({ label: '', separator: true, onClick: () => {} });

interface UserShare {
  id: string;
  owner_id: string;
  shared_with_id: string;
  target_type: string;
  target_id: string;
  permission: 'view' | 'edit';
  created_at: string;
  revoked_at: string | null;
}

interface ShareLink {
  id: string;
  token: string;
  url: string;
  is_public: boolean;
  password_hash?: string | null;
  permissions: string[];
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number | null;
  created_at: string;
}

/**
 * Shared — three sub-views: shares received ("With me"), shares granted
 * ("By me", with permission change + revoke) and per-file public links.
 *
 * NOTE (documented gap): there is no global "all active public links"
 * endpoint in Core — links can only be listed per file via
 * GET /files/:id/shares, so the Links sub-view is search-then-inspect.
 */
export function SharedView() {
  const [sub, setSub] = useState<SharedSub>('with-me');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
        <Tabs
          variant="pills"
          tabs={[
            { id: 'with-me', label: 'With me', icon: Users },
            { id: 'by-me', label: 'By me', icon: Share2 },
            { id: 'links', label: 'Public links', icon: Link2 },
          ]}
          activeTab={sub}
          onChange={(id) => setSub(id as SharedSub)}
        />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {sub === 'with-me' && <WithMeSub />}
        {sub === 'by-me' && <ByMeSub />}
        {sub === 'links' && <LinksSub />}
      </div>
    </div>
  );
}

interface Recipient {
  id: string;
  display_name: string | null;
  email: string;
  avatar_path: string | null;
}

/**
 * D4 fix — id → user lookup for share rows. GET /shares/recipients lists every
 * other active user of the instance (it excludes only the CURRENT user), so
 * both `owner_id` (With me) and `shared_with_id` (By me) resolve here.
 */
function useUserLookup() {
  const [map, setMap] = useState<Record<string, Recipient>>({});

  useEffect(() => {
    let cancelled = false;
    void api.get<ApiResponse<Recipient[]>>('/shares/recipients')
      .then(res => {
        if (!cancelled) setMap(Object.fromEntries(res.data.map(r => [r.id, r])));
      })
      .catch(() => { /* fall back to truncated ids */ });
    return () => { cancelled = true; };
  }, []);

  return useCallback((id: string) => {
    const u = map[id];
    return u ? (u.display_name || u.email) : id.slice(0, 8);
  }, [map]);
}

/** Resolve file metadata for a list of shares (GET /files/:id supports shared access). */
function useShareFileMeta(shares: UserShare[]) {
  const [meta, setMeta] = useState<Record<string, FileRecord | null>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(shares.map(async (s) => {
        try {
          const res = await api.get<ApiResponse<FileRecord>>(`/files/${s.target_id}`);
          return [s.target_id, res.data] as const;
        } catch {
          return [s.target_id, null] as const;
        }
      }));
      if (!cancelled) setMeta(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [shares]);

  return meta;
}

// ─── With me ─────────────────────────────────────────────

function WithMeSub() {
  const [shares, setShares] = useState<UserShare[]>([]);
  const [loading, setLoading] = useState(true);
  const userName = useUserLookup();

  useEffect(() => {
    let cancelled = false;
    void api.get<ApiListResponse<UserShare>>('/shares/with-me', { target_type: 'file', limit: 100 })
      .then(res => { if (!cancelled) setShares(res.data); })
      .catch(() => { if (!cancelled) toast.error('Failed to load shares'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const meta = useShareFileMeta(shares);

  if (!loading && shares.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nothing shared with you"
        description="Files other users share with you will appear here."
      />
    );
  }

  return (
    <div style={{ padding: '12px 16px' }}>
      {loading && <Loading />}
      {shares.map(share => {
        const file = meta[share.target_id];
        // P2 — bespoke menu: shares received have no inspector/preview here,
        // so Download (when possible) + Copy file ID is what the row supports.
        const menuItems: ContextMenuItem[] = [
          ...(file && !file.is_directory ? [{
            label: 'Download', icon: Download,
            onClick: () => { void downloadFile(file.id, file.filename); },
          }] : []),
          {
            label: 'Copy file ID', icon: CopyIcon,
            onClick: () => {
              void navigator.clipboard.writeText(share.target_id);
              toast.success('File ID copied');
            },
          },
        ];
        return (
          <ContextMenu
            key={share.id}
            items={menuItems}
            trigger={
              <ShareRow>
                <FileIcon mime={file?.mime_type ?? ''} isDirectory={!!file?.is_directory} size="sm" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: '0.8125rem', color: 'var(--text)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {file === undefined ? '…' : file?.filename ?? 'Unavailable file'}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                    from {userName(share.owner_id)} · {formatRelative(new Date(share.created_at))}
                    {file ? ` · ${formatFileSize(file.size_bytes)}` : ''}
                  </div>
                </div>
                <PermissionBadge permission={share.permission} />
                {file && !file.is_directory && (
                  <IconButton
                    icon={Download}
                    title="Download"
                    onClick={() => { void downloadFile(file.id, file.filename); }}
                  />
                )}
              </ShareRow>
            }
          />
        );
      })}
    </div>
  );
}

// ─── By me ───────────────────────────────────────────────

function ByMeSub() {
  const navigate = useNavigate();
  const [shares, setShares] = useState<UserShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<UserShare | null>(null);
  const userName = useUserLookup();

  // P2 — "Open" jumps to My Drive (the current user OWNS these files).
  const openInMyDrive = useCallback((file: FileRecord) => {
    if (file.is_directory) {
      const path = file.filepath.endsWith('/') ? file.filepath : file.filepath + '/';
      navigate(`/drive?tab=my-drive&path=${encodeURIComponent(path)}`);
    } else {
      navigate(`/drive?tab=my-drive&id=${file.id}`);
    }
  }, [navigate]);

  const fetchShares = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiListResponse<UserShare>>('/shares/by-me', { target_type: 'file', limit: 100 });
      setShares(res.data);
    } catch {
      toast.error('Failed to load shares');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchShares();
  }, [fetchShares]);

  const meta = useShareFileMeta(shares);

  const changePermission = useCallback(async (share: UserShare, permission: 'view' | 'edit') => {
    try {
      await api.patch(`/shares/${share.id}`, { permission });
      setShares(prev => prev.map(s => s.id === share.id ? { ...s, permission } : s));
      toast.success(`Permission set to ${permission}`);
    } catch {
      toast.error('Could not update permission');
    }
  }, []);

  const handleRevoke = useCallback(async () => {
    const target = revokeTarget;
    setRevokeTarget(null);
    if (!target) return;
    try {
      await api.delete(`/shares/${target.id}`);
      setShares(prev => prev.filter(s => s.id !== target.id));
      toast.success('Share revoked');
    } catch {
      toast.error('Could not revoke share');
    }
  }, [revokeTarget]);

  if (!loading && shares.length === 0) {
    return (
      <EmptyState
        icon={Share2}
        title="You haven't shared anything"
        description="Share a file with another user from My Drive (right-click → Share → With user)."
      />
    );
  }

  return (
    <div style={{ padding: '12px 16px' }}>
      {loading && <Loading />}
      {shares.map(share => {
        const file = meta[share.target_id];
        const nextPermission: 'view' | 'edit' = share.permission === 'view' ? 'edit' : 'view';
        // P2 — bespoke menu: Open / Change permission / Revoke (existing handlers).
        const menuItems: ContextMenuItem[] = [
          ...(file ? [{
            label: 'Open in My Drive', icon: FolderOpen,
            onClick: () => openInMyDrive(file),
          }] : []),
          {
            label: `Change permission to ${nextPermission}`, icon: Pencil,
            onClick: () => { void changePermission(share, nextPermission); },
          },
          menuSep(),
          {
            label: 'Revoke share', icon: X, variant: 'danger' as const,
            onClick: () => setRevokeTarget(share),
          },
        ];
        return (
          <ContextMenu
            key={share.id}
            items={menuItems}
            trigger={
              <ShareRow>
                <FileIcon mime={file?.mime_type ?? ''} isDirectory={!!file?.is_directory} size="sm" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: '0.8125rem', color: 'var(--text)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {file === undefined ? '…' : file?.filename ?? 'Unavailable file'}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                    to {userName(share.shared_with_id)} · {formatRelative(new Date(share.created_at))}
                  </div>
                </div>
                <select
                  value={share.permission}
                  onChange={(e) => { void changePermission(share, e.target.value as 'view' | 'edit'); }}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-sans)',
                    padding: '3px 6px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="view">view</option>
                  <option value="edit">edit</option>
                </select>
                <IconButton icon={X} title="Revoke" danger onClick={() => setRevokeTarget(share)} />
              </ShareRow>
            }
          />
        );
      })}

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => { void handleRevoke(); }}
        title="Revoke this share?"
        description="The other user will lose access to the file."
        confirmLabel="Revoke"
        variant="danger"
      />
    </div>
  );
}

// ─── Public links ────────────────────────────────────────

function LinksSub() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FileRecord[]>([]);
  const [selected, setSelected] = useState<FileRecord | null>(null);
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [linksLoading, setLinksLoading] = useState(false);

  // Debounced file search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<ApiListResponse<FileRecord>>('/files', {
          search: query.trim(), is_directory: false, limit: 8,
        });
        setResults(res.data);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const loadLinks = useCallback(async (file: FileRecord) => {
    setSelected(file);
    setLinks(null);
    setLinksLoading(true);
    try {
      const res = await api.get<ApiResponse<ShareLink[]>>(`/files/${file.id}/shares`);
      setLinks(res.data);
    } catch {
      toast.error('Failed to load links');
      setLinks([]);
    } finally {
      setLinksLoading(false);
    }
  }, []);

  const revokeLink = useCallback(async (link: ShareLink) => {
    try {
      await api.delete(`/files/share/${link.token}`);
      setLinks(prev => prev ? prev.filter(l => l.id !== link.id) : prev);
      toast.success('Link revoked');
    } catch {
      toast.error('Could not revoke link');
    }
  }, []);

  return (
    <div style={{ padding: '12px 16px' }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '0 0 10px' }}>
        Look up a file to inspect and revoke its public links. (Links are listed
        per file — there is no global link inventory yet.)
      </p>

      {/* Search box */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '0 10px', maxWidth: 380,
      }}>
        <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a file by name…"
          style={{
            flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none',
            fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', color: 'var(--text)', padding: '7px 4px',
          }}
        />
      </div>

      {/* Suggestions */}
      {results.length > 0 && (
        <div style={{
          marginTop: 6, maxWidth: 380,
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          background: 'var(--surface)', overflow: 'hidden',
        }}>
          {results.map(f => (
            <button
              key={f.id}
              onClick={() => { setQuery(''); setResults([]); void loadLinks(f); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '6px 10px', border: 'none', background: 'transparent',
                color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <FileIcon mime={f.mime_type} isDirectory={false} size="sm" />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.filename}</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--text-dim)', flexShrink: 0 }}>
                {f.parent_folder}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Selected file links */}
      {selected && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <FileIcon mime={selected.mime_type} isDirectory={false} size="sm" />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500 }}>{selected.filename}</span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{selected.parent_folder}</span>
          </div>

          {linksLoading && <Loading />}
          {links && links.length === 0 && !linksLoading && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', padding: '8px 0' }}>
              No active public links for this file.
            </div>
          )}
          {links?.map(link => {
            // P2 — bespoke menu: Copy link / Open link / Revoke (existing handlers).
            const menuItems: ContextMenuItem[] = [
              {
                label: 'Copy link', icon: CopyIcon,
                onClick: () => {
                  void navigator.clipboard.writeText(link.url);
                  toast.success('Link copied');
                },
              },
              {
                label: 'Open link', icon: ExternalLink,
                onClick: () => { window.open(link.url, '_blank', 'noopener'); },
              },
              menuSep(),
              {
                label: 'Revoke link', icon: X, variant: 'danger' as const,
                onClick: () => { void revokeLink(link); },
              },
            ];
            return (
              <ContextMenu
                key={link.id}
                items={menuItems}
                trigger={
                  <ShareRow>
                    <Link2 size={14} style={{ color: 'var(--mod-drive)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: '0.75rem', color: 'var(--text)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        fontFamily: 'var(--font-mono, monospace)',
                      }}>
                        {link.url}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span>{formatRelative(new Date(link.created_at))}</span>
                        <span>· {link.download_count ?? 0}{link.max_downloads ? `/${link.max_downloads}` : ''} downloads</span>
                        {link.expires_at && <span>· expires {formatRelative(new Date(link.expires_at))}</span>}
                        {link.password_hash && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            · <KeyRound size={10} /> password
                          </span>
                        )}
                      </div>
                    </div>
                    <IconButton
                      icon={CopyIcon}
                      title="Copy link"
                      onClick={() => {
                        void navigator.clipboard.writeText(link.url);
                        toast.success('Link copied');
                      }}
                    />
                    <IconButton icon={X} title="Revoke" danger onClick={() => { void revokeLink(link); }} />
                  </ShareRow>
                }
              />
            );
          })}
        </div>
      )}

      {!selected && results.length === 0 && !query && (
        <div style={{ marginTop: 32 }}>
          <EmptyState
            icon={Link2}
            title="Inspect public links"
            description="Search for a file above to see its active share links, copy them or revoke them."
          />
        </div>
      )}
    </div>
  );
}

// ─── Small shared pieces ─────────────────────────────────

function ShareRow({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        borderRadius: 'var(--radius-sm)',
        background: hovered ? 'var(--surface-hover)' : 'transparent',
        borderBottom: '1px solid var(--border)',
        transition: 'background var(--transition-fast)',
      }}
    >
      {children}
    </div>
  );
}

function PermissionBadge({ permission }: { permission: string }) {
  const isEdit = permission === 'edit';
  return (
    <span style={{
      fontSize: '0.6875rem',
      padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      border: '1px solid var(--border)',
      color: isEdit ? 'var(--warning)' : 'var(--text-dim)',
      flexShrink: 0,
    }}>
      {permission}
    </span>
  );
}

function IconButton({ icon: Icon, title, onClick, danger }: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26,
        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        background: hovered ? 'var(--surface-hover)' : 'transparent',
        color: danger ? 'var(--error)' : 'var(--text-dim)',
        cursor: 'pointer', flexShrink: 0,
        transition: 'background var(--transition-fast)',
      }}
    >
      <Icon size={13} />
    </button>
  );
}

function Loading() {
  return (
    <div style={{ padding: '8px 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Loading…</div>
  );
}
