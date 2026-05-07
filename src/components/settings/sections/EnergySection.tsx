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

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Battery, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, BatteryWarning,
  Plug, Power, RefreshCw, Moon, Sun,
} from 'lucide-react';
import * as hal from '@/services/hal.service';
import type { PowerState, UpsStatus } from '@/services/hal.service';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingToggle } from '../SettingToggle';
import { SettingSelect } from '../SettingSelect';
import { SaveBar } from '../SaveBar';
import { TypeToConfirmModal } from '../shared/TypeToConfirmModal';
import { RetryBanner } from '../shared/RetryBanner';
import { InlineLoading } from '../shared/InlineLoading';

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

// ─── Power Status ───────────────────────────────────────

function BatteryIcon({ percent, charging }: { percent: number | null; charging: boolean }) {
  const size = 18;
  if (charging) return <BatteryCharging size={size} style={{ color: '#22c55e' }} />;
  if (percent === null) return <Plug size={size} style={{ color: 'var(--text-dim)' }} />;
  if (percent >= 90) return <BatteryFull size={size} style={{ color: '#22c55e' }} />;
  if (percent >= 60) return <BatteryMedium size={size} style={{ color: '#22c55e' }} />;
  if (percent >= 30) return <Battery size={size} style={{ color: 'var(--amber)' }} />;
  if (percent >= 10) return <BatteryLow size={size} style={{ color: '#f97316' }} />;
  return <BatteryWarning size={size} style={{ color: '#ef4444' }} />;
}

function PowerStatusSection() {
  const [power, setPower] = useState<PowerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPower = useCallback(async () => {
    setError(null);
    try {
      setPower(await hal.getPowerStatus());
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number };
      setError(
        e?.status === 503
          ? 'Power monitoring unavailable on this system'
          : e?.message ?? 'Failed to read power status',
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPower();
    const interval = setInterval(fetchPower, 60_000);
    return () => clearInterval(interval);
  }, [fetchPower]);

  if (loading) {
    return (
      <SettingSection title="Power Status" description="Current power state of the system.">
        <InlineLoading />
      </SettingSection>
    );
  }

  if (error || !power) {
    return (
      <SettingSection title="Power Status" description="Current power state of the system.">
        <RetryBanner
          severity="warn"
          message={error ?? 'Unable to read power status'}
          onRetry={() => { setLoading(true); fetchPower(); }}
        />
      </SettingSection>
    );
  }

  const cards = [
    {
      label: 'Source',
      value: power.on_ac ? 'AC Power' : 'Battery',
      icon: power.on_ac ? <Plug size={16} style={{ color: '#22c55e' }} /> : <BatteryIcon percent={power.battery_percent} charging={power.battery_status === 'charging'} />,
    },
    ...(power.battery_present
      ? [{
          label: 'Battery',
          value: power.battery_percent !== null ? `${power.battery_percent}%` : 'N/A',
          icon: <BatteryIcon percent={power.battery_percent} charging={power.battery_status === 'charging'} />,
        }]
      : []),
    ...(power.estimated_minutes !== null
      ? [{
          label: 'Estimated Time',
          value: power.estimated_minutes > 60
            ? `${Math.floor(power.estimated_minutes / 60)}h ${power.estimated_minutes % 60}m`
            : `${power.estimated_minutes}m`,
          icon: <Moon size={16} style={{ color: 'var(--text-dim)' }} />,
        }]
      : []),
    ...(power.temperature_celsius !== null
      ? [{
          label: 'Temperature',
          value: `${power.temperature_celsius}°C`,
          icon: <Sun size={16} style={{ color: power.temperature_celsius > 80 ? '#ef4444' : 'var(--text-dim)' }} />,
        }]
      : []),
  ];

  return (
    <SettingSection title="Power Status" description="Current power state of the system.">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '8px 0' }}>
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              flex: '1 1 140px',
              padding: '12px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {c.icon}
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>{c.label}</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
        <button
          onClick={fetchPower}
          style={{ height: 24, padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-sans)' }}
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
    </SettingSection>
  );
}

// ─── UPS Status ─────────────────────────────────────────

function UpsSection() {
  const [ups, setUps] = useState<UpsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUps = useCallback(async () => {
    setError(null);
    try {
      setUps(await hal.getUpsStatus());
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number };
      // 404/503 here just means no UPS — treat as benign, not an error
      if (e?.status === 404 || e?.status === 503) {
        setUps(null);
      } else {
        setError(e?.message ?? 'Failed to read UPS status');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUps();
    const interval = setInterval(fetchUps, 60_000);
    return () => clearInterval(interval);
  }, [fetchUps]);

  if (loading) {
    return (
      <SettingSection title="UPS" description="Uninterruptible power supply status.">
        <InlineLoading />
      </SettingSection>
    );
  }

  if (error) {
    return (
      <SettingSection title="UPS" description="Uninterruptible power supply status.">
        <RetryBanner
          severity="warn"
          message={error}
          onRetry={() => { setLoading(true); fetchUps(); }}
        />
      </SettingSection>
    );
  }

  if (!ups || !ups.available) {
    return (
      <SettingSection title="UPS" description="Uninterruptible power supply status.">
        <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No UPS detected</div>
      </SettingSection>
    );
  }

  const runtimeMin = Math.round(ups.runtime_seconds / 60);

  return (
    <SettingSection title="UPS" description="Uninterruptible power supply status.">
      {[
        { label: 'Model', value: ups.model },
        { label: 'Status', value: ups.status },
        { label: 'Battery', value: `${ups.battery_charge}%` },
        { label: 'Runtime', value: `${runtimeMin} min` },
        ...(ups.input_voltage !== null ? [{ label: 'Input Voltage', value: `${ups.input_voltage}V` }] : []),
      ].map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{item.label}</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>{item.value}</span>
        </div>
      ))}
    </SettingSection>
  );
}

// ─── Power Actions ──────────────────────────────────────

type PowerActionId = keyof typeof hal.ENERGY_ACTIONS;

interface PowerAction {
  id: PowerActionId;
  label: string;
  description: string;
  danger?: boolean;
}

const POWER_ACTIONS: PowerAction[] = [
  { id: 'suspend', label: 'Suspend', description: 'Put the system to sleep' },
  { id: 'hibernate', label: 'Hibernate', description: 'Hibernate to disk' },
  { id: 'reboot', label: 'Reboot', description: 'Restart the system' },
  { id: 'shutdown', label: 'Shutdown', description: 'Power off the system', danger: true },
];

function PowerActionsSection() {
  const [acting, setActing] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [shutdownModal, setShutdownModal] = useState(false);

  const execute = async (action: PowerAction) => {
    setActing(action.id);
    setConfirmAction(null);
    try {
      await hal.performEnergyAction(action.id);
      toast.success(`${action.label} initiated`);
      setShutdownModal(false);
    } catch {
      toast.error(`Failed to ${action.label.toLowerCase()}`);
    }
    setActing(null);
  };

  const shutdown = POWER_ACTIONS.find((a) => a.id === 'shutdown')!;

  return (
    <SettingSection title="Power Actions" description="System power management commands.">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 0' }}>
        {POWER_ACTIONS.map((action) => {
          // Shutdown bypasses the inline confirm and opens the modal
          if (action.danger) {
            return (
              <button
                key={action.id}
                onClick={() => setShutdownModal(true)}
                title={action.description}
                style={{
                  height: 32, padding: '0 14px',
                  background: 'var(--surface)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--radius-md)',
                  color: '#ef4444',
                  fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Power size={14} />
                {action.label}
              </button>
            );
          }
          return (
            <div key={action.id} style={{ position: 'relative' }}>
              {confirmAction === action.id ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => execute(action)}
                    disabled={acting === action.id}
                    style={{
                      height: 32, padding: '0 14px',
                      background: 'var(--amber)',
                      color: '#06060a',
                      border: 'none', borderRadius: 'var(--radius-md)',
                      fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {acting === action.id ? 'Running...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    style={{
                      height: 32, padding: '0 10px',
                      background: 'transparent', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-dim)',
                      fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmAction(action.id)}
                  title={action.description}
                  style={{
                    height: 32, padding: '0 14px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text)',
                    fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Power size={14} />
                  {action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <TypeToConfirmModal
        open={shutdownModal}
        onClose={() => setShutdownModal(false)}
        onConfirm={() => execute(shutdown)}
        title="Power off the system?"
        description={
          'This will halt the host immediately. All sessions will end and the ' +
          'dashboard will become unreachable until someone powers the machine ' +
          'back on (physically or via Wake-on-LAN).'
        }
        requireWord="SHUTDOWN"
        confirmLabel="Power off"
        runningLabel="Shutting down…"
        running={acting === 'shutdown'}
        confirmIcon={Power}
      />
    </SettingSection>
  );
}

// ─── Policies & WoL ─────────────────────────────────────

const SCHEDULE_MODE_OPTIONS = [
  { value: 'always', label: 'Always — run anytime' },
  { value: 'idle', label: 'Idle — only when CPU is quiet' },
  { value: 'night', label: 'Night — only between 00:00–06:00' },
];

const SCHEDULE_MODE_HELP =
  'When agents, sync jobs and indexers may run heavy background work. ' +
  '"Idle" defers them until the machine is quiet (no active sessions, low CPU). ' +
  '"Night" pins them to a fixed window. Foreground requests are never affected.';

function PoliciesSection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const [saving, setSaving] = useState(false);
  const [wolMac, setWolMac] = useState('');
  const [sendingWol, setSendingWol] = useState(false);

  if (!settings) return null;

  const energy = (settings as any).energy ?? {
    schedule_mode: 'always',
    wol_enabled: false,
    wol_mac: '',
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('energy', energy);
      toast.success('Energy saved');
    } catch {
      toast.error('Failed to save energy settings');
    }
    setSaving(false);
  };

  const macValue: string = energy.wol_mac ?? '';
  const macTouched = wolMac.length > 0 || macValue.length > 0;
  const macInvalid = macTouched && !MAC_REGEX.test(macValue);

  const sendWol = async () => {
    const mac = wolMac || macValue;
    if (!mac) {
      toast.error('Enter a MAC address');
      return;
    }
    if (!MAC_REGEX.test(mac)) {
      toast.error('Invalid MAC address — use format AA:BB:CC:DD:EE:FF');
      return;
    }
    setSendingWol(true);
    try {
      await hal.sendWakeOnLan(mac);
      toast.success('Wake-on-LAN packet sent');
    } catch {
      toast.error('Failed to send WoL packet');
    }
    setSendingWol(false);
  };

  return (
    <>
      <SettingSection title="Policies" description="Energy management policies and Wake-on-LAN.">
        <SettingSelect
          label="Schedule Mode"
          description={SCHEDULE_MODE_HELP}
          value={energy.schedule_mode ?? 'always'}
          options={SCHEDULE_MODE_OPTIONS}
          onChange={(v) => setLocalValue('energy.schedule_mode', v)}
        />
        <SettingToggle
          label="Wake-on-LAN"
          description="Allow waking the system remotely via network"
          checked={energy.wol_enabled ?? false}
          onChange={(v) => setLocalValue('energy.wol_enabled', v)}
        />
        {energy.wol_enabled && (
          <>
            <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                    WoL MAC Address
                  </label>
                  {macInvalid && (
                    <span style={{
                      fontSize: '0.6875rem', color: '#ef4444',
                      padding: '1px 6px', borderRadius: 4,
                      border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.08)',
                      fontFamily: 'var(--font-sans)',
                    }}>
                      ! Invalid
                    </span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-sans)' }}>
                Target MAC address for Wake-on-LAN. Format: AA:BB:CC:DD:EE:FF
              </div>
              <input
                type="text"
                value={macValue}
                placeholder="AA:BB:CC:DD:EE:FF"
                onChange={(e) => {
                  setLocalValue('energy.wol_mac', e.target.value);
                  setWolMac(e.target.value);
                }}
                autoComplete="off"
                spellCheck={false}
                style={{
                  width: '100%', maxWidth: 280, height: 32,
                  padding: '0 10px',
                  background: 'var(--surface)',
                  border: `1px solid ${macInvalid ? '#ef4444' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)', fontSize: '0.8125rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={sendWol}
                disabled={sendingWol || macInvalid || !macValue}
                style={{
                  height: 30, padding: '0 14px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text)',
                  fontSize: '0.8125rem', fontWeight: 500,
                  cursor: (sendingWol || macInvalid || !macValue) ? 'not-allowed' : 'pointer',
                  opacity: (macInvalid || !macValue) ? 0.5 : 1,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {sendingWol ? 'Sending...' : 'Send WoL Packet'}
              </button>
            </div>
          </>
        )}
      </SettingSection>
      <SaveBar visible={!!dirty.energy} saving={saving} onSave={handleSave} onDiscard={() => resetSection('energy')} />
    </>
  );
}

// ─── Main Section ───────────────────────────────────────

export function EnergySection() {
  return (
    <>
      <PowerStatusSection />
      <UpsSection />
      <PowerActionsSection />
      <PoliciesSection />
    </>
  );
}
