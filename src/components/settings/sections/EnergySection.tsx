import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Battery, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, BatteryWarning,
  Plug, Power, RefreshCw, Moon, Sun,
} from 'lucide-react';
import { api } from '@/services/api';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingToggle } from '../SettingToggle';
import { SettingInput } from '../SettingInput';
import { SettingSelect } from '../SettingSelect';
import { SaveBar } from '../SaveBar';

// ─── Types ──────────────────────────────────────────────

interface PowerState {
  on_ac: boolean;
  battery_present: boolean;
  battery_percent: number | null;
  battery_status: string;
  estimated_minutes: number | null;
  temperature_celsius: number | null;
}

interface UpsStatus {
  available: boolean;
  model: string;
  status: string;
  battery_charge: number;
  runtime_seconds: number;
  input_voltage: number | null;
}

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

  const fetchPower = useCallback(async () => {
    try {
      const res = await api.get<{ data: PowerState }>('/hal/energy/status');
      setPower(res.data);
    } catch {
      // Silent
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
        <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading...</div>
      </SettingSection>
    );
  }

  if (!power) {
    return (
      <SettingSection title="Power Status" description="Current power state of the system.">
        <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Unable to read power status</div>
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

  const fetchUps = useCallback(async () => {
    try {
      const res = await api.get<{ data: UpsStatus | null }>('/hal/energy/ups');
      setUps(res.data);
    } catch {
      // Silent
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
        <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading...</div>
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

function PowerActionsSection() {
  const [acting, setActing] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const actions = [
    { id: 'suspend', label: 'Suspend', description: 'Put the system to sleep', endpoint: '/hal/energy/suspend' },
    { id: 'hibernate', label: 'Hibernate', description: 'Hibernate to disk', endpoint: '/hal/energy/hibernate' },
    { id: 'reboot', label: 'Reboot', description: 'Restart the system', endpoint: '/hal/energy/reboot' },
    { id: 'shutdown', label: 'Shutdown', description: 'Power off the system', endpoint: '/hal/energy/shutdown', danger: true },
  ];

  const execute = async (action: typeof actions[0]) => {
    setActing(action.id);
    setConfirmAction(null);
    try {
      await api.post(action.endpoint);
      toast.success(`${action.label} initiated`);
    } catch {
      toast.error(`Failed to ${action.label.toLowerCase()}`);
    }
    setActing(null);
  };

  return (
    <SettingSection title="Power Actions" description="System power management commands.">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 0' }}>
        {actions.map((action) => (
          <div key={action.id} style={{ position: 'relative' }}>
            {confirmAction === action.id ? (
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => execute(action)}
                  disabled={acting === action.id}
                  style={{
                    height: 32, padding: '0 14px',
                    background: action.danger ? '#ef4444' : 'var(--amber)',
                    color: action.danger ? '#fff' : '#06060a',
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
                  border: `1px solid ${action.danger ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  color: action.danger ? '#ef4444' : 'var(--text)',
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
        ))}
      </div>
    </SettingSection>
  );
}

// ─── Policies & WoL ─────────────────────────────────────

const SCHEDULE_MODE_OPTIONS = [
  { value: 'always', label: 'Always (no restrictions)' },
  { value: 'idle', label: 'Idle (only when system is idle)' },
  { value: 'night', label: 'Night (00:00 – 06:00)' },
];

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
      toast.success('Energy settings saved');
    } catch {
      toast.error('Failed to save energy settings');
    }
    setSaving(false);
  };

  const sendWol = async () => {
    const mac = wolMac || energy.wol_mac;
    if (!mac) {
      toast.error('Enter a MAC address');
      return;
    }
    setSendingWol(true);
    try {
      await api.post('/hal/energy/wol', { mac });
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
          description="Controls when background tasks are allowed to run"
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
            <SettingInput
              label="WoL MAC Address"
              description="Target MAC address for Wake-on-LAN"
              value={energy.wol_mac ?? ''}
              placeholder="AA:BB:CC:DD:EE:FF"
              onChange={(v) => {
                setLocalValue('energy.wol_mac', v);
                setWolMac(v);
              }}
            />
            <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={sendWol}
                disabled={sendingWol}
                style={{
                  height: 30, padding: '0 14px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text)',
                  fontSize: '0.8125rem', fontWeight: 500, cursor: sendingWol ? 'not-allowed' : 'pointer',
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
