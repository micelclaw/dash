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
import {
  Pencil, Check, X, Copy, Download, Trash2, Star, Globe, UserX, Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { FileIcon } from '@/components/shared/FileIcon';
import { HeatBadge } from '@/components/shared/HeatBadge';
import { TagInput } from '@/components/shared/TagInput';
import { AvatarInitials } from '@/components/shared/AvatarInitials';
import { RelatedItemsPanel } from '@/components/shared/RelatedItemsPanel';
import { SimilarContentPanel } from '@/components/shared/SimilarContentPanel';
import { GraphProximityPanel } from '@/components/shared/GraphProximityPanel';
import { formatFileSize, isImageMime, getMimeLabel, getPreviewUrl } from '@/lib/file-utils';
import { formatRelative } from '@/lib/date-helpers';
import { downloadFile } from '@/lib/file-download';
import { api } from '@/services/api';
import { useFileLinks } from '../../hooks/use-file-links';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { FileRecord } from '@/types/files';

interface DetailsTabProps {
  file: FileRecord;
  /** Parent refetch (file lists) after a mutation. */
  onRefetch: () => void;
  /** Delete callback from the hosting view (moves to trash there). */
  onDelete?: (file: FileRecord) => void;
  /** Star toggle from the hosting view (so its list refreshes consistently). */
  onToggleStar?: (file: FileRecord, starred: boolean) => void;
}

/**
 * Inspector → Details: big preview, inline rename, metadata (incl. heat /
 * access), inline-editable tags, custom fields, sharing status (user shares +
 * public links with revoke) and the AI panels (Related / Similar / Graph).
 */
export function DetailsTab({ file: fileProp, onRefetch, onDelete, onToggleStar }: DetailsTabProps) {
  // Live copy — refreshed from GET /files/:id so heat/access fields are current
  // even when the hosting list returned a partial record.
  const [file, setFile] = useState<FileRecord>(fileProp);
  const [imgError, setImgError] = useState(false);
  const { links, loading: linksLoading } = useFileLinks(file.id);

  useEffect(() => {
    setFile(fileProp);
    setImgError(false);
    let cancelled = false;
    void api.get<ApiResponse<FileRecord>>(`/files/${fileProp.id}`)
      .then(res => { if (!cancelled) setFile(res.data); })
      .catch(() => { /* deleted/stale — keep the prop copy */ });
    return () => { cancelled = true; };
  }, [fileProp.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Rename inline ──────────────────────────────────────
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const startRename = () => { setNameDraft(file.filename); setRenaming(true); };
  const commitRename = async () => {
    const name = nameDraft.trim();
    setRenaming(false);
    if (!name || name === file.filename) return;
    try {
      const res = await api.patch<ApiResponse<FileRecord>>(`/files/${file.id}`, { filename: name });
      setFile(res.data);
      toast.success('Renamed');
      onRefetch();
    } catch {
      toast.error('Rename failed');
    }
  };

  // ─── Tags inline (immediate PATCH) ──────────────────────
  const handleTagsChange = useCallback(async (next: string[]) => {
    const prev = file.tags ?? [];
    setFile(f => ({ ...f, tags: next }));
    try {
      await api.patch<ApiResponse<FileRecord>>(`/files/${file.id}`, { tags: next });
      onRefetch();
    } catch {
      setFile(f => ({ ...f, tags: prev }));
      toast.error('Could not update tags');
    }
  }, [file.id, file.tags, onRefetch]);

  const copyChecksum = () => {
    if (!file.checksum_sha256) return;
    void navigator.clipboard.writeText(file.checksum_sha256);
    toast.success('Checksum copied');
  };

  const isImage = isImageMime(file.mime_type);
  const customFields = file.custom_fields && typeof file.custom_fields === 'object'
    ? Object.entries(file.custom_fields)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Preview */}
      <div style={{
        height: 170, flexShrink: 0, background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: '1px solid var(--border)', overflow: 'hidden',
      }}>
        {isImage && !imgError ? (
          <img
            src={getPreviewUrl(file.id, 640)}
            alt={file.filename}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <FileIcon mime={file.mime_type} isDirectory={file.is_directory} size="lg" />
        )}
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Name + rename */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {renaming ? (
            <>
              <input
                value={nameDraft}
                autoFocus
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void commitRename();
                  if (e.key === 'Escape') setRenaming(false);
                }}
                style={{
                  flex: 1, minWidth: 0, background: 'var(--surface)',
                  border: '1px solid var(--mod-drive)', borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px', fontSize: '0.8125rem', color: 'var(--text)',
                  fontFamily: 'var(--font-sans)', outline: 'none',
                }}
              />
              <IconBtn icon={Check} title="Save" onClick={() => { void commitRename(); }} />
              <IconBtn icon={X} title="Cancel" onClick={() => setRenaming(false)} />
            </>
          ) : (
            <>
              <h3
                title={file.filename}
                style={{
                  margin: 0, flex: 1, minWidth: 0, fontSize: '0.875rem', fontWeight: 600,
                  color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.filename}
              </h3>
              {file.starred && <Star size={13} style={{ color: 'var(--amber)', flexShrink: 0 }} fill="var(--amber)" />}
              <IconBtn icon={Pencil} title="Rename" onClick={startRename} />
            </>
          )}
        </div>

        {/* Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {!file.is_directory && <MetaRow label="Size" value={formatFileSize(file.size_bytes)} />}
          <MetaRow label="Type" value={getMimeLabel(file.mime_type)} title={file.mime_type} />
          <MetaRow label="Created" value={formatRelative(new Date(file.created_at))} title={file.created_at} />
          <MetaRow label="Modified" value={formatRelative(new Date(file.updated_at))} title={file.updated_at} />
          {(file.last_accessed_at || (file.access_count ?? 0) > 0) && (
            <MetaRow
              label="Last accessed"
              value={`${file.last_accessed_at ? formatRelative(new Date(file.last_accessed_at)) : '--'}${(file.access_count ?? 0) > 0 ? ` · ${file.access_count} opens` : ''}`}
              extra={<HeatBadge score={file.heat_score ?? 0} />}
            />
          )}
          {file.checksum_sha256 && (
            <MetaRow
              label="Checksum"
              value={`${file.checksum_sha256.slice(0, 12)}…`}
              title={file.checksum_sha256}
              extra={
                <button
                  onClick={copyChecksum}
                  title="Copy checksum"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 1, display: 'flex',
                  }}
                >
                  <Copy size={11} />
                </button>
              }
            />
          )}
          <MetaRow label="Path" value={file.filepath} title={file.filepath} />
        </div>

        {/* Tags — shared TagInput, PATCH on every change */}
        <div>
          <SectionLabel>Tags</SectionLabel>
          <TagInput tags={file.tags ?? []} onChange={(next) => { void handleTagsChange(next); }} size="xs" />
        </div>

        {/* Custom fields (read-only) */}
        {customFields.length > 0 && (
          <div>
            <SectionLabel>Custom fields</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {customFields.map(([k, v]) => (
                <MetaRow key={k} label={k} value={typeof v === 'object' ? JSON.stringify(v) : String(v)} />
              ))}
            </div>
          </div>
        )}

        {/* Sharing status */}
        <SharingSection file={file} />

        {/* AI panels (same components Explorer's FilePreviewPanel uses) */}
        <div>
          <RelatedItemsPanel links={links} loading={linksLoading} />
          <SimilarContentPanel sourceType="file" sourceId={file.id} />
          <GraphProximityPanel sourceType="file" sourceId={file.id} />
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ActionBtn
            icon={Download}
            label="Download"
            onClick={() => { void downloadFile(file.id, file.is_directory ? `${file.filename}.zip` : file.filename); }}
          />
          {onToggleStar && (
            <ActionBtn
              icon={Star}
              label={file.starred ? 'Unstar' : 'Star'}
              onClick={() => {
                onToggleStar(file, !file.starred);
                setFile(f => ({ ...f, starred: !f.starred }));
              }}
            />
          )}
          {onDelete && (
            <ActionBtn icon={Trash2} label="Delete" variant="danger" onClick={() => onDelete(file)} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sharing status (user shares + public links) ──────────

interface UserShareRow {
  id: string;
  shared_with_id: string;
  target_id: string;
  permission: string;
  created_at: string;
}

interface Recipient {
  id: string;
  display_name: string | null;
  email: string;
  avatar_path: string | null;
}

interface ShareLinkRow {
  id: string;
  token: string;
  permissions: string[] | null;
  expires_at: string | null;
  download_count: number | null;
  max_downloads: number | null;
}

function SharingSection({ file }: { file: FileRecord }) {
  const [shares, setShares] = useState<UserShareRow[]>([]);
  const [recipients, setRecipients] = useState<Map<string, Recipient>>(new Map());
  const [links, setLinks] = useState<ShareLinkRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [byMe, linksRes] = await Promise.all([
        api.get<ApiListResponse<UserShareRow>>('/shares/by-me', { target_type: 'file', limit: 100 }),
        file.is_directory
          ? Promise.resolve({ data: [] as ShareLinkRow[] })
          : api.get<ApiResponse<ShareLinkRow[]>>(`/files/${file.id}/shares`),
      ]);
      setShares(byMe.data.filter(s => s.target_id === file.id));
      setLinks(linksRes.data ?? []);
    } catch {
      setShares([]);
      setLinks([]);
    }
    setLoading(false);
  }, [file.id, file.is_directory]);

  useEffect(() => { void load(); }, [load]);

  // Recipient names (shares/by-me rows only carry ids)
  useEffect(() => {
    let cancelled = false;
    void api.get<ApiResponse<Recipient[]>>('/shares/recipients')
      .then(res => {
        if (cancelled) return;
        setRecipients(new Map(res.data.map(r => [r.id, r])));
      })
      .catch(() => { /* names degrade to "user" */ });
    return () => { cancelled = true; };
  }, []);

  const revokeShare = async (id: string) => {
    try {
      await api.delete(`/shares/${id}`);
      toast.success('Share revoked');
      void load();
    } catch {
      toast.error('Could not revoke share');
    }
  };

  const updatePermission = async (id: string, permission: string) => {
    try {
      await api.patch(`/shares/${id}`, { permission });
      toast.success(`Permission set to ${permission}`);
      void load();
    } catch {
      toast.error('Could not update permission');
    }
  };

  const revokeLink = async (token: string) => {
    try {
      await api.delete(`/files/share/${token}`);
      toast.success('Public link revoked');
      void load();
    } catch {
      toast.error('Could not revoke link');
    }
  };

  const copyLink = (token: string) => {
    void navigator.clipboard.writeText(`${window.location.origin}/share/${token}`);
    toast.success('Link copied');
  };

  if (loading) {
    return (
      <div>
        <SectionLabel>Sharing</SectionLabel>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading…</div>
      </div>
    );
  }

  if (shares.length === 0 && links.length === 0) {
    return (
      <div>
        <SectionLabel>Sharing</SectionLabel>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Not shared</div>
      </div>
    );
  }

  return (
    <div>
      <SectionLabel>Sharing</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {shares.map(s => {
          const who = recipients.get(s.shared_with_id);
          const name = who?.display_name || who?.email || 'user';
          return (
            <div
              key={s.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
                background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem',
              }}
            >
              <AvatarInitials name={name} src={who?.avatar_path ?? undefined} size="sm" />
              <span style={{
                flex: 1, minWidth: 0, color: 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {name}
              </span>
              <select
                value={s.permission}
                onChange={e => { void updatePermission(s.id, e.target.value); }}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '1px 4px',
                  fontSize: '0.6875rem', color: 'var(--text-dim)',
                  fontFamily: 'var(--font-sans)', cursor: 'pointer',
                }}
              >
                <option value="view">view</option>
                <option value="edit">edit</option>
              </select>
              <IconBtn icon={UserX} title="Revoke share" onClick={() => { void revokeShare(s.id); }} danger />
            </div>
          );
        })}

        {links.map(l => (
          <div
            key={l.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
              background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem',
            }}
          >
            <Globe size={13} style={{ color: 'var(--mod-drive)', flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Public link
              <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.6875rem' }}>
                {(l.download_count ?? 0) > 0 ? `${l.download_count} downloads` : ''}
                {l.expires_at ? ` · expires ${formatRelative(new Date(l.expires_at))}` : ''}
              </span>
            </span>
            <IconBtn icon={Link2} title="Copy link" onClick={() => copyLink(l.token)} />
            <IconBtn icon={X} title="Revoke link" onClick={() => { void revokeLink(l.token); }} danger />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Small primitives ──────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

function MetaRow({ label, value, title, extra }: {
  label: string;
  value: string;
  title?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
      <span style={{ width: 92, flexShrink: 0, color: 'var(--text-muted)' }}>{label}</span>
      <span
        title={title ?? value}
        style={{ flex: 1, minWidth: 0, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {value}
      </span>
      {extra}
    </div>
  );
}

function IconBtn({ icon: Icon, title, onClick, danger }: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 2,
        color: danger ? 'var(--error)' : 'var(--text-muted)', display: 'flex', flexShrink: 0,
      }}
    >
      <Icon size={13} />
    </button>
  );
}

function ActionBtn({ icon: Icon, label, onClick, variant }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  variant?: 'danger';
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        color: variant === 'danger' ? 'var(--error)' : 'var(--text-dim)',
        fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
      }}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}
