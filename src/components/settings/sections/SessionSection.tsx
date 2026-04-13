/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';

function Section({ title, expanded, onToggle, children }: { title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 12 }}>
      <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '10px 14px', background: 'var(--surface)', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{title}
      </button>
      {expanded && <div style={{ padding: '8px 16px 16px', borderTop: '1px solid var(--border)' }}>{children}</div>}
    </div>
  );
}

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

export function SessionSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sections, setSections] = useState<Record<string, boolean>>({ reset: true, scope: false, maintenance: true, threads: false });

  const [dmScope, setDmScope] = useState('per-channel-peer');
  const [resetMode, setResetMode] = useState('');
  const [resetHour, setResetHour] = useState(4);
  const [idleMinutes, setIdleMinutes] = useState(120);
  const [threadBindings, setThreadBindings] = useState(false);
  const [threadIdleHours, setThreadIdleHours] = useState(24);
  const [maintenanceMode, setMaintenanceMode] = useState('enforce');
  const [pruneAfter, setPruneAfter] = useState('30d');
  const [maxDiskBytes, setMaxDiskBytes] = useState('');
  const [maxPingPong, setMaxPingPong] = useState(3);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getSessionConfig();
      setDmScope((data.dm_scope ?? 'per-channel-peer') as string);
      const reset = (data.reset ?? {}) as Record<string, unknown>;
      setResetMode((reset.mode ?? '') as string);
      setResetHour((reset.at_hour ?? 4) as number);
      setIdleMinutes((data.idle_minutes ?? reset.idle_minutes ?? 120) as number);
      const tb = (data.thread_bindings ?? {}) as Record<string, unknown>;
      setThreadBindings((tb.enabled ?? false) as boolean);
      setThreadIdleHours((tb.idle_hours ?? 24) as number);
      const maint = (data.maintenance ?? {}) as Record<string, unknown>;
      setMaintenanceMode((maint.mode ?? 'enforce') as string);
      setPruneAfter((maint.prune_after ?? '30d') as string);
      setMaxDiskBytes((maint.max_disk_bytes ?? '') as string);
      const a2a = (data.agent_to_agent ?? {}) as Record<string, unknown>;
      setMaxPingPong((a2a.max_ping_pong_turns ?? 3) as number);
      setDirty(false);
    } catch { toast.error('Failed to load session config'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  const d = <T,>(s: (v: T) => void) => (v: T) => { s(v); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await gwService.updateSessionConfig({
        dmScope,
        ...(resetMode ? { reset: { mode: resetMode, ...(resetMode === 'daily' ? { atHour: resetHour } : {}), ...(resetMode === 'idle' ? { idleMinutes } : {}) } } : {}),
        threadBindings: { enabled: threadBindings, idleHours: threadIdleHours },
        maintenance: { mode: maintenanceMode, pruneAfter, ...(maxDiskBytes ? { maxDiskBytes } : {}) },
        agentToAgent: { maxPingPongTurns: maxPingPong },
      });
      toast.success('Session config updated');
      setDirty(false);
    } catch { toast.error('Failed to update session config'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading...</div>;

  const Sel = ({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) => (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ padding: '4px 8px', fontSize: '0.75rem', minWidth: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const Num = ({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) => (
    <input type="number" value={value} min={min} max={max} onChange={e => onChange(parseInt(e.target.value, 10) || min)} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 70, textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} />
  );

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>Sessions</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>How agent conversations are scoped, reset, and cleaned up.</p>
        </div>
        <button onClick={handleSave} disabled={!dirty || saving} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: '0.8125rem', fontWeight: 600, background: dirty ? 'var(--amber)' : 'var(--surface)', border: dirty ? 'none' : '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: dirty ? '#000' : 'var(--text-muted)', cursor: dirty ? 'pointer' : 'default', opacity: saving ? 0.7 : 1, fontFamily: 'var(--font-sans)' }}>
          <Save size={14} /> {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>

      <Section title="Session Reset" expanded={sections.reset!} onToggle={() => setSections(p => ({ ...p, reset: !p.reset }))}>
        <Row label="Reset mode" desc="How sessions automatically reset. Empty = no auto-reset (only manual /new)">
          <Sel value={resetMode} options={[
            { value: '', label: 'Disabled (manual /new only)' },
            { value: 'daily', label: 'Daily (reset at a specific hour)' },
            { value: 'idle', label: 'Idle (reset after inactivity)' },
          ]} onChange={d(setResetMode)} />
        </Row>
        {resetMode === 'daily' && <Row label="Reset hour" desc="Hour of day (0-23) when sessions reset"><Num value={resetHour} min={0} max={23} onChange={d(setResetHour)} /></Row>}
        {resetMode === 'idle' && <Row label="Idle minutes" desc="Minutes of inactivity before auto-reset"><Num value={idleMinutes} min={10} max={1440} onChange={d(setIdleMinutes)} /></Row>}
      </Section>

      <Section title="Scope & Identity" expanded={sections.scope!} onToggle={() => setSections(p => ({ ...p, scope: !p.scope }))}>
        <Row label="DM scope" desc="How DM sessions are isolated across channels">
          <Sel value={dmScope} options={[
            { value: 'main', label: 'Main (all DMs share one session)' },
            { value: 'per-peer', label: 'Per peer (one session per user)' },
            { value: 'per-channel-peer', label: 'Per channel+peer (recommended)' },
            { value: 'per-account-channel-peer', label: 'Per account+channel+peer (multi-account)' },
          ]} onChange={d(setDmScope)} />
        </Row>
        <Row label="Agent-to-agent ping-pong limit" desc="Max back-and-forth turns between agents (prevents loops)"><Num value={maxPingPong} min={0} max={5} onChange={d(setMaxPingPong)} /></Row>
      </Section>

      <Section title="Thread Bindings" expanded={sections.threads!} onToggle={() => setSections(p => ({ ...p, threads: !p.threads }))}>
        <Row label="Thread bindings" desc="Bind Discord threads to their own persistent sessions"><Toggle value={threadBindings} onChange={d(setThreadBindings)} /></Row>
        {threadBindings && <Row label="Idle auto-unfocus (hours)" desc="Hours of thread inactivity before auto-unbinding"><Num value={threadIdleHours} min={1} max={168} onChange={d(setThreadIdleHours)} /></Row>}
      </Section>

      <Section title="Maintenance" expanded={sections.maintenance!} onToggle={() => setSections(p => ({ ...p, maintenance: !p.maintenance }))}>
        <Row label="Maintenance mode" desc="enforce = auto-delete old sessions, warn = log only">
          <Sel value={maintenanceMode} options={[
            { value: 'enforce', label: 'Enforce (auto-cleanup)' },
            { value: 'warn', label: 'Warn only (log, no deletion)' },
          ]} onChange={d(setMaintenanceMode)} />
        </Row>
        <Row label="Prune after" desc="Delete sessions older than this duration (e.g. 7d, 30d)">
          <input type="text" value={pruneAfter} onChange={e => { setPruneAfter(e.target.value); setDirty(true); }} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 80, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', textAlign: 'right' }} />
        </Row>
        <Row label="Max disk (bytes)" desc="Limit total session storage (e.g. 500mb). Empty = no limit">
          <input type="text" value={maxDiskBytes} onChange={e => { setMaxDiskBytes(e.target.value); setDirty(true); }} placeholder="e.g. 500mb" style={{ padding: '4px 8px', fontSize: '0.75rem', width: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', textAlign: 'right' }} />
        </Row>
      </Section>
    </div>
  );
}
