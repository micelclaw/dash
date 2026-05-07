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

// ─── Telemetry Section (Ola 7, oc7-1.2) ─────────────────────────────
//
// Controls `diagnostics.otel.*` of openclaw.json. OpenTelemetry export
// is provided by the bundled `diagnostics-otel` plugin — if disabled,
// we show a banner with a one-click "Enable plugin" button (D3=A).
//
// Decisions applied:
//   D4=A — headers are edited with KeyValueListEditor (generic k=v)
//   D5=A — sampleRate is a slider with marks at 0.01/0.1/0.5/1.0
//   D6=A — endpoint placeholder is `http://localhost:4318` (local OTLP)

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Activity, Info } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import type { OtelConfig } from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import {
  KeyValueListEditor,
  entriesToRecord,
  recordToEntries,
  type KeyValueEntry,
} from '@/components/settings/shared/KeyValueListEditor';
import { SectionShell } from '../shared/SectionShell';
import { ToggleSwitch } from '../shared/ToggleSwitch';

const PROTOCOLS = ['http/protobuf', 'grpc'];
const SAMPLE_MARKS = [0.01, 0.1, 0.5, 1.0];

export function TelemetrySection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pluginEnabled, setPluginEnabled] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [endpoint, setEndpoint] = useState('');
  const [protocol, setProtocol] = useState('http/protobuf');
  const [headerEntries, setHeaderEntries] = useState<KeyValueEntry[]>([]);
  const [serviceName, setServiceName] = useState('openclaw');
  const [traces, setTraces] = useState(true);
  const [metrics, setMetrics] = useState(true);
  const [logs, setLogs] = useState(false);
  const [sampleRate, setSampleRate] = useState(1.0);
  const [flushIntervalMs, setFlushIntervalMs] = useState(5000);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getTelemetryConfig();
      setPluginEnabled(data.plugin_enabled);
      const otel = data.otel || {};
      setEnabled(otel.enabled ?? false);
      setEndpoint(otel.endpoint ?? '');
      setProtocol(otel.protocol ?? 'http/protobuf');
      setHeaderEntries(recordToEntries(otel.headers));
      setServiceName(otel.service_name ?? 'openclaw');
      setTraces(otel.traces ?? true);
      setMetrics(otel.metrics ?? true);
      setLogs(otel.logs ?? false);
      setSampleRate(otel.sample_rate ?? 1.0);
      setFlushIntervalMs(otel.flush_interval_ms ?? 5000);
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to load telemetry config'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const handleEnablePlugin = async () => {
    setEnabling(true);
    try {
      await gwService.enableDiagnosticsOtelPlugin();
      toast.success('diagnostics-otel plugin enabled');
      // Refetch to confirm
      await fetchConfig();
    } catch (err) {
      toast.error(describeError(err, 'Failed to enable plugin'));
    } finally {
      setEnabling(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const config: OtelConfig = {
        enabled,
        endpoint: endpoint || undefined,
        protocol,
        headers: entriesToRecord(headerEntries),
        service_name: serviceName,
        traces,
        metrics,
        logs,
        sample_rate: sampleRate,
        flush_interval_ms: flushIntervalMs,
      };
      await gwService.updateTelemetryConfig(config);
      toast.success('Telemetry saved');
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to update telemetry config'));
    } finally {
      setSaving(false);
    }
  };

  const formDisabled = !pluginEnabled;

  return (
    <SectionShell
      title="Telemetry (OpenTelemetry)"
      description="Export traces, metrics, and structured logs to an OTLP collector (Grafana Cloud, Honeycomb, Datadog, local)."
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
      saveDisabledReason={formDisabled ? 'Enable the diagnostics-otel plugin first' : null}
      appliesAt="gateway-restart"
    >
      {/* Plugin required banner (D3=A) */}
      {!pluginEnabled && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: '14px 16px',
            marginBottom: 20,
            background: '#f59e0b15',
            border: '1px solid #f59e0b40',
            borderRadius: 'var(--radius-md)',
            alignItems: 'center',
          }}
        >
          <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text)' }}>Plugin required.</strong> OpenTelemetry export is provided by the
            bundled <code style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: 3 }}>diagnostics-otel</code>{' '}
            plugin. It is currently disabled — enable it to start configuring exports.
          </div>
          <button
            onClick={handleEnablePlugin}
            disabled={enabling}
            style={{
              padding: '8px 14px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: '#f59e0b',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: '#000',
              cursor: enabling ? 'default' : 'pointer',
              fontFamily: 'var(--font-sans)',
              flexShrink: 0,
            }}
          >
            {enabling ? 'Enabling...' : 'Enable plugin'}
          </button>
        </div>
      )}

      {/* Info box */}
      {pluginEnabled && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '12px 14px',
            marginBottom: 20,
            background: '#06b6d410',
            border: '1px solid #06b6d425',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <Info size={16} style={{ color: '#06b6d4', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            URL of the OTLP collector. Use <code>http://localhost:4318</code> for a local collector or your cloud
            provider endpoint (Grafana Cloud, Honeycomb, Datadog, etc.). Headers carry authentication — see your
            provider docs for the exact format.
          </div>
        </div>
      )}

      <fieldset
        disabled={formDisabled}
        style={{
          border: 'none',
          padding: 0,
          margin: 0,
          opacity: formDisabled ? 0.4 : 1,
          pointerEvents: formDisabled ? 'none' : 'auto',
        }}
      >
        {/* enabled */}
        <FieldRow label="Enable export" desc="Master switch — turn this on after configuring the endpoint and headers.">
          <Toggle value={enabled} onChange={markDirty(setEnabled)} />
        </FieldRow>

        {/* endpoint */}
        <FieldRow label="OTLP endpoint" desc="URL of the OTLP collector (HTTP or gRPC).">
          <input
            type="text"
            value={endpoint}
            onChange={(e) => { setEndpoint(e.target.value); setDirty(true); }}
            placeholder="http://localhost:4318"
            style={{ ...inputStyle(), width: 320 }}
          />
        </FieldRow>

        {/* protocol */}
        <FieldRow label="Protocol" desc="`http/protobuf` is the most compatible. `grpc` is faster for high volume.">
          <Select value={protocol} onChange={markDirty(setProtocol)} options={PROTOCOLS} />
        </FieldRow>

        {/* serviceName */}
        <FieldRow label="Service name" desc="Identifier shown in your collector's UI to distinguish this instance.">
          <input
            type="text"
            value={serviceName}
            onChange={(e) => { setServiceName(e.target.value); setDirty(true); }}
            placeholder="openclaw"
            style={inputStyle()}
          />
        </FieldRow>

        {/* traces / metrics / logs toggles */}
        <FieldRow label="Export traces" desc="Spans for each request, tool call, and agent run.">
          <Toggle value={traces} onChange={markDirty(setTraces)} />
        </FieldRow>
        <FieldRow label="Export metrics" desc="Counters and gauges (tokens, cost, run duration, errors).">
          <Toggle value={metrics} onChange={markDirty(setMetrics)} />
        </FieldRow>
        <FieldRow label="Export logs" desc="Forward structured logs to the collector in addition to file/console.">
          <Toggle value={logs} onChange={markDirty(setLogs)} />
        </FieldRow>

        {/* sampleRate (D5=A slider with marks) */}
        <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Sample rate</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Fraction of traces sent to the collector. 1.0 = all, 0.1 = 10%, 0.0 = none.
              </div>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem',
                color: 'var(--amber)',
                fontWeight: 600,
              }}
            >
              {sampleRate.toFixed(2)}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={sampleRate}
            onChange={(e) => {
              setSampleRate(parseFloat(e.target.value));
              setDirty(true);
            }}
            list="sample-rate-marks"
            style={{ width: '100%', accentColor: 'var(--amber)' }}
          />
          <datalist id="sample-rate-marks">
            {SAMPLE_MARKS.map((m) => <option key={m} value={m} label={`${(m * 100).toFixed(0)}%`} />)}
          </datalist>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 4,
              fontSize: '0.625rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>0%</span>
            <span>1%</span>
            <span>10%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* flushIntervalMs */}
        <FieldRow label="Flush interval (ms)" desc="How often the collector pushes batched spans/metrics. Lower = more requests, lower latency.">
          <input
            type="number"
            value={flushIntervalMs}
            onChange={(e) => {
              setFlushIntervalMs(Math.max(0, parseInt(e.target.value, 10) || 0));
              setDirty(true);
            }}
            min={0}
            max={300000}
            style={{ ...inputStyle(), width: 120 }}
          />
        </FieldRow>

        {/* headers (D4=A) */}
        <div style={{ marginTop: 24 }}>
          <h4
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-dim)',
              margin: '0 0 4px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Headers
          </h4>
          <p style={{ margin: '0 0 10px', fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            HTTP headers sent with every export request. Examples: <code>Authorization: Basic ...</code> for Grafana Cloud,{' '}
            <code>x-honeycomb-team: ...</code> for Honeycomb, <code>DD-API-KEY: ...</code> for Datadog.
          </p>
          <KeyValueListEditor
            entries={headerEntries}
            onChange={(e) => { setHeaderEntries(e); setDirty(true); }}
            keyPlaceholder="Authorization"
            valuePlaceholder="Basic ..."
            valueIsSecret={true}
            keyWidth={220}
            addLabel="Add header"
          />
        </div>
      </fieldset>

      {/* Footer hint when no plugin */}
      {!pluginEnabled && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '10px 14px',
            marginTop: 16,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
          }}
        >
          <Activity size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          The form below is disabled until you enable the diagnostics-otel plugin above. Once enabled, all the fields
          become editable and your save will be applied.
        </div>
      )}
    </SectionShell>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function FieldRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <ToggleSwitch checked={value} onChange={onChange} />;
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '4px 8px',
        fontSize: '0.75rem',
        minWidth: 140,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text)',
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function inputStyle() {
  return {
    padding: '6px 10px',
    fontSize: '0.75rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  };
}
