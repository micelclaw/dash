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

// ─── Sensor Fusion Settings Section ─────────────────────────────────
// Settings → Sensor Fusion: HA connection + zone mapping.
// Note: legacy "Automation Rules" UI was removed — sensor-driven
// automations now live in the Flows module (MicelFlow), which exposes
// `sensor` triggers backed by the same fusion-engine.

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import * as sfSvc from '@/services/sensor-fusion.service';
import type { SensorZone, FusionStatus } from '@/services/sensor-fusion.service';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingInput } from '../SettingInput';
import { RetryBanner } from '../shared/RetryBanner';
import { InlineLoading } from '../shared/InlineLoading';

// ─── Shared Styles ──────────────────────────────────────

const smallInput: React.CSSProperties = {
  height: 28,
  padding: '0 8px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  fontSize: '0.75rem',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  boxSizing: 'border-box',
};

const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  display: 'flex',
};

// ─── Status Dot ─────────────────────────────────────────

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '0.75rem',
        color: connected ? 'var(--success)' : 'var(--error)',
      }}
    >
      {connected ? <CheckCircle size={14} /> : <XCircle size={14} />}
      {connected ? 'Connected' : 'Disconnected'}
    </span>
  );
}

// ─── Zone Row ───────────────────────────────────────────

function ZoneRow({
  zone,
  onChange,
  onRemove,
}: {
  zone: { name: string; haEntity: string };
  onChange: (field: 'name' | 'haEntity', value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <input value={zone.name} onChange={(e) => onChange('name', e.target.value)} placeholder="Zone name" style={{ ...smallInput, flex: 1 }} />
      <input value={zone.haEntity} onChange={(e) => onChange('haEntity', e.target.value)} placeholder="binary_sensor.office_presence" style={{ ...smallInput, flex: 2, fontFamily: 'var(--font-mono)' }} />
      <button onClick={onRemove} style={{ ...iconBtn, color: 'var(--error)' }}><Trash2 size={14} /></button>
    </div>
  );
}

// ─── Main Section ───────────────────────────────────────

export function SensorFusionSection() {
  const [status, setStatus] = useState<FusionStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [zones, setZones] = useState<Array<{ name: string; haEntity: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [savingZones, setSavingZones] = useState(false);

  const settings = useSettingsStore((s) => s.settings);
  const patchSettings = useSettingsStore((s) => (s as any).patchSettings) as ((patch: Record<string, unknown>) => Promise<void>) | undefined;

  const [haUrl, setHaUrl] = useState('');
  const [haToken, setHaToken] = useState('');

  useEffect(() => {
    if (settings) {
      const sf = (settings as unknown as Record<string, unknown>).sensorFusion as Record<string, string> | undefined;
      if (sf) {
        setHaUrl(sf.haUrl || '');
        setHaToken(sf.haToken || '');
      }
    }
  }, [settings]);

  const fetchStatus = useCallback(async () => {
    setStatusError(null);
    try {
      setStatus(await sfSvc.getFusionStatus());
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number };
      setStatus(null);
      setStatusError(
        e?.status === 503
          ? 'Sensor-fusion service unavailable'
          : e?.message ?? 'Failed to read sensor-fusion status',
      );
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetchStatus(),
      sfSvc.listZones().catch(() => [] as SensorZone[]),
    ])
      .then(([, zonesList]) => {
        setZones(zonesList.map((z) => ({ name: z.name, haEntity: z.haEntity })));
      })
      .finally(() => setLoading(false));
  }, [fetchStatus]);

  const handleSaveZones = useCallback(async () => {
    setSavingZones(true);
    try {
      const payload = zones
        .filter((z) => z.name.trim() && z.haEntity.trim())
        .map((z) => ({ name: z.name.trim(), ha_entity: z.haEntity.trim() }));
      await sfSvc.replaceZones(payload);
      toast.success('Zones saved');
    } catch {
      toast.error('Failed to save zones');
    }
    setSavingZones(false);
  }, [zones]);

  const handleSaveHaConfig = useCallback(async () => {
    if (!patchSettings) return;
    try {
      await patchSettings({ sensorFusion: { haUrl, haToken } });
      toast.success('HA configuration saved');
    } catch {
      toast.error('Failed to save HA config');
    }
  }, [haUrl, haToken, patchSettings]);

  if (loading) {
    return <InlineLoading message="Loading sensor fusion settings..." withSpinner />;
  }

  return (
    <>
      {/* HA Connection */}
      <SettingSection
        title="Home Assistant Connection"
        description="Connect to your Home Assistant instance for sensor data and service calls."
        action={
          <button onClick={handleSaveHaConfig} style={{ padding: '4px 12px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
            Save
          </button>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Status</span>
          {status ? (
            <StatusDot connected={status.haConnected} />
          ) : statusError ? (
            <RetryBanner severity="warn" message={statusError} onRetry={fetchStatus} layout="compact" />
          ) : null}
        </div>
        <SettingInput label="HA URL" value={haUrl} onChange={setHaUrl} type="url" placeholder="http://homeassistant.local:8123" />
        <SettingInput label="Access Token" value={haToken} onChange={setHaToken} placeholder="Long-lived access token" />
      </SettingSection>

      {/* Zone Mapping */}
      <SettingSection
        title="Zone Mapping"
        description="Map Home Assistant presence entities to logical zones."
        action={
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setZones((prev) => [...prev, { name: '', haEntity: '' }])} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
              <Plus size={12} /> Add
            </button>
            <button onClick={handleSaveZones} disabled={savingZones} style={{ padding: '4px 12px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: savingZones ? 'not-allowed' : 'pointer', opacity: savingZones ? 0.5 : 1 }}>
              {savingZones ? 'Saving...' : 'Save'}
            </button>
          </div>
        }
      >
        {zones.length === 0 ? (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '12px 0' }}>
            No zones configured. Add zones to map HA entities to logical locations.
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ flex: 1, fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zone</span>
              <span style={{ flex: 2, fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>HA Entity</span>
              <span style={{ width: 14 }} />
            </div>
            {zones.map((zone, i) => (
              <ZoneRow key={i} zone={zone} onChange={(field, value) => setZones((prev) => prev.map((z, j) => (j === i ? { ...z, [field]: value } : z)))} onRemove={() => setZones((prev) => prev.filter((_, j) => j !== i))} />
            ))}
          </div>
        )}
      </SettingSection>

      {/* Note: the legacy "Automation Rules" UI was removed. Sensor-
          driven automations now live in the Flows module (MicelFlow),
          which supports `sensor` triggers backed by the same
          fusion-engine. See modules/flows. */}
    </>
  );
}
