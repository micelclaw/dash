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
import { X, UserPlus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { AvatarInitials } from '@/components/shared/AvatarInitials';
import type { ApiResponse } from '@/types/api';
import type { FileRecord } from '@/types/files';

interface Recipient {
  id: string;
  display_name: string | null;
  email: string;
  avatar_path: string | null;
}

interface ShareWithUserModalProps {
  open: boolean;
  /** One or many files — POST /shares per file. */
  files: FileRecord[];
  onClose: () => void;
  /** Called after at least one share was created. */
  onShared?: () => void;
}

/**
 * Share file(s) with an internal user (D4): pick a recipient from
 * GET /shares/recipients (avatar + name + email), choose view/edit and
 * POST /shares per file. 409 ALREADY_SHARED is reported per file.
 */
export function ShareWithUserModal({ open, files, onClose, onShared }: ShareWithUserModalProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setSelectedId(null);
    setPermission('view');
    void api.get<ApiResponse<Recipient[]>>('/shares/recipients')
      .then(res => { if (!cancelled) setRecipients(res.data); })
      .catch(() => { if (!cancelled) toast.error('Could not load users'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  if (!open || files.length === 0) return null;

  const title = files.length === 1
    ? `Share "${files[0]!.filename}" with a user`
    : `Share ${files.length} items with a user`;

  const handleShare = async () => {
    if (!selectedId) return;
    setSharing(true);
    let ok = 0;
    let already = 0;
    let failed = 0;
    for (const file of files) {
      try {
        await api.post('/shares', {
          shared_with_id: selectedId,
          target_type: 'file',
          target_id: file.id,
          permission,
        });
        ok++;
      } catch (err) {
        if ((err as { code?: string })?.code === 'ALREADY_SHARED') already++;
        else failed++;
      }
    }
    setSharing(false);

    const who = recipients.find(r => r.id === selectedId);
    const whoName = who?.display_name || who?.email || 'user';
    if (ok > 0) {
      toast.success(files.length === 1
        ? `Shared with ${whoName} (${permission})`
        : `${ok} item${ok === 1 ? '' : 's'} shared with ${whoName} (${permission})`);
      onShared?.();
      onClose();
    } else if (already > 0 && failed === 0) {
      toast.info('Already shared with this user');
      onClose();
    } else {
      toast.error('Could not share');
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          width: 440,
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <h3 style={{
            margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)',
            display: 'flex', alignItems: 'center', gap: 8,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <UserPlus size={15} style={{ flexShrink: 0, color: 'var(--mod-drive)' }} />
            {title}
          </h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', padding: 2, flexShrink: 0, display: 'flex',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Recipient list */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '10px 12px' }}>
          {loading && (
            <div style={{ padding: '12px 8px', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Loading users…</div>
          )}
          {!loading && recipients.length === 0 && (
            <div style={{ padding: '12px 8px', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
              No other users in this instance.
            </div>
          )}
          {recipients.map(r => {
            const isSelected = selectedId === r.id;
            const name = r.display_name || r.email;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '8px 10px', marginBottom: 4,
                  background: isSelected ? 'var(--amber-dim)' : 'transparent',
                  border: isSelected ? '1px solid var(--amber)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <AvatarInitials name={name} src={r.avatar_path ?? undefined} size="md" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {r.display_name || r.email}
                  </div>
                  {r.display_name && (
                    <div style={{
                      fontSize: '0.6875rem', color: 'var(--text-dim)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.email}
                    </div>
                  )}
                </div>
                {isSelected && <Check size={15} style={{ color: 'var(--amber)', flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Permission:</span>
          <select
            value={permission}
            onChange={e => setPermission(e.target.value as 'view' | 'edit')}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '4px 8px',
              fontSize: '0.8125rem', color: 'var(--text)',
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            <option value="view">View</option>
            <option value="edit">Edit</option>
          </select>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
              fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { void handleShare(); }}
            disabled={!selectedId || sharing}
            style={{
              padding: '6px 14px',
              background: (!selectedId || sharing) ? 'var(--surface)' : 'var(--amber)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: (!selectedId || sharing) ? 'var(--text-muted)' : '#000',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: (!selectedId || sharing) ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {sharing ? 'Sharing…' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}
