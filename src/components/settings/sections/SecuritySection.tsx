import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useSecurityStore } from '@/stores/security.store';
import { useAuthStore } from '@/stores/auth.store';
import { SettingSection } from '../SettingSection';
import { SettingToggle } from '../SettingToggle';
import { SettingInput } from '../SettingInput';
import { SettingSelect } from '../SettingSelect';

const LEVEL_OPTIONS = [
  { value: '0', label: '0 - Auto' },
  { value: '1', label: '1 - Logged' },
  { value: '2', label: '2 - Confirm' },
  { value: '3', label: '3 - Secure' },
];

export function SecuritySection() {
  const config = useSecurityStore((s) => s.config);
  const fetchConfig = useSecurityStore((s) => s.fetchConfig);
  const updateConfig = useSecurityStore((s) => s.updateConfig);
  const setupPin = useSecurityStore((s) => s.setupPin);
  const removePin = useSecurityStore((s) => s.removePin);
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role ?? 'user';

  const ROLE_RANK: Record<string, number> = { user: 0, admin: 1, owner: 2 };
  const canEdit = (requiredRole: string) => (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[requiredRole] ?? 999);

  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showRemovePin, setShowRemovePin] = useState(false);
  const [removePassword, setRemovePassword] = useState('');
  const [showShellConfirm, setShowShellConfirm] = useState(false);
  const [shellPassword, setShellPassword] = useState('');

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  if (!config) return null;

  // ─── Handlers ─────────────────────────────────────────

  const handleLevelChange = async (operation: string, value: string) => {
    const level = parseInt(value, 10);
    try {
      await updateConfig({
        approval_levels: { ...config.approval_levels, [operation]: level },
      });
      toast.success('Approval level updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleSetupPin = async () => {
    if (!/^\d{4,6}$/.test(pinInput)) {
      toast.error('PIN must be 4-6 digits');
      return;
    }
    if (pinInput !== pinConfirm) {
      toast.error('PINs do not match');
      return;
    }
    if (!passwordInput) {
      toast.error('Current password required');
      return;
    }
    try {
      await setupPin(pinInput, passwordInput);
      toast.success('PIN configured');
      setShowPinSetup(false);
      setPinInput('');
      setPinConfirm('');
      setPasswordInput('');
    } catch {
      toast.error('Failed to set PIN — check your password');
    }
  };

  const handleRemovePin = async () => {
    if (!removePassword) {
      toast.error('Current password required');
      return;
    }
    try {
      await removePin(removePassword);
      toast.success('PIN removed');
      setShowRemovePin(false);
      setRemovePassword('');
    } catch {
      toast.error('Failed to remove PIN — check your password');
    }
  };

  const handleToggleUnrestrictedShell = async () => {
    if (!config.unrestricted_shell) {
      // Enabling — show confirmation
      setShowShellConfirm(true);
      return;
    }
    // Disabling — no confirmation needed
    try {
      await updateConfig({ unrestricted_shell: false });
      toast.success('Unrestricted shell disabled');
    } catch {
      toast.error('Failed to update');
    }
  };

  const confirmEnableShell = async () => {
    try {
      await updateConfig({ unrestricted_shell: true });
      toast.success('Unrestricted shell enabled');
      setShowShellConfirm(false);
      setShellPassword('');
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleTimeoutChange = async (key: string, value: string) => {
    const n = Math.max(1, parseInt(value) || 5);
    try {
      await updateConfig({
        approval_timeouts: { ...config.approval_timeouts, [key]: n },
      });
    } catch {
      toast.error('Failed to update');
    }
  };

  // ─── Render ───────────────────────────────────────────

  return (
    <>
      {/* Agent Shell Access */}
      <SettingSection title="Agent Shell Access" description="Control whether the AI agent can execute arbitrary shell commands.">
        <SettingToggle
          label="Unrestricted Shell Mode"
          description="When enabled, the agent can run any command. When disabled, only safe binaries are allowed."
          checked={config.unrestricted_shell}
          onChange={handleToggleUnrestrictedShell}
        />
        {config.unrestricted_shell && (
          <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: '#ef4444', fontFamily: 'var(--font-sans)', marginTop: 4 }}>
            Warning: Unrestricted shell mode allows the agent to execute any command on your system.
          </div>
        )}

        {/* Shell confirm modal */}
        {showShellConfirm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 380, width: '90%' }}>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#ef4444', fontFamily: 'var(--font-sans)', marginBottom: 12 }}>
                Enable Unrestricted Shell?
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', marginBottom: 16, lineHeight: 1.5 }}>
                This allows the AI agent to execute any shell command on your system, including destructive operations. Only enable if you trust the agent configuration.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowShellConfirm(false); setShellPassword(''); }}
                  style={{ height: 32, padding: '0 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmEnableShell}
                  style={{ height: 32, padding: '0 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
                >
                  Enable
                </button>
              </div>
            </div>
          </div>
        )}
      </SettingSection>

      {/* Security PIN */}
      <SettingSection title="Security PIN" description="A numeric PIN is required for Level 3 (Secure) operations.">
        {config.pin_configured ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>PIN Status</span>
            <span style={{ fontSize: '0.8125rem', color: '#22c55e', fontFamily: 'var(--font-sans)' }}>Configured</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                onClick={() => setShowPinSetup(true)}
                style={{ height: 28, padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
              >
                Change
              </button>
              <button
                onClick={() => setShowRemovePin(true)}
                style={{ height: 28, padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#ef4444', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>PIN Status</span>
              <span style={{ fontSize: '0.8125rem', color: '#f59e0b', fontFamily: 'var(--font-sans)' }}>Not configured</span>
            </div>
            <button
              onClick={() => setShowPinSetup(true)}
              style={{ height: 30, padding: '0 16px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
            >
              Set up PIN
            </button>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-sans)' }}>
              Required for Level 3 operations (manage API keys, delete user accounts, export data, etc.)
            </div>
          </div>
        )}

        {/* PIN Setup Form */}
        {showPinSetup && (
          <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 260 }}>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter PIN (4-6 digits)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ height: 32, padding: '0 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)', outline: 'none', letterSpacing: 4 }}
              />
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Confirm PIN"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ height: 32, padding: '0 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)', outline: 'none', letterSpacing: 4 }}
              />
              <input
                type="password"
                placeholder="Current password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                style={{ height: 32, padding: '0 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleSetupPin} style={{ height: 30, padding: '0 16px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Save</button>
                <button onClick={() => { setShowPinSetup(false); setPinInput(''); setPinConfirm(''); setPasswordInput(''); }} style={{ height: 30, padding: '0 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Remove PIN Form */}
        {showRemovePin && (
          <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 260 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>Enter your password to remove the PIN:</div>
              <input
                type="password"
                placeholder="Current password"
                value={removePassword}
                onChange={(e) => setRemovePassword(e.target.value)}
                style={{ height: 32, padding: '0 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleRemovePin} style={{ height: 30, padding: '0 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Remove PIN</button>
                <button onClick={() => { setShowRemovePin(false); setRemovePassword(''); }} style={{ height: 30, padding: '0 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </SettingSection>

      {/* Operation Approval Levels */}
      <SettingSection
        title="Operation Approval Levels"
        description="Configure approval levels per operation. Auto=silent, Logged=recorded, Confirm=requires OK, Secure=requires PIN."
      >
        {config.operation_defaults?.map((op) => {
          const currentLevel = config.approval_levels[op.operation] ?? op.default_level;
          const availableOptions = LEVEL_OPTIONS.filter((l) => parseInt(l.value) >= op.min_level);
          const editable = canEdit(op.edit_role);

          return (
            <SettingSelect
              key={op.operation}
              label={op.label}
              description={`Default: Level ${op.default_level}${op.min_level > 0 ? ` (min: ${op.min_level})` : ''}${!editable ? ` · Requires ${op.edit_role}` : ''}`}
              value={String(currentLevel)}
              options={availableOptions}
              onChange={(v) => handleLevelChange(op.operation, v)}
              disabled={!editable}
            />
          );
        })}
      </SettingSection>

      {/* Approval Timeouts */}
      <SettingSection title="Approval Timeouts" description="Configure timing for approval request lifecycle.">
        <SettingInput
          label="Reminder"
          description="Minutes before sending a reminder for pending approvals"
          type="number"
          value={String(config.approval_timeouts.reminder_minutes)}
          onChange={(v) => handleTimeoutChange('reminder_minutes', v)}
          min={1}
          max={60}
        />
        <SettingInput
          label="Escalation"
          description="Minutes before escalating to admin users"
          type="number"
          value={String(config.approval_timeouts.escalation_minutes)}
          onChange={(v) => handleTimeoutChange('escalation_minutes', v)}
          min={1}
          max={120}
        />
        <SettingInput
          label="Expiry"
          description="Minutes before an unanswered approval request expires"
          type="number"
          value={String(config.approval_timeouts.expiry_minutes)}
          onChange={(v) => handleTimeoutChange('expiry_minutes', v)}
          min={5}
          max={1440}
        />
      </SettingSection>
    </>
  );
}
