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

// ─── Environment Section (Ola 7, oc7-6.1) ───────────────────────────
//
// Manages `env.*` of openclaw.json: shellEnv (inherit user shell env)
// and vars (explicit globals injected into all OpenClaw child processes).
//
// Decisions applied:
//   D14=B — manual editor only, no .env import
//
// Important: this is for non-sensitive globals. Secrets must use the
// Secrets Section (oc7-6.2) which uses OpenClaw secret providers
// instead of plain values in openclaw.json.

import { useState, useEffect, useCallback } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import {
  KeyValueListEditor,
  entriesToRecord,
  recordToEntries,
  type KeyValueEntry,
} from '@/components/settings/shared/KeyValueListEditor';

const ENV_KEY_REGEX = /^[A-Z_][A-Z0-9_]*$/;

function validateEnvKey(key: string): string | null {
  if (!key.trim()) return null; // empty key just means "ignore this row" — handled in entriesToRecord
  if (!ENV_KEY_REGEX.test(key)) {
    return 'Use UPPER_SNAKE_CASE (letters, digits, underscores; cannot start with a digit)';
  }
  return null;
}

export function EnvSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [shellEnvEnabled, setShellEnvEnabled] = useState(true);
  const [shellEnvTimeoutMs, setShellEnvTimeoutMs] = useState(5000);
  const [varEntries, setVarEntries] = useState<KeyValueEntry[]>([]);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getEnvConfig();
      setShellEnvEnabled(data.shell_env?.enabled ?? true);
      setShellEnvTimeoutMs(data.shell_env?.timeout_ms ?? 5000);
      setVarEntries(recordToEntries(data.vars));
      setDirty(false);
    } catch {
      toast.error('Failed to load env config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const hasInvalidKey = varEntries.some((e) => validateEnvKey(e.key) !== null);

  const handleSave = async () => {
    if (hasInvalidKey) {
      toast.error('Fix invalid env keys before saving');
      return;
    }
    setSaving(true);
    try {
      await gwService.updateEnvConfig({
        shell_env: { enabled: shellEnvEnabled, timeout_ms: shellEnvTimeoutMs },
        vars: entriesToRecord(varEntries),
      });
      toast.success('Env config updated');
      setDirty(false);
    } catch {
      toast.error('Failed to update env config');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>Environment</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            Global environment variables injected into every OpenClaw child process (tools, plugins, agents).
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!dirty || saving || hasInvalidKey}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 14px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            background: dirty && !hasInvalidKey ? 'var(--amber)' : 'var(--surface)',
            border: dirty && !hasInvalidKey ? 'none' : '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: dirty && !hasInvalidKey ? '#000' : 'var(--text-muted)',
            cursor: dirty && !hasInvalidKey ? 'pointer' : 'default',
            opacity: saving ? 0.7 : 1,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Save size={14} /> {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>

      {/* Warning */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: '12px 14px',
          marginBottom: 20,
          background: '#f59e0b15',
          border: '1px solid #f59e0b40',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text)' }}>Do not put secrets here.</strong> Values are stored in plaintext in
          <code> openclaw.json</code>. For API keys, tokens, and credentials, use the Secrets Section instead — it can
          read from environment variables, files, or external commands without writing the secret to disk.
        </div>
      </div>

      {/* shellEnv */}
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
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Inherit shell environment</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            On boot, OpenClaw runs your login shell once and merges its env vars (PATH, locale, NVM, ...) into the
            global environment. Useful when CLIs are installed via nvm, asdf, brew shellenv, etc.
          </div>
        </div>
        <div
          onClick={() => {
            setShellEnvEnabled((v) => !v);
            setDirty(true);
          }}
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            cursor: 'pointer',
            background: shellEnvEnabled ? 'var(--success, #22c55e)' : 'var(--text-muted)',
            position: 'relative',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#fff',
              position: 'absolute',
              top: 2,
              left: shellEnvEnabled ? 18 : 2,
              transition: 'left 0.2s',
            }}
          />
        </div>
      </div>

      {shellEnvEnabled && (
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
            <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Shell timeout (ms)</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Maximum time to wait for the login shell to print its env vars. Increase if your shell rc is slow.
            </div>
          </div>
          <input
            type="number"
            value={shellEnvTimeoutMs}
            onChange={(e) => {
              setShellEnvTimeoutMs(Math.max(0, parseInt(e.target.value, 10) || 0));
              setDirty(true);
            }}
            min={0}
            max={60000}
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              width: 100,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* vars editor */}
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
          Variables
        </h4>
        <p style={{ margin: '0 0 10px', fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Each row sets one environment variable. Keys must be UPPER_SNAKE_CASE. Empty rows are ignored. Changes
          take effect after the Gateway is restarted.
        </p>

        <KeyValueListEditor
          entries={varEntries}
          onChange={(e) => {
            setVarEntries(e);
            setDirty(true);
          }}
          validateKey={validateEnvKey}
          keyPlaceholder="MY_VAR"
          valuePlaceholder="value"
          keyWidth={220}
          addLabel="Add variable"
        />
      </div>
    </div>
  );
}
