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

// ─── KeyValueListEditor (Ola 7 shared component) ────────────────────
//
// Generic add/remove list of (key, value) pairs with optional per-key
// validation. Used by:
//   - TelemetrySection.tsx (D4=A): OTel headers (Authorization, x-honeycomb-team, etc.)
//   - EnvSection.tsx (Ola 7 oc7-6.1): env.vars (KEY=value globals)
//
// Pure component: parent owns the entries array. The editor mirrors that
// array with internal validation errors and reports changes via onChange.

import { Plus, Trash2 } from 'lucide-react';

export interface KeyValueEntry {
  key: string;
  value: string;
}

export interface KeyValueListEditorProps {
  entries: KeyValueEntry[];
  onChange: (entries: KeyValueEntry[]) => void;
  /** Validate a key string. Return null if valid, error message otherwise. */
  validateKey?: (key: string) => string | null;
  /** Placeholder for the key input. */
  keyPlaceholder?: string;
  /** Placeholder for the value input. */
  valuePlaceholder?: string;
  /** Whether to show the value input as a password (for OTel headers like Authorization). */
  valueIsSecret?: boolean;
  /**
   * Optional per-row predicate. When `valueIsSecret` is false, this is
   * called with each row's key to decide if that specific value should
   * be masked. Lets EnvSection mask only secret-looking entries
   * (`API_KEY=...`) while leaving benign ones (`TZ=Europe/Madrid`)
   * readable.
   */
  valueIsSecretByKey?: (key: string) => boolean;
  /** Width of the key input column in pixels. Default 220. */
  keyWidth?: number;
  /** Label for the "add" button. Default "Add entry". */
  addLabel?: string;
}

export function KeyValueListEditor({
  entries,
  onChange,
  validateKey,
  keyPlaceholder = 'KEY',
  valuePlaceholder = 'value',
  valueIsSecret = false,
  valueIsSecretByKey,
  keyWidth = 220,
  addLabel = 'Add entry',
}: KeyValueListEditorProps) {
  const updateKey = (index: number, key: string) => {
    onChange(entries.map((e, i) => (i === index ? { ...e, key } : e)));
  };

  const updateValue = (index: number, value: string) => {
    onChange(entries.map((e, i) => (i === index ? { ...e, value } : e)));
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const addEntry = () => {
    onChange([...entries, { key: '', value: '' }]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map((entry, i) => {
        const error = validateKey ? validateKey(entry.key) : null;
        const rowIsSecret =
          valueIsSecret || (valueIsSecretByKey?.(entry.key) ?? false);
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="text"
                value={entry.key}
                onChange={(e) => updateKey(i, e.target.value)}
                placeholder={keyPlaceholder}
                style={{
                  ...inputStyle(),
                  width: keyWidth,
                  flexShrink: 0,
                  borderColor: error ? '#ef4444' : 'var(--border)',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <input
                type={rowIsSecret ? 'password' : 'text'}
                value={entry.value}
                onChange={(e) => updateValue(i, e.target.value)}
                placeholder={valuePlaceholder}
                style={{
                  ...inputStyle(),
                  flex: 1,
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <button
                onClick={() => removeEntry(i)}
                style={{
                  padding: 6,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                }}
                title="Remove entry"
              >
                <Trash2 size={14} />
              </button>
            </div>
            {error && (
              <div
                style={{
                  fontSize: '0.6875rem',
                  color: '#ef4444',
                  marginLeft: 2,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ⚠ {error}
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={addEntry}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          marginTop: entries.length > 0 ? 4 : 0,
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
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}

/**
 * Convert KeyValueEntry[] to a plain `Record<string, string>`. Empty keys
 * are dropped. Duplicate keys: last one wins.
 */
export function entriesToRecord(entries: KeyValueEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { key, value } of entries) {
    if (key.trim()) out[key] = value;
  }
  return out;
}

/** Convert a `Record<string, string>` to KeyValueEntry[] (sorted by key). */
export function recordToEntries(record: Record<string, string> | undefined): KeyValueEntry[] {
  if (!record) return [];
  return Object.entries(record)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, value }));
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
