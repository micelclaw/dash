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

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { SectionShell } from '../shared/SectionShell';
import { ToggleSwitch } from '../shared/ToggleSwitch';

function parseBackoff(raw: string): { ok: true; values: number[] } | { ok: false; error: string } {
  const parts = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length === 0) return { ok: false, error: 'Enter at least one delay' };
  const values: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return { ok: false, error: `"${p}" is not a positive integer` };
    const n = parseInt(p, 10);
    if (n < 0) return { ok: false, error: `"${p}" must be ≥ 0` };
    if (n > 24 * 60 * 60 * 1000) return { ok: false, error: `"${p}" exceeds 24h` };
    values.push(n);
  }
  return { ok: true, values };
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s % 1 === 0 ? s : s.toFixed(1)}s`;
  const m = s / 60;
  if (m < 60) return `${m % 1 === 0 ? m : m.toFixed(1)}m`;
  const h = m / 60;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

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

  const [maxConcurrent, setMaxConcurrent] = useState(1);
  const [retryMax, setRetryMax] = useState(0);
  const [retryBackoff, setRetryBackoff] = useState('30000,60000,300000');
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertAfter, setAlertAfter] = useState(3);
  const [alertMode, setAlertMode] = useState('announce');
  const [alertChannel, setAlertChannel] = useState('');
  const [sessionRetention, setSessionRetention] = useState('24h');
  const [webhook, setWebhook] = useState('');

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getCronConfig();
      setMaxConcurrent((data.max_concurrent_runs ?? 1) as number);
      const retry = (data.retry ?? {}) as Record<string, unknown>;
      setRetryMax((retry.max_attempts ?? 0) as number);
      const backoff = (retry.backoff_ms ?? [30000, 60000, 300000]) as number[];
      setRetryBackoff(backoff.join(','));
      const fa = (data.failure_alert ?? {}) as Record<string, unknown>;
      setAlertEnabled((fa.enabled ?? false) as boolean);
      setAlertAfter((fa.after ?? 3) as number);
      setAlertMode((fa.mode ?? 'announce') as string);
      const fd = (data.failure_destination ?? {}) as Record<string, unknown>;
      setAlertChannel((fd.channel ?? '') as string);
      setSessionRetention((data.session_retention ?? '24h') as string);
      setWebhook((data.webhook ?? '') as string);
      setDirty(false);
    } catch (err) { toast.error(describeError(err, 'Failed to load cron config')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  const d = <T,>(s: (v: T) => void) => (v: T) => { s(v); setDirty(true); };

  const backoffParsed = useMemo(() => parseBackoff(retryBackoff), [retryBackoff]);
  const backoffInvalid = retryMax > 0 && !backoffParsed.ok;

  const handleSave = async () => {
    if (retryMax > 0 && !backoffParsed.ok) {
      toast.error(`Invalid backoff: ${backoffParsed.error}`);
      return;
    }
    setSaving(true);
    try {
      const backoffArr = backoffParsed.ok ? backoffParsed.values : [30000, 60000, 300000];
      await gwService.updateCronConfig({
        maxConcurrentRuns: maxConcurrent,
        retry: { maxAttempts: retryMax, backoffMs: backoffArr, retryOn: ['rate_limit', 'overloaded', 'network', 'timeout', 'server_error'] },
        failureAlert: { enabled: alertEnabled, after: alertAfter, mode: alertMode },
        ...(alertChannel ? { failureDestination: { channel: alertChannel, mode: alertMode } } : {}),
        sessionRetention,
        ...(webhook ? { webhook } : {}),
      });
      toast.success('Cron saved');
      setDirty(false);
    } catch (err) { toast.error(describeError(err, 'Failed to update cron config')); }
    finally { setSaving(false); }
  };

  return (
    <SectionShell
      title="Cron Settings"
      description="Global retry, concurrency, and failure alerting for scheduled jobs."
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
      saveDisabledReason={backoffInvalid ? 'Fix the backoff input before saving' : null}
    >
      <Row label="Max concurrent runs" desc="How many cron jobs can execute simultaneously">
        <input type="number" value={maxConcurrent} min={1} max={10} onChange={e => d(setMaxConcurrent)(parseInt(e.target.value, 10) || 1)} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 60, textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} />
      </Row>

      <Row label="Retry max attempts" desc="Times to retry a failed job (0 = no retry)">
        <input type="number" value={retryMax} min={0} max={10} onChange={e => d(setRetryMax)(parseInt(e.target.value, 10) || 0)} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 60, textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} />
      </Row>

      {retryMax > 0 && (
        <Row label="Backoff delays (ms)" desc="Comma-separated delays between retries (e.g. 30000,60000,300000)">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <input
              type="text"
              value={retryBackoff}
              onChange={e => { setRetryBackoff(e.target.value); setDirty(true); }}
              style={{
                padding: '4px 8px', fontSize: '0.75rem', width: 240,
                background: 'var(--surface)',
                border: `1px solid ${backoffInvalid ? '#ef4444' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            />
            <div style={{
              fontSize: '0.6875rem',
              color: backoffParsed.ok ? 'var(--text-muted)' : '#ef4444',
              fontFamily: 'var(--font-sans)',
              maxWidth: 240, textAlign: 'right',
            }}>
              {backoffParsed.ok
                ? backoffParsed.values.length > 0
                  ? `${backoffParsed.values.length} retr${backoffParsed.values.length === 1 ? 'y' : 'ies'}: ${backoffParsed.values.map(formatMs).join(' → ')}`
                  : ''
                : `! ${backoffParsed.error}`}
            </div>
          </div>
        </Row>
      )}

      <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

      <Row label="Failure alerts" desc="Notify you when jobs fail repeatedly"><Toggle value={alertEnabled} onChange={d(setAlertEnabled)} /></Row>

      {alertEnabled && <>
        <Row label="Alert after N failures" desc="Consecutive failures before alerting">
          <input type="number" value={alertAfter} min={1} max={20} onChange={e => d(setAlertAfter)(parseInt(e.target.value, 10) || 3)} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 60, textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} />
        </Row>
        <Row label="Alert mode" desc="How to deliver failure alerts">
          <select value={alertMode} onChange={e => d(setAlertMode)(e.target.value)} style={{ padding: '4px 8px', fontSize: '0.75rem', minWidth: 140, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
            <option value="announce">Announce (channel message)</option>
            <option value="webhook">Webhook (HTTP POST)</option>
          </select>
        </Row>
        <Row label="Alert channel" desc="Channel for announcements (e.g. telegram, discord)">
          <input type="text" value={alertChannel} onChange={e => { setAlertChannel(e.target.value); setDirty(true); }} placeholder="telegram" style={{ padding: '4px 8px', fontSize: '0.75rem', width: 120, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} />
        </Row>
      </>}

      <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

      <Row label="Session retention" desc="How long to keep cron run sessions (e.g. 24h, 7d, false=forever)">
        <input type="text" value={sessionRetention} onChange={e => { setSessionRetention(e.target.value); setDirty(true); }} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 80, textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} />
      </Row>

      <Row label="Webhook URL" desc="HTTP endpoint for webhook delivery mode (leave empty to disable)">
        <input type="text" value={webhook} onChange={e => { setWebhook(e.target.value); setDirty(true); }} placeholder="https://..." style={{ padding: '4px 8px', fontSize: '0.75rem', width: 250, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }} />
      </Row>
    </SectionShell>
  );
}
