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

/**
 * Account section — self-service profile, password, email, sessions
 * and 2FA for the logged-in user. Available to every user (admin or
 * not), so it must remain functional without depending on the
 * Administration block.
 *
 * Backed by:
 *  - PATCH /auth/me                          (display_name, avatar_path)
 *  - POST  /auth/change-password             (current + new)
 *  - POST  /auth/change-email                (current_password + new_email)
 *  - GET   /auth/sessions                    (active sessions list)
 *  - DELETE /auth/sessions/:id               (revoke one)
 *  - POST  /auth/sessions/revoke-others      (revoke everywhere else)
 *  - GET/POST /auth/2fa/{status,setup,verify,disable,regenerate-backup-codes}
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Smartphone, Monitor, Trash2, LogOut, ShieldCheck, Shield, Copy, Download, Check } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import * as authSvc from '@/services/auth.service';
import type { ActiveSession, TwoFactorStatus, TwoFactorSetupResult } from '@/services/auth.service';
import { SettingSection } from '../SettingSection';
import { SettingsBlock } from '../shared/SettingsBlock';
import { InlineLoading } from '../shared/InlineLoading';

// ─── Password strength helpers (same rules as the admin endpoint) ──

interface PasswordCheck { label: string; met: boolean }

function checkPassword(pw: string): PasswordCheck[] {
  return [
    { label: 'At least 12 characters', met: pw.length >= 12 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(pw) },
    { label: 'One number', met: /[0-9]/.test(pw) },
    { label: 'One symbol (!@#$%...)', met: /[^A-Za-z0-9]/.test(pw) },
  ];
}

function isPasswordStrong(pw: string): boolean {
  return checkPassword(pw).every((c) => c.met);
}

function PasswordRequirements({ password }: { password: string }) {
  const checks = checkPassword(password);
  if (!password) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
      {checks.map((c) => (
        <span
          key={c.label}
          style={{
            fontSize: '0.6875rem',
            fontFamily: 'var(--font-sans)',
            color: c.met ? '#22c55e' : 'var(--text-muted)',
          }}
        >
          {c.met ? '\u2713' : '\u2717'} {c.label}
        </span>
      ))}
    </div>
  );
}

// ─── Inline input style — matches the rest of Account ────────────

const inputCls =
  'w-full px-3 py-1.5 text-sm rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--accent)]';

const labelCls = 'block text-xs text-[var(--text-muted)] mb-1';

// ─── Profile block ───────────────────────────────────────────────

function ProfileBlock() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [avatarPath, setAvatarPath] = useState('');
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [passwordChangedAt, setPasswordChangedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch the full /auth/me on mount to pick up avatar_path and the
  // password_changed_at timestamp. The auth store doesn't carry these
  // because nothing else in the dash renders them yet.
  useEffect(() => {
    let cancelled = false;
    authSvc
      .getMe()
      .then((data) => {
        if (cancelled) return;
        setAvatarPath(data?.avatar_path ?? '');
        setPasswordChangedAt(data?.password_changed_at ?? null);
        setAvatarLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setAvatarLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setDisplayName(user?.display_name ?? '');
  }, [user?.display_name]);

  // Track the avatar baseline so we can detect a real change after fetch.
  const [initialAvatar, setInitialAvatar] = useState('');
  useEffect(() => {
    if (avatarLoaded) setInitialAvatar(avatarPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarLoaded]);

  const isDirty =
    displayName !== (user?.display_name ?? '') || avatarPath !== initialAvatar;

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: import('@/services/auth.service').UpdateProfilePayload = {};
      if (displayName !== (user?.display_name ?? '')) {
        body.display_name = displayName.trim() || undefined;
      }
      if (avatarPath !== initialAvatar) {
        body.avatar_path = avatarPath.trim() || null;
      }
      const data = await authSvc.updateProfile(body);
      // Push the new display_name back into the auth store so the
      // sidebar / chat header / etc. update immediately.
      if (user && data?.display_name && data.display_name !== user.display_name) {
        setUser({ ...user, display_name: data.display_name });
      }
      setInitialAvatar(data?.avatar_path ?? '');
      toast.success('Profile updated');
    } catch (err) {
      const msg = (err as Error)?.message || 'Failed to update profile';
      toast.error(msg);
    }
    setSaving(false);
  };

  return (
    <SettingSection title="Profile" description="Your display name, avatar and account email.">
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Display Name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Avatar URL or path</label>
          <div className="flex gap-2 items-start">
            {avatarPath && (
              <img
                src={avatarPath}
                alt="avatar"
                className="w-9 h-9 rounded-full object-cover border border-[var(--border)] shrink-0"
                onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                onLoad={(e) => ((e.currentTarget as HTMLImageElement).style.display = '')}
              />
            )}
            <input
              value={avatarPath}
              onChange={(e) => setAvatarPath(e.target.value)}
              placeholder="https://example.com/avatar.png"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Email</label>
          <p className="text-sm text-[var(--text)] font-mono">{user?.email}</p>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">
            Use the &quot;Change email&quot; block below to update it.
          </p>
        </div>

        {passwordChangedAt && (
          <div>
            <label className={labelCls}>Password</label>
            <p className="text-[11px] text-[var(--text-muted)]">
              Last changed{' '}
              <span className="text-[var(--text-dim)]">
                {new Date(passwordChangedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </div>
    </SettingSection>
  );
}

// ─── Change Password block ───────────────────────────────────────

function ChangePasswordBlock() {
  const [expanded, setExpanded] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
  };

  const handleSave = async () => {
    if (!current) {
      toast.error('Enter your current password');
      return;
    }
    if (!isPasswordStrong(next)) {
      toast.error('New password does not meet the requirements');
      return;
    }
    if (next !== confirm) {
      toast.error('New passwords do not match');
      return;
    }
    if (next === current) {
      toast.error('The new password must be different from the current one');
      return;
    }
    setSaving(true);
    try {
      await authSvc.changePassword({
        current_password: current,
        new_password: next,
      });
      toast.success('Password updated. Other devices will be logged out.');
      reset();
      setExpanded(false);
    } catch (err) {
      const msg = (err as Error)?.message || 'Failed to change password';
      toast.error(msg);
    }
    setSaving(false);
  };

  return (
    <SettingsBlock
      title="Change password"
      description="Verifies your current password first"
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
    >
      <div className="space-y-3 mt-3">
        <div>
          <label className={labelCls}>Current password</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>New password</label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            className={inputCls}
          />
          <PasswordRequirements password={next} />
        </div>
        <div>
          <label className={labelCls}>Confirm new password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className={inputCls}
          />
          {confirm && next !== confirm && (
            <span className="text-[0.6875rem] text-red-400 mt-1 block">Passwords do not match</span>
          )}
        </div>
        <p className="text-[10px] text-[var(--text-muted)]">
          After saving, all other devices logged into this account will be signed out.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              reset();
              setExpanded(false);
            }}
            className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--surface)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !current || !next || !confirm}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Change password'}
          </button>
        </div>
      </div>
    </SettingsBlock>
  );
}

// ─── Change Email block ──────────────────────────────────────────

function ChangeEmailBlock() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [expanded, setExpanded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCurrentPassword('');
    setNewEmail('');
  };

  const handleSave = async () => {
    if (!currentPassword) {
      toast.error('Enter your current password');
      return;
    }
    if (!newEmail.trim()) {
      toast.error('Enter the new email');
      return;
    }
    if (newEmail.trim().toLowerCase() === (user?.email ?? '').toLowerCase()) {
      toast.error('The new email is the same as the current one');
      return;
    }
    setSaving(true);
    try {
      const data = await authSvc.changeEmail({
        current_password: currentPassword,
        new_email: newEmail.trim(),
      });
      if (user && data?.email) {
        setUser({ ...user, email: data.email });
      }
      toast.success('Email updated');
      reset();
      setExpanded(false);
    } catch (err) {
      const msg = (err as Error)?.message || 'Failed to change email';
      toast.error(msg);
    }
    setSaving(false);
  };

  return (
    <SettingsBlock
      title="Change email"
      description="Verifies your current password first"
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
    >
      <div className="space-y-3 mt-3">
        <div>
          <label className={labelCls}>Current email</label>
          <p className="text-sm text-[var(--text)] font-mono">{user?.email}</p>
        </div>
        <div>
          <label className={labelCls}>New email</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new@example.com"
            autoComplete="email"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className={inputCls}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              reset();
              setExpanded(false);
            }}
            className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--surface)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !currentPassword || !newEmail}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Change email'}
          </button>
        </div>
      </div>
    </SettingsBlock>
  );
}

// ─── Active Sessions block ───────────────────────────────────────
//
// Lists every active refresh token of the current user. The row
// matching the dash's own `refreshTokenId` is marked "This device"
// and uses LogOut instead of Trash2 (revoking it == logout).
//
// Two action paths:
//   - per-row Trash/LogOut: revoke ONE session
//   - "Sign out all other sessions" footer button: revoke everything
//     except the current one. If the current id is unknown (older
//     persisted sessions), the button label changes to "Sign out
//     everywhere" because we can't keep "this device" alive.

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

function ActiveSessionsBlock() {
  const tokens = useAuthStore((s) => s.tokens);
  const logout = useAuthStore((s) => s.logout);
  const [expanded, setExpanded] = useState(false);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const list = await authSvc.listSessions(tokens?.refreshTokenId);
      setSessions(list);
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to load sessions');
    }
    setLoading(false);
  }, [tokens?.refreshTokenId]);

  useEffect(() => {
    if (expanded) fetchSessions();
  }, [expanded, fetchSessions]);

  const handleRevoke = async (s: ActiveSession) => {
    if (s.is_current) {
      const ok = window.confirm(
        'This is your current session. Revoking it will log you out. Continue?',
      );
      if (!ok) return;
    }
    setRevokingId(s.id);
    try {
      await authSvc.revokeSession(s.id);
      if (s.is_current) {
        toast.success('Logged out');
        logout();
      } else {
        toast.success('Session revoked');
        await fetchSessions();
      }
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to revoke session');
    }
    setRevokingId(null);
  };

  const handleRevokeOthers = async () => {
    const knowsCurrent = !!tokens?.refreshTokenId;
    const msg = knowsCurrent
      ? 'Revoke all other sessions? You will stay logged in here.'
      : 'Revoke ALL sessions? You will be logged out (your current session id is unknown).';
    if (!window.confirm(msg)) return;
    setRevokingOthers(true);
    try {
      const { revoked } = await authSvc.revokeOtherSessions(tokens?.refreshTokenId ?? null);
      toast.success(`Revoked ${revoked} session${revoked === 1 ? '' : 's'}`);
      if (!knowsCurrent) {
        logout();
      } else {
        await fetchSessions();
      }
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to revoke sessions');
    }
    setRevokingOthers(false);
  };

  const otherCount = sessions.filter((s) => !s.is_current).length;

  return (
    <SettingsBlock
      title="Active sessions"
      description="Devices currently logged in to your account"
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
    >
      {loading && (
        <InlineLoading />
      )}
      {!loading && sessions.length === 0 && (
        <div className="text-center py-6 text-sm text-[var(--text-muted)]">No active sessions</div>
      )}
      {!loading && sessions.length > 0 && (
        <div className="space-y-2 mt-3">
          {sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              revoking={revokingId === s.id}
              onRevoke={() => handleRevoke(s)}
            />
          ))}
          {otherCount > 0 && (
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleRevokeOthers}
                disabled={revokingOthers}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] text-[var(--text-dim)] hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              >
                {revokingOthers ? 'Revoking...' : 'Sign out all other sessions'}
              </button>
            </div>
          )}
        </div>
      )}
    </SettingsBlock>
  );
}

function SessionRow({
  session,
  revoking,
  onRevoke,
}: {
  session: ActiveSession;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const isMobile = /Android|iPhone|iPad|iOS/i.test(session.device_label);
  const Icon = isMobile ? Smartphone : Monitor;
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <Icon size={16} className="text-[var(--text-muted)] shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--text)] flex items-center gap-2">
          <span className="truncate">{session.device_label}</span>
          {session.is_current && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
              style={{
                background: 'color-mix(in srgb, var(--amber) 18%, transparent)',
                color: 'var(--amber)',
                border: '1px solid color-mix(in srgb, var(--amber) 35%, transparent)',
              }}
            >
              This device
            </span>
          )}
        </div>
        <div className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
          {session.ip_address ?? 'unknown IP'}
          {' · '}
          last seen {formatRelative(session.last_seen_at)}
        </div>
      </div>
      <button
        type="button"
        onClick={onRevoke}
        disabled={revoking}
        className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 shrink-0 disabled:opacity-50"
        title={session.is_current ? 'Sign out' : 'Revoke session'}
      >
        {session.is_current ? <LogOut size={14} /> : <Trash2 size={14} />}
      </button>
    </div>
  );
}

// ─── Two-factor authentication block ─────────────────────────────
//
// Tiny state machine. The block is collapsible (closed by default).
// Once expanded it fetches /auth/2fa/status and shows one of:
//
//   - "disabled" view: a single Enable button + explainer
//   - "verify" view: QR + secret + 6-digit input (after Enable click)
//   - "success" view: 10 backup codes (one-time, after Verify success)
//   - "enabled" view: status row + Disable + Regenerate buttons
//   - "disable" view: confirm with current password
//   - "regenerate" view: confirm with current password → new codes
//
// We render all sub-views inline as small components in this same
// file to keep the AccountSection self-contained.

type TotpStep =
  | { kind: 'idle' }
  | { kind: 'verify'; setupData: TwoFactorSetupResult }
  | { kind: 'success'; codes: string[] }
  | { kind: 'disable' }
  | { kind: 'regenerate' };

function TwoFactorBlock() {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<TotpStep>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await authSvc.get2faStatus());
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to load 2FA status');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (expanded) refresh();
  }, [expanded, refresh]);

  const startSetup = async () => {
    setBusy(true);
    try {
      const data = await authSvc.setup2fa();
      setStep({ kind: 'verify', setupData: data });
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to start 2FA setup');
    }
    setBusy(false);
  };

  const handleVerify = async (code: string) => {
    setBusy(true);
    try {
      const { backup_codes } = await authSvc.verify2fa(code);
      setStep({ kind: 'success', codes: backup_codes });
      await refresh();
    } catch (err) {
      toast.error((err as Error)?.message || 'Invalid code');
    }
    setBusy(false);
  };

  const handleDisable = async (currentPassword: string) => {
    setBusy(true);
    try {
      await authSvc.disable2fa(currentPassword);
      toast.success('2FA disabled');
      setStep({ kind: 'idle' });
      await refresh();
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to disable 2FA');
    }
    setBusy(false);
  };

  const handleRegenerate = async (currentPassword: string) => {
    setBusy(true);
    try {
      const { backup_codes } = await authSvc.regenerateBackupCodes(currentPassword);
      setStep({ kind: 'success', codes: backup_codes });
      await refresh();
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to regenerate backup codes');
    }
    setBusy(false);
  };

  const description = status?.enabled
    ? `Enabled · ${status.backup_codes_remaining} backup codes left`
    : status
    ? 'Not configured'
    : 'Two-factor authentication';

  return (
    <SettingsBlock
      title="Two-factor authentication"
      description={description}
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
    >
      {loading && (
        <InlineLoading />
      )}
      {!loading && status && step.kind === 'idle' && !status.enabled && (
        <TotpDisabledView onStart={startSetup} busy={busy} />
      )}
      {!loading && status && step.kind === 'idle' && status.enabled && (
        <TotpEnabledView
          status={status}
          onDisableClick={() => setStep({ kind: 'disable' })}
          onRegenerateClick={() => setStep({ kind: 'regenerate' })}
        />
      )}
      {step.kind === 'verify' && (
        <TotpVerifyView
          setupData={step.setupData}
          busy={busy}
          onVerify={handleVerify}
          onCancel={() => setStep({ kind: 'idle' })}
        />
      )}
      {step.kind === 'success' && (
        <TotpBackupCodesView
          codes={step.codes}
          onDone={() => setStep({ kind: 'idle' })}
        />
      )}
      {step.kind === 'disable' && (
        <TotpPasswordPromptView
          title="Disable two-factor authentication"
          warning="You will be able to log in with just your password again. Anyone who steals your password could access your account."
          confirmLabel="Disable 2FA"
          busy={busy}
          onConfirm={handleDisable}
          onCancel={() => setStep({ kind: 'idle' })}
        />
      )}
      {step.kind === 'regenerate' && (
        <TotpPasswordPromptView
          title="Regenerate backup codes"
          warning="Your existing backup codes will stop working. You'll get a fresh set of 10 codes."
          confirmLabel="Generate new codes"
          busy={busy}
          onConfirm={handleRegenerate}
          onCancel={() => setStep({ kind: 'idle' })}
        />
      )}
    </SettingsBlock>
  );
}

function TotpDisabledView({ onStart, busy }: { onStart: () => void; busy: boolean }) {
  return (
    <div className="space-y-3 mt-3">
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        Add a second layer of protection to your account. After enabling 2FA you'll need a code
        from your authenticator app (Google Authenticator, Authy, 1Password, Bitwarden…) every
        time you sign in.
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onStart}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
        >
          <Shield size={13} /> {busy ? 'Starting...' : 'Enable 2FA'}
        </button>
      </div>
    </div>
  );
}

function TotpEnabledView({
  status,
  onDisableClick,
  onRegenerateClick,
}: {
  status: TwoFactorStatus;
  onDisableClick: () => void;
  onRegenerateClick: () => void;
}) {
  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center gap-2 text-sm text-[var(--text)]">
        <ShieldCheck size={16} className="text-green-500 shrink-0" />
        Two-factor authentication is <strong>enabled</strong>.
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        You have <strong>{status.backup_codes_remaining}</strong> unused backup code
        {status.backup_codes_remaining === 1 ? '' : 's'} remaining.
        {status.backup_codes_remaining < 3 && (
          <span className="text-amber-400"> Consider regenerating soon.</span>
        )}
      </p>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onRegenerateClick}
          className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--surface)]"
        >
          Regenerate backup codes
        </button>
        <button
          type="button"
          onClick={onDisableClick}
          className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] text-[var(--text-dim)] hover:bg-red-500/10 hover:text-red-400"
        >
          Disable 2FA
        </button>
      </div>
    </div>
  );
}

function TotpVerifyView({
  setupData,
  busy,
  onVerify,
  onCancel,
}: {
  setupData: TwoFactorSetupResult;
  busy: boolean;
  onVerify: (code: string) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(setupData.secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="space-y-4 mt-3">
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        Scan this QR code with your authenticator app, then enter the 6-digit code it generates.
      </p>

      <div className="flex justify-center">
        <img
          src={setupData.qr_data_url}
          alt="2FA QR code"
          className="w-48 h-48 rounded-md border border-[var(--border)] bg-white p-2"
        />
      </div>

      <div>
        <label className={labelCls}>Or enter the secret manually</label>
        <div className="flex gap-2 items-center">
          <code className="flex-1 px-3 py-1.5 text-xs font-mono bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text-dim)] truncate">
            {setupData.secret}
          </code>
          <button
            type="button"
            onClick={copySecret}
            className="p-1.5 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]"
            title="Copy secret"
          >
            {secretCopied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      <div>
        <label className={labelCls}>6-digit code from your app</label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          className={inputCls + ' text-center font-mono tracking-[0.2em]'}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--surface)] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onVerify(code)}
          disabled={busy || code.length !== 6}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Verifying...' : 'Verify and enable'}
        </button>
      </div>
    </div>
  );
}

function TotpBackupCodesView({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      toast.success('Backup codes copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDownload = () => {
    const blob = new Blob(
      [
        '# Micelclaw 2FA backup codes\n',
        '# Each code can be used ONCE if you lose access to your authenticator.\n',
        '# Store this file in a safe place (password manager, paper, etc.)\n\n',
        codes.join('\n') + '\n',
      ],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'micelclaw-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 mt-3">
      <div
        className="px-3 py-2 rounded-md text-xs"
        style={{
          background: 'color-mix(in srgb, var(--amber) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--amber) 35%, transparent)',
          color: 'var(--amber)',
        }}
      >
        ⚠️ Save these codes <strong>now</strong>. They will NOT be shown again. Each code can be
        used only once if you lose access to your authenticator app.
      </div>

      <div className="grid grid-cols-2 gap-2">
        {codes.map((c) => (
          <code
            key={c}
            className="px-3 py-2 text-xs font-mono bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] text-center select-all"
          >
            {c}
          </code>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={handleCopyAll}
          className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--surface)] flex items-center gap-1.5"
        >
          <Copy size={13} /> Copy all
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--surface)] flex items-center gap-1.5"
        >
          <Download size={13} /> Download .txt
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:opacity-90"
        >
          I saved them
        </button>
      </div>
    </div>
  );
}

function TotpPasswordPromptView({
  title,
  warning,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  warning: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: (currentPassword: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');

  return (
    <div className="space-y-3 mt-3">
      <div className="text-sm font-medium text-[var(--text)]">{title}</div>
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{warning}</p>
      <div>
        <label className={labelCls}>Current password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          className={inputCls}
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--surface)] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(password)}
          disabled={busy || !password}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Working...' : confirmLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Main section ────────────────────────────────────────────────

export function AccountSection() {
  return (
    <>
      <ProfileBlock />
      <ChangePasswordBlock />
      <ChangeEmailBlock />
      <ActiveSessionsBlock />
      <TwoFactorBlock />
    </>
  );
}
