/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { SettingsBlock } from '../shared/SettingsBlock';
import { SectionShell } from '../shared/SectionShell';
import { ToggleSwitch } from '../shared/ToggleSwitch';

// Duration string validator. Backend accepts shorthand like 7d, 24h, 30m, 1w.
// Empty string is also valid (means "no limit"), but only for max_disk_bytes,
// not for prune_after.
const DURATION_RE = /^\s*\d+\s*(s|m|h|d|w)\s*$/i;
// Disk size validator. Accepts plain numbers (bytes) or shorthand kb/mb/gb.
const SIZE_RE = /^\s*\d+\s*(b|kb|mb|gb|tb)?\s*$/i;

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{label}</div>
        {desc && <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <ToggleSwitch checked={value} onChange={onChange} />;
}

export function SessionSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sections, setSections] = useState<Record<string, boolean>>({
    reset: true, scope: false, maintenance: true, threads: false,
  });

  const [dmScope, setDmScope] = useState('per-channel-peer');
  // Reset mode: 'disabled' is the explicit "no auto-reset" value (was empty
  // string before, which serialized weirdly). Backend treats 'disabled' as
  // "drop the reset block entirely" — see handleSave.
  const [resetMode, setResetMode] = useState<'disabled' | 'daily' | 'idle'>('disabled');
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
      const incomingMode = reset.mode as string | undefined;
      setResetMode(incomingMode === 'daily' || incomingMode === 'idle' ? incomingMode : 'disabled');
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
    } catch (err) {
      toast.error(describeError(err, 'Failed to load session config'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  const d = <T,>(s: (v: T) => void) => (v: T) => { s(v); setDirty(true); };

  const handleSave = async () => {
    // Pre-flight validation — catch bad duration/size formats before
    // wasting a round-trip and silently failing.
    if (!DURATION_RE.test(pruneAfter)) {
      toast.error(`"Prune after" must look like 7d, 24h, 30m, 1w (got "${pruneAfter}")`);
      return;
    }
    if (maxDiskBytes && !SIZE_RE.test(maxDiskBytes)) {
      toast.error(`"Max disk" must look like 500mb, 2gb, or a plain number of bytes (got "${maxDiskBytes}")`);
      return;
    }
    setSaving(true);
    try {
      await gwService.updateSessionConfig({
        dmScope,
        // 'disabled' → drop the whole reset block. 'daily'/'idle' → send
        // only the relevant sub-fields so the backend doesn't mix modes.
        ...(resetMode === 'disabled'
          ? {}
          : {
              reset: {
                mode: resetMode,
                ...(resetMode === 'daily' ? { atHour: resetHour } : {}),
                ...(resetMode === 'idle' ? { idleMinutes } : {}),
              },
            }),
        threadBindings: { enabled: threadBindings, idleHours: threadIdleHours },
        maintenance: {
          mode: maintenanceMode,
          pruneAfter,
          ...(maxDiskBytes ? { maxDiskBytes } : {}),
        },
        agentToAgent: { maxPingPongTurns: maxPingPong },
      });
      toast.success('Sessions saved');
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to update session config'));
    } finally {
      setSaving(false);
    }
  };

  const Sel = ({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '4px 8px', fontSize: '0.75rem', minWidth: 220,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', color: 'var(--text)',
        fontFamily: 'var(--font-sans)', cursor: 'pointer',
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const Num = ({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) => (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || min)}
      style={{
        padding: '4px 8px', fontSize: '0.75rem', width: 70, textAlign: 'right',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', color: 'var(--text)',
      }}
    />
  );

  // Duration input with inline format validation badge.
  const DurInput = ({
    value, onChange, placeholder, allowEmpty, validator,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    allowEmpty?: boolean;
    validator: RegExp;
  }) => {
    const isEmpty = !value;
    const valid = isEmpty ? !!allowEmpty : validator.test(value);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setDirty(true); }}
          placeholder={placeholder}
          style={{
            padding: '4px 8px', fontSize: '0.75rem', width: 100, textAlign: 'right',
            background: 'var(--surface)',
            border: `1px solid ${valid ? 'var(--border)' : '#ef4444'}`,
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
          }}
        />
        {!valid && (
          <span style={{ fontSize: '0.625rem', color: '#ef4444' }} title="Invalid format">!</span>
        )}
      </div>
    );
  };

  return (
    <SectionShell
      title="Sessions"
      description="How agent conversations are scoped, reset, and cleaned up."
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
      appliesAt="next-session"
    >
      <SettingsBlock
        title="Session Reset"
        expanded={sections.reset!}
        onToggle={() => setSections((p) => ({ ...p, reset: !p.reset }))}
      >
        <Row label="Reset mode" desc="When agent sessions clear automatically. Disabled = only resets when you type /new in chat.">
          <Sel
            value={resetMode}
            options={[
              { value: 'disabled', label: 'Disabled (manual /new only)' },
              { value: 'daily', label: 'Daily (reset at a fixed hour)' },
              { value: 'idle', label: 'Idle (reset after inactivity)' },
            ]}
            onChange={d((v: string) => setResetMode(v as 'disabled' | 'daily' | 'idle'))}
          />
        </Row>
        {resetMode === 'daily' && (
          <Row label="Reset hour" desc="Hour of day (0–23) when sessions reset. 4 = 4 AM, quietest time for most users.">
            <Num value={resetHour} min={0} max={23} onChange={d(setResetHour)} />
          </Row>
        )}
        {resetMode === 'idle' && (
          <Row label="Idle minutes" desc="Reset after this many minutes without messages. 120 = 2 hours.">
            <Num value={idleMinutes} min={10} max={1440} onChange={d(setIdleMinutes)} />
          </Row>
        )}
      </SettingsBlock>

      <SettingsBlock
        title="Scope & Identity"
        expanded={sections.scope!}
        onToggle={() => setSections((p) => ({ ...p, scope: !p.scope }))}
      >
        <Row label="DM scope" desc="Decides when two messages share the same conversation history.">
          <Sel
            value={dmScope}
            options={[
              { value: 'main', label: 'Main — every DM shares one conversation' },
              { value: 'per-peer', label: 'Per peer — one conversation per person, across all platforms' },
              { value: 'per-channel-peer', label: 'Per channel + peer — separate per platform (recommended)' },
              { value: 'per-account-channel-peer', label: 'Per account + channel + peer — for multi-account setups' },
            ]}
            onChange={d(setDmScope)}
          />
        </Row>
        <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', margin: '4px 0 8px', lineHeight: 1.5 }}>
          <strong>Examples</strong>: with <em>per-peer</em>, your DM with Anna in Telegram and Anna in Slack share one history.
          With <em>per-channel-peer</em> they're separate. <em>Per-account-channel-peer</em> goes one step further if you run
          multiple Telegram accounts.
        </p>
        <Row label="Agent-to-agent ping-pong limit" desc="Max back-and-forth turns between agents in the same conversation. 3 is enough for most coordination, higher risks loops.">
          <Num value={maxPingPong} min={0} max={5} onChange={d(setMaxPingPong)} />
        </Row>
      </SettingsBlock>

      <SettingsBlock
        title="Thread Bindings"
        expanded={sections.threads!}
        onToggle={() => setSections((p) => ({ ...p, threads: !p.threads }))}
      >
        <Row label="Bind threads to sessions" desc="Each Discord/Slack thread keeps its own persistent conversation history with the agent.">
          <Toggle value={threadBindings} onChange={d(setThreadBindings)} />
        </Row>
        {threadBindings && (
          <Row label="Auto-unbind after (hours)" desc="Drop the binding after this many hours of inactivity in the thread.">
            <Num value={threadIdleHours} min={1} max={168} onChange={d(setThreadIdleHours)} />
          </Row>
        )}
      </SettingsBlock>

      <SettingsBlock
        title="Maintenance"
        expanded={sections.maintenance!}
        onToggle={() => setSections((p) => ({ ...p, maintenance: !p.maintenance }))}
      >
        <Row label="Maintenance mode" desc="Enforce auto-deletes old sessions. Warn just logs without removing anything (useful while tuning).">
          <Sel
            value={maintenanceMode}
            options={[
              { value: 'enforce', label: 'Enforce (auto-cleanup)' },
              { value: 'warn', label: 'Warn only (log, no deletion)' },
            ]}
            onChange={d(setMaintenanceMode)}
          />
        </Row>
        <Row label="Prune after" desc="Delete sessions older than this. Format: 7d, 24h, 30m, 1w (number + unit s/m/h/d/w).">
          <DurInput value={pruneAfter} onChange={setPruneAfter} placeholder="30d" validator={DURATION_RE} />
        </Row>
        <Row label="Max disk" desc="Cap total session storage. 500mb, 2gb, or a number of bytes. Empty = no limit.">
          <DurInput value={maxDiskBytes} onChange={setMaxDiskBytes} placeholder="500mb" validator={SIZE_RE} allowEmpty />
        </Row>
      </SettingsBlock>
    </SectionShell>
  );
}
