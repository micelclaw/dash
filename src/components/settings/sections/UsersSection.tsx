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

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, KeyRound, Link2, Ban, RotateCcw, Trash2, X, Copy } from 'lucide-react';
import { useUsersStore } from '@/stores/users.store';
import { useAuthStore } from '@/stores/auth.store';
import { SettingSection } from '../SettingSection';
import type { AdminUser, UserRole } from '@/types/users';

// ─── Helpers ────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const ROLE_STYLES: Record<string, { bg: string; color: string }> = {
  owner: { bg: 'rgba(212,160,23,0.15)', color: 'var(--amber)' },
  admin: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  user: { bg: 'var(--surface)', color: 'var(--text-dim)' },
};

// ─── Password validation ─────────────────────────────────────

interface PasswordCheck { label: string; met: boolean }

function checkPassword(pw: string): PasswordCheck[] {
  return [
    { label: 'At least 8 characters', met: pw.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(pw) },
    { label: 'One number', met: /[0-9]/.test(pw) },
    { label: 'One symbol (!@#$%...)', met: /[^A-Za-z0-9]/.test(pw) },
  ];
}

function isPasswordStrong(pw: string): boolean {
  return checkPassword(pw).every(c => c.met);
}

function PasswordRequirements({ password }: { password: string }) {
  const checks = checkPassword(password);
  if (!password) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
      {checks.map(c => (
        <span key={c.label} style={{
          fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
          color: c.met ? '#22c55e' : 'var(--text-muted)',
        }}>
          {c.met ? '\u2713' : '\u2717'} {c.label}
        </span>
      ))}
    </div>
  );
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  active: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  suspended: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
};

// ─── Modal overlay ──────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          maxWidth: 460, width: '92%', padding: '20px 24px',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ModalTitle({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{children}</h4>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 10px', boxSizing: 'border-box',
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)',
  fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', outline: 'none',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)',
  marginBottom: 4, fontFamily: 'var(--font-sans)',
};

const btnPrimary: React.CSSProperties = {
  background: 'var(--amber)', color: '#06060a', border: 'none',
  borderRadius: 'var(--radius-sm)', padding: '8px 18px',
  fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: 'var(--text-dim)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  padding: '8px 18px', fontSize: '0.8125rem', fontWeight: 500,
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};

const btnIcon: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--text-dim)',
  cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
  borderRadius: 'var(--radius-sm)', transition: 'var(--transition-fast)',
};

// ─── Badge ──────────────────────────────────────────────────

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: '0.6875rem', fontWeight: 500,
      padding: '2px 8px', borderRadius: 'var(--radius-sm)',
      background: bg, color, textTransform: 'capitalize',
      fontFamily: 'var(--font-sans)',
    }}>
      {label}
    </span>
  );
}

// ─── Create User Modal ──────────────────────────────────────

function CreateUserModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: { email: string; display_name: string; password: string; role: UserRole }) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!email || !displayName || !password) { toast.error('All fields are required'); return; }
    if (!isPasswordStrong(password)) { toast.error('Password does not meet the requirements'); return; }
    setSaving(true);
    try {
      await onCreate({ email, display_name: displayName, password, role });
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to create user');
    } finally { setSaving(false); }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <ModalTitle onClose={onClose}>Create User</ModalTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelStyle}>Display Name</label>
          <input style={inputStyle} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="John Doe" />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@claw.local" />
        </div>
        <div>
          <label style={labelStyle}>Password</label>
          <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars, uppercase, number, symbol" />
          <PasswordRequirements password={password} />
        </div>
        <div>
          <label style={labelStyle}>Role</label>
          <select style={selectStyle} value={role} onChange={e => setRole(e.target.value as UserRole)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button style={btnSecondary} onClick={onClose}>Cancel</button>
          <button style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Edit User Modal ────────────────────────────────────────

function EditUserModal({ user, isSelf, onClose, onSave }: {
  user: AdminUser;
  isSelf: boolean;
  onClose: () => void;
  onSave: (data: { display_name?: string; email?: string; role?: string }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!displayName || !email) { toast.error('Name and email are required'); return; }
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (displayName !== user.display_name) payload.display_name = displayName;
      if (email !== user.email) payload.email = email;
      if (role !== user.role && !isSelf) payload.role = role;
      if (Object.keys(payload).length === 0) { onClose(); return; }
      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to update user');
    } finally { setSaving(false); }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <ModalTitle onClose={onClose}>Edit User</ModalTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelStyle}>Display Name</label>
          <input style={inputStyle} value={displayName} onChange={e => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Role</label>
          <select
            style={{ ...selectStyle, opacity: isSelf ? 0.5 : 1 }}
            value={role}
            onChange={e => setRole(e.target.value as UserRole)}
            disabled={isSelf}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
          {isSelf && <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>You cannot change your own role</span>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button style={btnSecondary} onClick={onClose}>Cancel</button>
          <button style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Set Password Modal ─────────────────────────────────────

function SetPasswordModal({ user, onClose, onSave }: {
  user: AdminUser;
  onClose: () => void;
  onSave: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!isPasswordStrong(password)) { toast.error('Password does not meet the requirements'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try {
      await onSave(password);
      toast.success(`Password updated for ${user.display_name}`);
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to set password');
    } finally { setSaving(false); }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <ModalTitle onClose={onClose}>Set Password — {user.display_name}</ModalTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelStyle}>New Password</label>
          <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars, uppercase, number, symbol" />
          <PasswordRequirements password={password} />
        </div>
        <div>
          <label style={labelStyle}>Confirm Password</label>
          <input style={inputStyle} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button style={btnSecondary} onClick={onClose}>Cancel</button>
          <button style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Setting...' : 'Set Password'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Reset Link Modal ────────────────────────────────────────

function ResetLinkModal({ user, onClose, onGenerate }: {
  user: AdminUser;
  onClose: () => void;
  onGenerate: () => Promise<{ reset_url: string; email: string }>;
}) {
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await onGenerate();
      setResetUrl(result.reset_url);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to generate reset link');
    } finally { setLoading(false); }
  };

  const handleCopy = async () => {
    if (!resetUrl) return;
    await navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <ModalTitle onClose={onClose}>Reset Link — {user.display_name}</ModalTitle>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', margin: '0 0 16px', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
        Generate a password reset link that you can share with <strong style={{ color: 'var(--text)' }}>{user.display_name}</strong>. They will be able to choose their own password. The link expires in 1 hour.
      </p>

      {!resetUrl ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button style={btnSecondary} onClick={onClose}>Cancel</button>
          <button style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Link'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '8px 12px',
          }}>
            <span style={{
              flex: 1, fontSize: '0.75rem', color: 'var(--text)',
              fontFamily: 'var(--font-mono, monospace)',
              wordBreak: 'break-all', lineHeight: 1.4,
            }}>
              {resetUrl}
            </span>
            <button
              onClick={handleCopy}
              style={{ ...btnIcon, flexShrink: 0 }}
              title="Copy link"
            >
              <Copy size={14} />
            </button>
          </div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
            {copied ? 'Copied!' : 'Share this link with the user. It expires in 1 hour.'}
          </span>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button style={btnSecondary} onClick={onClose}>Close</button>
          </div>
        </div>
      )}
    </ModalOverlay>
  );
}

// ─── Confirm Dialog ─────────────────────────────────────────

function ConfirmDialog({ title, message, confirmLabel, danger, onClose, onConfirm }: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); onClose(); }
    catch (err: unknown) { toast.error((err as Error).message || 'Operation failed'); }
    finally { setLoading(false); }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <ModalTitle onClose={onClose}>{title}</ModalTitle>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', margin: '0 0 20px', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button style={btnSecondary} onClick={onClose}>Cancel</button>
        <button
          style={{ ...btnPrimary, background: danger ? '#ef4444' : 'var(--amber)', opacity: loading ? 0.7 : 1 }}
          onClick={handleConfirm} disabled={loading}
        >
          {loading ? 'Processing...' : confirmLabel}
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── User Row ───────────────────────────────────────────────

function UserRow({ user, isSelf, onEdit, onPassword, onResetLink, onSuspend, onReactivate, onDelete }: {
  user: AdminUser;
  isSelf: boolean;
  onEdit: () => void;
  onPassword: () => void;
  onResetLink: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const roleStyle = ROLE_STYLES[user.role] ?? ROLE_STYLES.user;
  const statusStyle = STATUS_STYLES[user.status] ?? STATUS_STYLES.active;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px',
        background: hovered ? 'var(--surface)' : 'transparent',
        borderRadius: 'var(--radius-md)',
        transition: 'var(--transition-fast)',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: 'var(--radius-full)', flexShrink: 0,
        background: roleStyle.bg, color: roleStyle.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
      }}>
        {initials(user.display_name)}
      </div>

      {/* Name + email */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.display_name}
          {isSelf && <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 6 }}>(you)</span>}
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.email}
        </div>
      </div>

      {/* Role badge */}
      <Badge label={user.role} bg={roleStyle.bg} color={roleStyle.color} />

      {/* Status badge */}
      <Badge label={user.status} bg={statusStyle.bg} color={statusStyle.color} />

      {/* Last login */}
      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', minWidth: 60, textAlign: 'right', flexShrink: 0 }}>
        {relativeTime(user.last_login_at)}
      </span>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0, opacity: hovered ? 1 : 0.3, transition: 'opacity 0.15s' }}>
        <button style={btnIcon} title="Edit" onClick={onEdit} onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; }}>
          <Pencil size={14} />
        </button>
        <button style={btnIcon} title="Set Password" onClick={onPassword} onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; }}>
          <KeyRound size={14} />
        </button>
        {!isSelf && (
          <button style={btnIcon} title="Send Reset Link" onClick={onResetLink} onMouseEnter={e => { e.currentTarget.style.color = 'var(--amber)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; }}>
            <Link2 size={14} />
          </button>
        )}
        {!isSelf && user.status === 'active' && (
          <button style={btnIcon} title="Suspend" onClick={onSuspend} onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; }}>
            <Ban size={14} />
          </button>
        )}
        {!isSelf && user.status === 'suspended' && (
          <button style={btnIcon} title="Reactivate" onClick={onReactivate} onMouseEnter={e => { e.currentTarget.style.color = '#22c55e'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; }}>
            <RotateCcw size={14} />
          </button>
        )}
        {!isSelf && (
          <button style={btnIcon} title="Delete" onClick={onDelete} onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; }}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Section ───────────────────────────────────────────

export function UsersSection() {
  const currentUser = useAuthStore(s => s.user);
  const { users, loading, fetchUsers, createUser, updateUser, setPassword, generateResetLink, suspendUser, reactivateUser, deleteUser } = useUsersStore();

  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);
  const [resetLinkUser, setResetLinkUser] = useState<AdminUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    action: () => Promise<void>;
  } | null>(null);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Auth guard
  if (currentUser?.role !== 'owner' && currentUser?.role !== 'admin') {
    return (
      <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)' }}>
        You do not have permission to manage users.
      </div>
    );
  }

  if (loading && users.length === 0) {
    return (
      <div style={{ padding: 32, color: 'var(--text-dim)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)' }}>
        Loading users...
      </div>
    );
  }

  return (
    <>
      <SettingSection title="Users" description="Manage system users, roles, and access.">
        {/* Header with count + Add button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
            {users.length} user{users.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              ...btnPrimary, padding: '6px 14px',
            }}
          >
            <Plus size={14} /> Add User
          </button>
        </div>

        {/* Table header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '6px 12px', fontSize: '0.6875rem', color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-sans)',
        }}>
          <div style={{ width: 34, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>User</div>
          <div style={{ width: 60, textAlign: 'center' }}>Role</div>
          <div style={{ width: 72, textAlign: 'center' }}>Status</div>
          <div style={{ width: 60, textAlign: 'right' }}>Login</div>
          <div style={{ width: 90 }} />
        </div>

        {/* User rows */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {users.map(user => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.id === currentUser?.id}
              onEdit={() => setEditingUser(user)}
              onPassword={() => setPasswordUser(user)}
              onResetLink={() => setResetLinkUser(user)}
              onSuspend={() => setConfirmAction({
                title: 'Suspend User',
                message: `Are you sure you want to suspend ${user.display_name}? They will be immediately logged out and unable to access the system.`,
                confirmLabel: 'Suspend',
                danger: true,
                action: async () => { await suspendUser(user.id); toast.success(`${user.display_name} suspended`); },
              })}
              onReactivate={() => setConfirmAction({
                title: 'Reactivate User',
                message: `Reactivate ${user.display_name}? They will be able to log in again.`,
                confirmLabel: 'Reactivate',
                action: async () => { await reactivateUser(user.id); toast.success(`${user.display_name} reactivated`); },
              })}
              onDelete={() => setConfirmAction({
                title: 'Delete User',
                message: `Are you sure you want to delete ${user.display_name}? This action cannot be undone. All their data will be archived.`,
                confirmLabel: 'Delete',
                danger: true,
                action: async () => { await deleteUser(user.id); toast.success(`${user.display_name} deleted`); },
              })}
            />
          ))}
        </div>
      </SettingSection>

      {/* Modals */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreate={async (data) => { await createUser(data); toast.success(`User ${data.display_name} created`); }}
        />
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          isSelf={editingUser.id === currentUser?.id}
          onClose={() => setEditingUser(null)}
          onSave={async (data) => { await updateUser(editingUser.id, data); toast.success('User updated'); }}
        />
      )}
      {passwordUser && (
        <SetPasswordModal
          user={passwordUser}
          onClose={() => setPasswordUser(null)}
          onSave={async (pw) => { await setPassword(passwordUser.id, pw); }}
        />
      )}
      {resetLinkUser && (
        <ResetLinkModal
          user={resetLinkUser}
          onClose={() => setResetLinkUser(null)}
          onGenerate={async () => generateResetLink(resetLinkUser.id)}
        />
      )}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          danger={confirmAction.danger}
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmAction.action}
        />
      )}
    </>
  );
}
