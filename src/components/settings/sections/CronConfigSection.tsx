/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 *
 * ─── Idempotency contract (B7) ─────────────────────────────────────
 * This component may be mounted *twice simultaneously* in the same
 * tab: once standalone at `/settings/cron-config`, and once as a
 * `<SettingsBlock>` inside Automation (`/settings/automation`).
 * Both routes resolve to the same component, so:
 *   - Each mount re-fetches its own copy of the gateway config.
 *   - Local state (`useState`) is per-instance — no shared mutable
 *     state across mounts. Saves race only against themselves.
 *   - Do NOT introduce module-level state, refs, or singletons here.
 *     If you need cross-instance sync, lift to a Zustand store.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { SectionShell } from '../shared/SectionShell';
import { ToggleSwitch } from '../shared/ToggleSwitch';

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0' }}>
      <div style={{ flex: 1 }}><div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{label}</div>{desc && <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>}</div>
      {children}
    </div>
  );
}

// Local thin alias — preserves the call-site `value` prop name used
// throughout this section while delegating to the accessible shared
// component.
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <ToggleSwitch checked={value} onChange={onChange} />;
}

export function CronConfigSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [skipMissedJobs, setSkipMissedJobs] = useState(false);
  const [triggersEnabled, setTriggersEnabled] = useState(true);
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertAfter, setAlertAfter] = useState(3);
  const [alertCooldownMinutes, setAlertCooldownMinutes] = useState(60);
  const [includeSkipped, setIncludeSkipped] = useState(false);
  const [alertMode, setAlertMode] = useState('announce');
  const [alertChannel, setAlertChannel] = useState('');
  const [alertTo, setAlertTo] = useState('');
  const [alertAccountId, setAlertAccountId] = useState('');
  const [sessionRetention, setSessionRetention] = useState('24h');

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getCronConfig();
      setEnabled((data.enabled ?? true) as boolean);
      setSkipMissedJobs((data.skip_missed_jobs ?? false) as boolean);
      const triggers = (data.triggers ?? {}) as Record<string, unknown>;
      setTriggersEnabled((triggers.enabled ?? true) as boolean);
      const fa = (data.failure_alert ?? {}) as Record<string, unknown>;
      setAlertEnabled((fa.enabled ?? false) as boolean);
      setAlertAfter((fa.after ?? 3) as number);
      setAlertCooldownMinutes(Math.max(0, Math.round(((fa.cooldown_ms ?? 3600000) as number) / 60000)));
      setIncludeSkipped((fa.include_skipped ?? false) as boolean);
      setAlertMode((fa.mode ?? 'announce') as string);
      setAlertChannel((fa.channel ?? '') as string);
      setAlertTo((fa.to ?? '') as string);
      setAlertAccountId((fa.account_id ?? '') as string);
      setSessionRetention(data.session_retention === false ? 'false' : (data.session_retention ?? '24h') as string);
      setDirty(false);
    } catch (err) { toast.error(describeError(err, 'Failed to load cron config')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  const d = <T,>(s: (v: T) => void) => (v: T) => { s(v); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await gwService.updateCronConfig({
        enabled,
        skipMissedJobs,
        triggers: { enabled: triggersEnabled },
        failureAlert: {
          enabled: alertEnabled,
          after: alertAfter,
          cooldownMs: alertCooldownMinutes * 60000,
          includeSkipped,
          mode: alertMode,
          ...(alertChannel.trim() ? { channel: alertChannel.trim() } : {}),
          ...(alertTo.trim() ? { to: alertTo.trim() } : {}),
          ...(alertAccountId.trim() ? { accountId: alertAccountId.trim() } : {}),
        },
        sessionRetention: sessionRetention.trim().toLowerCase() === 'false' ? false : sessionRetention.trim(),
      });
      toast.success('Cron saved');
      setDirty(false);
    } catch (err) { toast.error(describeError(err, 'Failed to update cron config')); }
    finally { setSaving(false); }
  };

  return (
    <SectionShell
      title="Cron Settings"
      description="Scheduler, retention, triggers, and failure alerts supported by OpenClaw 2026.9.4."
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
    >
      <Row label="Scheduler enabled" desc="Allow scheduled jobs to run"><Toggle value={enabled} onChange={d(setEnabled)} /></Row>
      <Row label="Skip missed jobs" desc="Do not replay recurring slots missed while the Gateway was stopped"><Toggle value={skipMissedJobs} onChange={d(setSkipMissedJobs)} /></Row>
      <Row label="Triggers enabled" desc="Allow trigger-driven scheduled jobs"><Toggle value={triggersEnabled} onChange={d(setTriggersEnabled)} /></Row>

      <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

      <Row label="Failure alerts" desc="Notify you when jobs fail repeatedly"><Toggle value={alertEnabled} onChange={d(setAlertEnabled)} /></Row>

      {alertEnabled && <>
        <Row label="Alert after N failures" desc="Consecutive failures before alerting">
          <input type="number" value={alertAfter} min={1} max={20} onChange={e => d(setAlertAfter)(parseInt(e.target.value, 10) || 3)} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 60, textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} />
        </Row>
        <Row label="Cooldown (minutes)" desc="Minimum delay before repeating an alert">
          <input type="number" value={alertCooldownMinutes} min={0} max={10080} onChange={e => d(setAlertCooldownMinutes)(parseInt(e.target.value, 10) || 0)} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 80, textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} />
        </Row>
        <Row label="Include skipped runs" desc="Count skipped executions as failures for alerting"><Toggle value={includeSkipped} onChange={d(setIncludeSkipped)} /></Row>
        <Row label="Alert mode" desc="How to deliver failure alerts">
          <select value={alertMode} onChange={e => d(setAlertMode)(e.target.value)} style={{ padding: '4px 8px', fontSize: '0.75rem', minWidth: 140, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
            <option value="announce">Announce (channel message)</option>
            <option value="webhook">Webhook (HTTP POST)</option>
          </select>
        </Row>
        <Row label="Alert channel" desc="Channel for announcements (e.g. telegram, discord)">
          <input type="text" value={alertChannel} onChange={e => { setAlertChannel(e.target.value); setDirty(true); }} placeholder="telegram" style={{ padding: '4px 8px', fontSize: '0.75rem', width: 120, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} />
        </Row>
        <Row label="Alert target" desc="Chat, room, or recipient identifier">
          <input type="text" value={alertTo} onChange={e => { setAlertTo(e.target.value); setDirty(true); }} placeholder="recipient" style={{ padding: '4px 8px', fontSize: '0.75rem', width: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} />
        </Row>
        <Row label="Account ID" desc="Optional channel account when more than one is configured">
          <input type="text" value={alertAccountId} onChange={e => { setAlertAccountId(e.target.value); setDirty(true); }} placeholder="default" style={{ padding: '4px 8px', fontSize: '0.75rem', width: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} />
        </Row>
      </>}

      <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

      <Row label="Session retention" desc="How long to keep cron run sessions (e.g. 24h, 7d, false=forever)">
        <input type="text" value={sessionRetention} onChange={e => { setSessionRetention(e.target.value); setDirty(true); }} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 80, textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} />
      </Row>
    </SectionShell>
  );
}
