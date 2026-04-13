/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0' }}>
      <div style={{ flex: 1 }}><div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{label}</div>{desc && <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>}</div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (<div onClick={() => onChange(!value)} style={{ width: 36, height: 20, borderRadius: 10, cursor: 'pointer', background: value ? 'var(--success, #22c55e)' : 'var(--text-muted)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}><div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 18 : 2, transition: 'left 0.2s' }} /></div>);
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
    } catch { toast.error('Failed to load cron config'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  const d = <T,>(s: (v: T) => void) => (v: T) => { s(v); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const backoffArr = retryBackoff.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      await gwService.updateCronConfig({
        maxConcurrentRuns: maxConcurrent,
        retry: { maxAttempts: retryMax, backoffMs: backoffArr, retryOn: ['rate_limit', 'overloaded', 'network', 'timeout', 'server_error'] },
        failureAlert: { enabled: alertEnabled, after: alertAfter, mode: alertMode },
        ...(alertChannel ? { failureDestination: { channel: alertChannel, mode: alertMode } } : {}),
        sessionRetention,
        ...(webhook ? { webhook } : {}),
      });
      toast.success('Cron config updated');
      setDirty(false);
    } catch { toast.error('Failed to update cron config'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>Cron Settings</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Global retry, concurrency, and failure alerting for scheduled jobs.</p>
        </div>
        <button onClick={handleSave} disabled={!dirty || saving} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: '0.8125rem', fontWeight: 600, background: dirty ? 'var(--amber)' : 'var(--surface)', border: dirty ? 'none' : '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: dirty ? '#000' : 'var(--text-muted)', cursor: dirty ? 'pointer' : 'default', opacity: saving ? 0.7 : 1, fontFamily: 'var(--font-sans)' }}>
          <Save size={14} /> {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>

      <Row label="Max concurrent runs" desc="How many cron jobs can execute simultaneously">
        <input type="number" value={maxConcurrent} min={1} max={10} onChange={e => d(setMaxConcurrent)(parseInt(e.target.value, 10) || 1)} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 60, textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} />
      </Row>

      <Row label="Retry max attempts" desc="Times to retry a failed job (0 = no retry)">
        <input type="number" value={retryMax} min={0} max={10} onChange={e => d(setRetryMax)(parseInt(e.target.value, 10) || 0)} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 60, textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} />
      </Row>

      {retryMax > 0 && (
        <Row label="Backoff delays (ms)" desc="Comma-separated delays between retries (e.g. 30000,60000,300000)">
          <input type="text" value={retryBackoff} onChange={e => { setRetryBackoff(e.target.value); setDirty(true); }} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }} />
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
    </div>
  );
}
