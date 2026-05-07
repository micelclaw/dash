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

// ─── Logging Section (Ola 7, oc7-1.1) ───────────────────────────────
//
// Controls the `logging.*` section of openclaw.json — NOT Core's pino logger.
// Three didactic presets (Quiet/Normal/Debug, decision D1=A) plus fine-tune
// controls for level, console style, file path, redaction.
//
// redactPatterns is edited as an add/remove list with live regex validation
// (decision D2=B). Save is disabled if any pattern is invalid.

import { useState, useEffect, useCallback } from 'react';
import { Info, VolumeX, Activity, Bug, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import type { LoggingConfig } from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { SectionShell } from '../shared/SectionShell';

// ─── Presets (D1=A) ──────────────────────────────────────────────────

interface Preset {
  id: 'quiet' | 'normal' | 'debug';
  name: string;
  icon: typeof VolumeX;
  desc: string;
  warning?: string;
  config: Required<Pick<LoggingConfig, 'level' | 'console_level' | 'console_style' | 'redact_sensitive'>> & {
    file: string;
  };
}

const PRESETS: Preset[] = [
  {
    id: 'quiet',
    name: 'Quiet',
    icon: VolumeX,
    desc: 'warn level only, compact console. Ideal for production where you only want to know about real problems.',
    config: { level: 'warn', console_level: 'warn', console_style: 'compact', file: '', redact_sensitive: 'tools' },
  },
  {
    id: 'normal',
    name: 'Normal',
    icon: Activity,
    desc: 'info level, pretty console. Good default for most users.',
    config: { level: 'info', console_level: 'info', console_style: 'pretty', file: '', redact_sensitive: 'tools' },
  },
  {
    id: 'debug',
    name: 'Debug',
    icon: Bug,
    desc: 'debug level, pretty console, written to ~/.openclaw/openclaw-debug.log. Use temporarily when hunting a bug.',
    warning: 'Writes to disk. Remember to switch back to Normal when you finish debugging — debug logs grow fast.',
    config: { level: 'debug', console_level: 'debug', console_style: 'pretty', file: '~/.openclaw/openclaw-debug.log', redact_sensitive: 'tools' },
  },
];

const LEVELS = ['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace'];
const CONSOLE_STYLES = ['pretty', 'compact', 'json'];

// ─── Helper: validate a regex pattern ────────────────────────────────

function validateRegex(pattern: string): string | null {
  if (!pattern.trim()) return 'Pattern cannot be empty';
  try {
    new RegExp(pattern);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid regex';
  }
}

// ─── Component ───────────────────────────────────────────────────────

export function LoggingSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [level, setLevel] = useState<string>('info');
  const [consoleLevel, setConsoleLevel] = useState<string>('info');
  const [consoleStyle, setConsoleStyle] = useState<string>('pretty');
  const [file, setFile] = useState<string>('');
  const [maxFileBytes, setMaxFileBytes] = useState<number>(10 * 1024 * 1024);
  const [redactSensitive, setRedactSensitive] = useState<string>('tools');
  const [patterns, setPatterns] = useState<string[]>([]);
  const [patternErrors, setPatternErrors] = useState<(string | null)[]>([]);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getLoggingConfig();
      setLevel(data.level ?? 'info');
      setConsoleLevel(data.console_level ?? 'info');
      setConsoleStyle(data.console_style ?? 'pretty');
      setFile(data.file ?? '');
      setMaxFileBytes(data.max_file_bytes ?? 10 * 1024 * 1024);
      setRedactSensitive(data.redact_sensitive ?? 'tools');
      const initialPatterns = data.redact_patterns ?? [];
      setPatterns(initialPatterns);
      setPatternErrors(initialPatterns.map((p) => validateRegex(p)));
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to load logging config'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const applyPreset = (preset: Preset) => {
    const c = preset.config;
    setLevel(c.level);
    setConsoleLevel(c.console_level);
    setConsoleStyle(c.console_style);
    setFile(c.file);
    setRedactSensitive(c.redact_sensitive);
    setDirty(true);
  };

  const addPattern = () => {
    setPatterns((prev) => [...prev, '']);
    setPatternErrors((prev) => [...prev, 'Pattern cannot be empty']);
    setDirty(true);
  };

  const removePattern = (index: number) => {
    setPatterns((prev) => prev.filter((_, i) => i !== index));
    setPatternErrors((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const updatePattern = (index: number, value: string) => {
    setPatterns((prev) => prev.map((p, i) => (i === index ? value : p)));
    setPatternErrors((prev) => prev.map((e, i) => (i === index ? validateRegex(value) : e)));
    setDirty(true);
  };

  const hasInvalidPattern = patternErrors.some((e) => e !== null);

  const handleSave = async () => {
    if (hasInvalidPattern) {
      toast.error('Fix invalid regex patterns before saving');
      return;
    }
    setSaving(true);
    try {
      await gwService.updateLoggingConfig({
        level,
        console_level: consoleLevel,
        console_style: consoleStyle,
        file: file || undefined,
        max_file_bytes: maxFileBytes,
        redact_sensitive: redactSensitive,
        redact_patterns: patterns,
      });
      toast.success('Logging saved');
      setDirty(false);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message ?? 'Failed to update logging config');
      // The most common cause of a backend reject (with the form
      // having passed local validation) is a regex the JS engine
      // accepts but Go's regexp doesn't (e.g. lookbehind, named
      // groups). Refetch the canonical state so the dirty marker
      // reflects what's actually persisted.
      await fetchConfig();
    } finally {
      setSaving(false);
    }
  };

  // Detect active preset
  const currentPreset = PRESETS.find(
    (p) =>
      p.config.level === level &&
      p.config.console_level === consoleLevel &&
      p.config.console_style === consoleStyle,
  );

  return (
    <SectionShell
      title="Logging"
      description="Configure how OpenClaw writes its own logs (level, file, console style, redaction)."
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
      saveDisabledReason={hasInvalidPattern ? 'Fix invalid regex patterns before saving' : null}
      appliesAt="gateway-restart"
    >
      {/* Info box */}
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
          <strong style={{ color: 'var(--text)' }}>About OpenClaw logging:</strong> these settings control logs that
          OpenClaw produces (the ones you see in the Logs viewer under Gateway). They are independent of Core&apos;s own
          logger. Use the <code>Quiet</code> preset for production noise floors, <code>Normal</code> for daily use, and
          <code> Debug</code> only when you need to capture deep traces to a file.
        </div>
      </div>

      {/* Presets */}
      <div style={{ marginBottom: 24 }}>
        <h3
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-dim)',
            margin: '0 0 8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Quick Presets
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const isActive = currentPreset?.id === p.id;
            return (
              <div
                key={p.id}
                onClick={() => applyPreset(p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: isActive ? 'var(--surface-hover)' : 'var(--surface)',
                  border: isActive ? '1px solid var(--amber-dim)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-sm)',
                    background: isActive ? '#d4a01718' : 'var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} style={{ color: isActive ? 'var(--amber)' : 'var(--text-dim)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
                    {p.name}
                    {isActive && (
                      <span style={{ fontSize: '0.625rem', color: 'var(--amber)', marginLeft: 8, fontWeight: 600 }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 2 }}>{p.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
        {currentPreset?.id === 'debug' && currentPreset.warning && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              padding: '10px 14px',
              marginTop: 8,
              background: '#f59e0b15',
              border: '1px solid #f59e0b30',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              {currentPreset.warning}
            </div>
          </div>
        )}
      </div>

      {/* Fine tune */}
      <h3
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--text-dim)',
          margin: '0 0 8px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Fine-Tune
      </h3>

      {/* level */}
      <FieldRow
        label="File log level"
        desc="Severity threshold for the log file (silent disables file logging entirely)."
      >
        <Select value={level} onChange={(v) => { setLevel(v); setDirty(true); }} options={LEVELS} />
      </FieldRow>

      {/* console level */}
      <FieldRow
        label="Console log level"
        desc="Severity threshold for console output (independent from file). Use a quieter level to keep the terminal clean."
      >
        <Select value={consoleLevel} onChange={(v) => { setConsoleLevel(v); setDirty(true); }} options={LEVELS} />
      </FieldRow>

      {/* console style */}
      <FieldRow
        label="Console style"
        desc="pretty = colored & human-readable. compact = single-line. json = structured for log shippers."
      >
        <Select value={consoleStyle} onChange={(v) => { setConsoleStyle(v); setDirty(true); }} options={CONSOLE_STYLES} />
      </FieldRow>

      {/* file */}
      <FieldRow
        label="Log file path"
        desc="Absolute path where OpenClaw appends its log file. Leave empty for stdout-only."
      >
        <input
          type="text"
          value={file}
          onChange={(e) => { setFile(e.target.value); setDirty(true); }}
          placeholder="/tmp/openclaw/openclaw.log"
          style={inputStyle()}
        />
      </FieldRow>

      {/* max file bytes */}
      <FieldRow
        label="Max file size (MB)"
        desc="Rotate the log file when it exceeds this size. Set 0 to disable rotation."
      >
        <input
          type="number"
          value={Math.round(maxFileBytes / (1024 * 1024))}
          onChange={(e) => {
            const mb = Math.max(0, parseInt(e.target.value, 10) || 0);
            setMaxFileBytes(mb * 1024 * 1024);
            setDirty(true);
          }}
          min={0}
          max={2048}
          style={{ ...inputStyle(), width: 100 }}
        />
      </FieldRow>

      {/* redact sensitive */}
      <FieldRow
        label="Redact sensitive data"
        desc="`tools` (default): scrub known secret formats from tool input/output. `off`: log everything as-is."
      >
        <Select
          value={redactSensitive}
          onChange={(v) => { setRedactSensitive(v); setDirty(true); }}
          options={['tools', 'off']}
        />
      </FieldRow>

      {/* redact patterns (D2=B) */}
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
          Redact Patterns
        </h4>
        <p style={{ margin: '0 0 10px', fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Custom regex patterns to scrub from logs before writing. Matches are replaced with{' '}
          <code style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: 3 }}>[REDACTED]</code>. Uses
          JavaScript regex syntax. Useful for company-internal token formats not covered by the default redaction.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {patterns.map((pattern, i) => {
            const error = patternErrors[i];
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="text"
                    value={pattern}
                    onChange={(e) => updatePattern(i, e.target.value)}
                    placeholder="\bghp_[a-zA-Z0-9]{36}\b"
                    style={{
                      ...inputStyle(),
                      flex: 1,
                      borderColor: error ? '#ef4444' : 'var(--border)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                  <button
                    onClick={() => removePattern(i)}
                    style={{
                      padding: 6,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                    }}
                    title="Remove pattern"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {error && (
                  <div style={{ fontSize: '0.6875rem', color: '#ef4444', marginLeft: 2, fontFamily: 'var(--font-mono)' }}>
                    ⚠ {error}
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={addPattern}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              marginTop: patterns.length > 0 ? 4 : 0,
              background: 'transparent',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              alignSelf: 'flex-start',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Plus size={14} /> Add pattern
          </button>
        </div>
      </div>
    </SectionShell>
  );
}

// ─── Local helpers ───────────────────────────────────────────────────

function FieldRow({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: React.ReactNode;
}) {
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

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '4px 8px',
        fontSize: '0.75rem',
        minWidth: 120,
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
