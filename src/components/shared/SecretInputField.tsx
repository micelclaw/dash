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

// ─── SecretInputField (Ola 7, oc7-6.2 — stub for B post-MVP) ────────
//
// Reusable input that lets the user enter a sensitive value either as
// plain text or as a reference to an OpenClaw secret provider. The
// reference shape matches OpenClaw's `SecretInput` type:
//
//   string | { source: 'env'|'file'|'exec', provider: string, id: string }
//
// Decision (D15=A): the component is BUILT in Ola 7 but NOT WIRED into
// any existing input. The migration of model providers / channel tokens /
// talk.apiKey / etc. to use this component is deferred to post-MVP
// (D15 option B). When that happens, the existing token inputs swap
// their <input> for <SecretInputField> in the same PR.
//
// This file currently has no imports from outside `dash/src/components/`,
// so it's safe to ship as a no-op stub: it compiles, it renders, but
// nothing in the dash uses it yet.

import { useState, useEffect } from 'react';
import type { SecretProvider } from '@/services/gateway.service';

export type SecretInputValue =
  | { mode: 'plain'; value: string }
  | { mode: 'ref'; source: 'env' | 'file' | 'exec'; provider: string; id: string };

export interface SecretInputFieldProps {
  value: SecretInputValue;
  onChange: (value: SecretInputValue) => void;
  /**
   * Map of provider name → provider config. Pass the result of
   * `getSecretsConfig().providers` here. Used to populate the dropdown
   * when mode === 'ref'.
   */
  providers?: Record<string, SecretProvider>;
  /** Visible label for the field. */
  label?: string;
  /** Placeholder for the plain-text input. */
  placeholder?: string;
  /** Show the plain text as a password. Default true. */
  isSecret?: boolean;
}

export function SecretInputField({
  value,
  onChange,
  providers = {},
  label,
  placeholder = 'Enter secret',
  isSecret = true,
}: SecretInputFieldProps) {
  const [mode, setMode] = useState<'plain' | 'ref'>(value.mode);

  // Keep local mode in sync with external value updates
  useEffect(() => {
    setMode(value.mode);
  }, [value.mode]);

  const switchToPlain = () => {
    setMode('plain');
    onChange({ mode: 'plain', value: '' });
  };

  const switchToRef = () => {
    setMode('ref');
    onChange({ mode: 'ref', source: 'env', provider: '', id: '' });
  };

  // Filter providers by source for the second dropdown
  const providersBySource = (source: 'env' | 'file' | 'exec') =>
    Object.entries(providers)
      .filter(([, p]) => p.source === source)
      .map(([name]) => name);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 500 }}>{label}</div>
      )}

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        <ModeButton active={mode === 'plain'} onClick={switchToPlain} label="Plain text" />
        <ModeButton active={mode === 'ref'} onClick={switchToRef} label="Reference" />
      </div>

      {mode === 'plain' && value.mode === 'plain' && (
        <input
          type={isSecret ? 'password' : 'text'}
          value={value.value}
          onChange={(e) => onChange({ mode: 'plain', value: e.target.value })}
          placeholder={placeholder}
          style={inputStyle()}
        />
      )}

      {mode === 'ref' && value.mode === 'ref' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Source */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <label style={subLabelStyle()}>Source</label>
            <select
              value={value.source}
              onChange={(e) =>
                onChange({
                  mode: 'ref',
                  source: e.target.value as 'env' | 'file' | 'exec',
                  provider: '',
                  id: value.id,
                })
              }
              style={{ ...inputStyle(), width: 100 }}
            >
              <option value="env">env</option>
              <option value="file">file</option>
              <option value="exec">exec</option>
            </select>
          </div>

          {/* Provider */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <label style={subLabelStyle()}>Provider</label>
            <select
              value={value.provider}
              onChange={(e) => onChange({ ...value, provider: e.target.value })}
              style={{ ...inputStyle(), flex: 1 }}
            >
              <option value="">— select —</option>
              {providersBySource(value.source).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Id */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <label style={subLabelStyle()}>Id</label>
            <input
              type="text"
              value={value.id}
              onChange={(e) => onChange({ ...value, id: e.target.value })}
              placeholder={
                value.source === 'env'
                  ? 'ENV_VAR_NAME'
                  : value.source === 'file'
                  ? 'json.path.to.key'
                  : 'op://Vault/Item/credential'
              }
              style={{ ...inputStyle(), flex: 1, fontFamily: 'var(--font-mono)' }}
            />
          </div>

          {Object.keys(providers).length === 0 && (
            <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', margin: 0 }}>
              No secret providers configured. Create one in Settings → Secrets.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ModeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        padding: '4px 10px',
        fontSize: '0.6875rem',
        background: active ? 'var(--amber-dim)' : 'transparent',
        color: active ? 'var(--amber)' : 'var(--text-dim)',
        border: '1px solid ' + (active ? 'transparent' : 'var(--border)'),
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
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

function subLabelStyle() {
  return {
    fontSize: '0.625rem',
    color: 'var(--text-muted)',
    minWidth: 60,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  };
}
