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

import { useEffect, useState, useCallback } from 'react';
import { X, UserPlus, Trash2, ChevronDown, Crown, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useProjectsStore } from '@/stores/projects.store';
import { useAuthStore } from '@/stores/auth.store';

interface ShareUser {
  id: string;
  shared_with_id: string;
  permission: string;
  created_at: string;
  email: string;
  display_name: string;
  avatar_path: string | null;
}

interface AvailableUser {
  id: string;
  email: string;
  display_name: string;
  avatar_path: string | null;
}

export function ShareBoardModal({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const activeBoardPermission = useProjectsStore((s) => s.activeBoardPermission);
  const fetchFullBoard = useProjectsStore((s) => s.fetchFullBoard);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isOwner = activeBoardPermission === 'owner';

  const [shares, setShares] = useState<ShareUser[]>([]);
  const [allUsers, setAllUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<'view' | 'edit'>('view');
  const [transferTarget, setTransferTarget] = useState<string | null>(null);

  // Fetch shares and users
  const fetchData = useCallback(async () => {
    if (!isOwner) { setLoading(false); return; }
    setLoading(true);
    try {
      const [sharesRaw, usersRaw] = await Promise.all([
        api.get<any>('/shares/by-me', { target_type: 'kanban_board' }),
        api.get<any>('/admin/users'),
      ]);
      const allSharesArr: any[] = Array.isArray(sharesRaw) ? sharesRaw : sharesRaw?.data ?? [];
      const usersArr: any[] = Array.isArray(usersRaw) ? usersRaw : usersRaw?.data ?? [];

      // Filter shares for this board and enrich with user info
      const boardShares = allSharesArr
        .filter((s: any) => s.target_id === boardId)
        .map((s: any) => {
          const sharedWithId = s.shared_with_id;
          const user = usersArr.find((u: any) => u.id === sharedWithId);
          return {
            id: s.id,
            shared_with_id: sharedWithId,
            permission: s.permission,
            created_at: s.created_at,
            email: user?.email ?? user?.display_name ?? 'Unknown',
            display_name: user?.display_name ?? 'Unknown',
            avatar_path: user?.avatar_path ?? null,
          } as ShareUser;
        });

      // Map users to the expected format (exclude self)
      const mappedUsers = usersArr
        .filter((u: any) => u.id !== currentUserId)
        .map((u: any) => ({
          id: u.id,
          email: u.email,
          display_name: u.display_name ?? '',
          avatar_path: u.avatar_path ?? null,
        }));

      setShares(boardShares);
      setAllUsers(mappedUsers);
    } catch (err) {
      console.error('[ShareBoardModal] fetchData error:', err);
      toast.error('Error loading share data');
    }
    setLoading(false);
  }, [boardId, isOwner, currentUserId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Users not already shared with
  const availableUsers = allUsers.filter(u => !shares.some(s => s.shared_with_id === u.id));

  const handleShare = async () => {
    if (!selectedUserId) return;
    try {
      await api.post('/shares', {
        shared_with_id: selectedUserId,
        target_type: 'kanban_board',
        target_id: boardId,
        permission: selectedPermission,
      });
      toast.success('Board shared');
      setSelectedUserId('');
      await fetchData();
    } catch (err: any) {
      const code = (err as any)?.code;
      const msg = code === 'ALREADY_SHARED' ? 'Already shared with this user' : 'Error sharing board';
      toast.error(msg);
    }
  };

  const handleRevoke = async (shareId: string) => {
    try {
      await api.delete(`/shares/${shareId}`);
      setShares(prev => prev.filter(s => s.id !== shareId));
      toast.success('Access revoked');
    } catch {
      toast.error('Error revoking access');
    }
  };

  const handlePermissionChange = async (shareId: string, permission: string) => {
    try {
      await api.patch(`/shares/${shareId}`, { permission });
      toast.success('Permission updated');
      fetchData();
    } catch {
      toast.error('Error updating permission');
    }
  };

  const handleTransfer = async () => {
    if (!transferTarget) return;
    try {
      await api.post(`/projects/boards/${boardId}/transfer`, { new_owner_id: transferTarget });
      toast.success('Ownership transferred');
      setTransferTarget(null);
      fetchFullBoard(boardId);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Error transferring ownership';
      toast.error(msg);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100 }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 460,
        maxHeight: '80vh',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,.4)',
        zIndex: 101,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            Share Board
          </h3>
          <button onClick={onClose} style={closeBtnStyle}><X size={16} /></button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {!isOwner ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Only the board owner can manage sharing settings.
            </p>
          ) : loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</p>
          ) : (
            <>
              {/* Add user */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="">Select user...</option>
                  {availableUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.display_name} ({u.email})
                    </option>
                  ))}
                </select>
                <select
                  value={selectedPermission}
                  onChange={(e) => setSelectedPermission(e.target.value as 'view' | 'edit')}
                  style={{ ...inputStyle, width: 90 }}
                >
                  <option value="view">View</option>
                  <option value="edit">Edit</option>
                </select>
                <button
                  onClick={handleShare}
                  disabled={!selectedUserId}
                  style={{
                    ...actionBtnStyle,
                    opacity: selectedUserId ? 1 : 0.4,
                    cursor: selectedUserId ? 'pointer' : 'default',
                  }}
                >
                  <UserPlus size={14} />
                  Share
                </button>
              </div>

              {/* Current shares */}
              {shares.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  This board is not shared with anyone.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Shared with ({shares.length})
                  </label>
                  {shares.map(share => (
                    <div key={share.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: 'var(--surface)',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                    }}>
                      {/* Avatar */}
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'var(--amber-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--amber)',
                        flexShrink: 0,
                      }}>
                        {(share.display_name || share.email).charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {share.display_name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {share.email}
                        </div>
                      </div>

                      {/* Permission selector */}
                      <select
                        value={share.permission}
                        onChange={(e) => handlePermissionChange(share.id, e.target.value)}
                        style={{ ...inputStyle, width: 80, fontSize: 12 }}
                      >
                        <option value="view">View</option>
                        <option value="edit">Edit</option>
                      </select>

                      {/* Revoke */}
                      <button
                        onClick={() => handleRevoke(share.id)}
                        title="Revoke access"
                        style={{ ...closeBtnStyle, color: 'var(--error)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Transfer ownership */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Crown size={12} />
                  Transfer Ownership
                </label>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                  Transfer this board to another user. You will keep edit access.
                </p>
                {transferTarget === null ? (
                  <button
                    onClick={() => setTransferTarget('')}
                    style={{ ...actionBtnStyle, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
                  >
                    <ArrowRightLeft size={13} />
                    Transfer...
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={transferTarget}
                      onChange={(e) => setTransferTarget(e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                    >
                      <option value="">Select new owner...</option>
                      {allUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.display_name} ({u.email})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleTransfer}
                      disabled={!transferTarget}
                      style={{
                        ...actionBtnStyle,
                        background: 'var(--error)',
                        opacity: transferTarget ? 1 : 0.4,
                      }}
                    >
                      Transfer
                    </button>
                    <button
                      onClick={() => setTransferTarget(null)}
                      style={{ ...closeBtnStyle }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-dim)',
  padding: 4,
  display: 'flex',
  borderRadius: 4,
};

const inputStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '6px 8px',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  colorScheme: 'dark',
};

const actionBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 6,
  border: 'none',
  background: 'var(--amber)',
  color: '#000',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
