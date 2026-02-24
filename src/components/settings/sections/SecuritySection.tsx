import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useSecurityStore } from '@/stores/security.store';
import { SettingSection } from '../SettingSection';
import { SettingToggle } from '../SettingToggle';
import { SettingInput } from '../SettingInput';

const OPERATION_ROWS = [
  { key: 'destructive', label: 'Delete files (permanent)', minLevel: 2 },
  { key: 'external', label: 'Send email / external actions', minLevel: 0 },
  { key: 'financial', label: 'Financial operations', minLevel: 2 },
  { key: 'sensitive', label: 'Access sensitive data', minLevel: 0 },
];

const LEVEL_OPTIONS = [
  { value: 'none', label: '0 - Auto' },
  { value: 'confirm', label: '2 - Confirm' },
  { value: 'pin', label: '3 - Secure' },
];

export function SecuritySection() {
  const config = useSecurityStore((s) => s.config);
  const approvals = useSecurityStore((s) => s.approvals);
  const fetchConfig = useSecurityStore((s) => s.fetchConfig);
  const updateConfig = useSecurityStore((s) => s.updateConfig);
  const fetchApprovals = useSecurityStore((s) => s.fetchApprovals);
  const resolveApproval = useSecurityStore((s) => s.resolveApproval);
  const setupPin = useSecurityStore((s) => s.setupPin);

  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  useEffect(() => {
    fetchConfig();
    fetchApprovals('pending');
    const iv = setInterval(() => fetchApprovals('pending'), 30000);
    return () => clearInterval(iv);
  }, [fetchConfig, fetchApprovals]);

  if (!config) return null;

  const handleLevelChange = async (key: string, value: string) => {
    try {
      await updateConfig({
        approval_levels: { ...config.approval_levels, [key]: value },
      } as any);
      toast.success('Security setting updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleSetupPin = async () => {
    if (pinInput.length < 4 || pinInput.length > 8) {
      toast.error('PIN must be 4-8 digits');
      return;
    }
    if (pinInput !== pinConfirm) {
      toast.error('PINs do not match');
      return;
    }
    try {
      await setupPin(pinInput);
      toast.success('PIN configured');
      setShowPinSetup(false);
      setPinInput('');
      setPinConfirm('');
    } catch {
      toast.error('Failed to set PIN');
    }
  };

  const handleResolve = async (id: string, decision: 'approved' | 'denied') => {
    try {
      await resolveApproval(id, decision);
      toast.success(`Approval ${decision}`);
    } catch {
      toast.error('Failed to resolve approval');
    }
  };

  const minutesAsString = String(config.session_timeout_minutes);

  return (
    <>
      <SettingSection title="Operation Approval Levels" description="Auto = no confirmation, Confirm = requires user OK, Secure = requires PIN.">
        {OPERATION_ROWS.map((op) => {
          const currentValue = (config.approval_levels as any)[op.key] as string;
          return (
            <div key={op.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{op.label}</span>
              <select
                value={currentValue}
                onChange={(e) => handleLevelChange(op.key, e.target.value)}
                style={{
                  height: 30, padding: '0 24px 0 8px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                  fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                  outline: 'none', appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 6px center',
                }}
              >
                {LEVEL_OPTIONS.filter((l) => {
                  if (op.minLevel >= 2 && l.value === 'none') return false;
                  return true;
                }).map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          );
        })}
      </SettingSection>

      <SettingSection title="Security PIN">
        {config.pin_configured ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>PIN Status</span>
            <span style={{ fontSize: '0.8125rem', color: '#22c55e' }}>Configured</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                onClick={() => setShowPinSetup(true)}
                style={{ height: 28, padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
              >
                Change PIN
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>PIN Status</span>
              <span style={{ fontSize: '0.8125rem', color: '#f59e0b' }}>Not configured</span>
            </div>
            <button
              onClick={() => setShowPinSetup(true)}
              style={{ height: 30, padding: '0 16px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
            >
              Set up PIN
            </button>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
              A PIN is required for Secure-level operations (delete volume, system reset, etc.)
            </div>
          </div>
        )}

        {showPinSetup && (
          <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 240 }}>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter PIN (4-8 digits)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                style={{
                  height: 32, padding: '0 10px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)',
                  outline: 'none', letterSpacing: 4,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Confirm PIN"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 8))}
                style={{
                  height: 32, padding: '0 10px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)',
                  outline: 'none', letterSpacing: 4,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleSetupPin} style={{ height: 30, padding: '0 16px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Save</button>
                <button onClick={() => { setShowPinSetup(false); setPinInput(''); setPinConfirm(''); }} style={{ height: 30, padding: '0 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </SettingSection>

      <SettingSection title="Session & Auto-approve">
        <SettingInput
          label="Session Timeout"
          description="Minutes before requiring re-authentication for PIN"
          type="number"
          value={minutesAsString}
          onChange={(v) => {
            const n = Math.max(5, Math.min(480, parseInt(v) || 30));
            updateConfig({ session_timeout_minutes: n });
          }}
          min={5}
          max={480}
        />
        <SettingToggle
          label="Auto-approve Trusted Skills"
          description="Automatically approve operations from skills marked as trusted."
          checked={config.auto_approve_trusted_skills}
          onChange={(v) => updateConfig({ auto_approve_trusted_skills: v })}
        />
      </SettingSection>

      {/* Pending Approvals */}
      <SettingSection title={`Pending Approvals (${approvals.length})`}>
        {approvals.length === 0 ? (
          <div style={{ padding: '16px 0', fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
            No pending approvals.
          </div>
        ) : (
          approvals.map((a) => {
            const expires = new Date(a.expires_at);
            const minsLeft = Math.max(0, Math.round((expires.getTime() - Date.now()) / 60000));
            return (
              <div key={a.id} style={{ padding: '12px', marginBottom: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  {a.description || a.operation}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
                  Requested by: {a.requested_by} &middot; Expires in {minsLeft} min
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => handleResolve(a.id, 'approved')}
                    style={{ height: 28, padding: '0 14px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleResolve(a.id, 'denied')}
                    style={{ height: 28, padding: '0 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            );
          })
        )}
      </SettingSection>
    </>
  );
}
