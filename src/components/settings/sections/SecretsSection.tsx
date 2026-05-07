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

// ─── Secrets Section (Ola 7, oc7-6.2) ───────────────────────────────
//
// Manages OpenClaw secret providers (`secrets.providers.*` in
// openclaw.json). Three provider types: env, file, exec.
//
// Decisions applied:
//   D15=A — providers editor only in Ola 7. SecretInputField is built
//           but NOT wired to any existing token input — that migration
//           is deferred to post-MVP (D15 option B).
//   D16=A — Test button per provider with modal asking for an id;
//           the resolved value never reaches the frontend.
//   D17=A — confirm modal interstitial when adding an Exec provider.
//   Section is admin-only (sidebar entry hidden for non-admin, backend
//   endpoints enforce requireAdmin).

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Pencil, FlaskConical, Shield, FileText, Terminal, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import type {
  SecretProvider,
  EnvProvider,
  FileProvider,
  ExecProvider,
} from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { SectionShell } from '../shared/SectionShell';
import { ToggleSwitch } from '../shared/ToggleSwitch';

// ─── Helpers ─────────────────────────────────────────────────────────

function defaultProvider(source: 'env' | 'file' | 'exec'): SecretProvider {
  if (source === 'env') return { source: 'env', allowlist: [] };
  if (source === 'file') return { source: 'file', path: '', mode: 'singleValue' };
  return { source: 'exec', command: '', args: [] };
}

function providerIcon(source: string) {
  if (source === 'env') return Shield;
  if (source === 'file') return FileText;
  return Terminal;
}

function providerSummary(p: SecretProvider): string {
  if (p.source === 'env') {
    const list = p.allowlist ?? [];
    return list.length > 0 ? `Allowlist: ${list.slice(0, 3).join(', ')}${list.length > 3 ? '…' : ''}` : 'No allowlist';
  }
  if (p.source === 'file') return `Path: ${p.path || '(unset)'} (mode: ${p.mode ?? 'singleValue'})`;
  return `Command: ${p.command || '(unset)'}${(p.args ?? []).length ? ' ' + (p.args ?? []).join(' ') : ''}`;
}

// ─── Component ───────────────────────────────────────────────────────

export function SecretsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [providers, setProviders] = useState<Record<string, SecretProvider>>({});
  const [editingName, setEditingName] = useState<string | null>(null);

  // Confirm-once-per-session for ExecProvider creation (D17=A)
  const [execConfirmedThisSession, setExecConfirmedThisSession] = useState(false);
  const [showExecConfirmModal, setShowExecConfirmModal] = useState(false);

  // Test modal state (D16=A)
  const [testModal, setTestModal] = useState<{ providerName: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getSecretsConfig();
      setProviders(data.providers ?? {});
      setDirty(false);
    } catch (err) {
      // 403 = non-admin (section should not even be reachable, but defend anyway)
      toast.error(
        describeError(err, 'Failed to load secrets config', {
          status: { 403: 'Admin role required' },
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Reject save if any FileProvider has a non-absolute path. Catches
  // typos before they hit the runtime resolver where they fail
  // silently from the dash's POV.
  const hasInvalidFilePath = Object.values(providers).some((p) => {
    if (p.source !== 'file') return false;
    const path = (p as FileProvider).path ?? '';
    return path.length > 0 && !path.startsWith('/') && !path.startsWith('~/');
  });

  const handleSave = async () => {
    if (hasInvalidFilePath) {
      toast.error('One file provider has an invalid path — must start with / or ~/');
      return;
    }
    setSaving(true);
    try {
      await gwService.updateSecretsConfig({ providers });
      toast.success('Secrets saved');
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to update secrets config'));
    } finally {
      setSaving(false);
    }
  };

  const addProvider = (source: 'env' | 'file' | 'exec') => {
    if (source === 'exec' && !execConfirmedThisSession) {
      setShowExecConfirmModal(true);
      return;
    }
    // Generate a unique placeholder name
    let i = 1;
    let name = `${source}-${i}`;
    while (providers[name]) {
      i++;
      name = `${source}-${i}`;
    }
    setProviders({ ...providers, [name]: defaultProvider(source) });
    setEditingName(name);
    setDirty(true);
  };

  const confirmExecCreate = () => {
    setExecConfirmedThisSession(true);
    setShowExecConfirmModal(false);
    // Now actually create the exec provider
    let i = 1;
    let name = `exec-${i}`;
    while (providers[name]) {
      i++;
      name = `exec-${i}`;
    }
    setProviders({ ...providers, [name]: defaultProvider('exec') });
    setEditingName(name);
    setDirty(true);
  };

  const removeProvider = (name: string) => {
    const { [name]: _omit, ...rest } = providers;
    void _omit;
    setProviders(rest);
    if (editingName === name) setEditingName(null);
    setDirty(true);
  };

  const renameProvider = (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) return;
    if (providers[newName]) {
      toast.error('A provider with that name already exists');
      return;
    }
    const next: Record<string, SecretProvider> = {};
    for (const [k, v] of Object.entries(providers)) {
      next[k === oldName ? newName : k] = v;
    }
    setProviders(next);
    setEditingName(newName);
    setDirty(true);
  };

  const updateProvider = (name: string, updates: Partial<SecretProvider>) => {
    const current = providers[name];
    if (!current) return;
    setProviders({ ...providers, [name]: { ...current, ...updates } as SecretProvider });
    setDirty(true);
  };

  const providerList = Object.entries(providers);

  return (
    <SectionShell
      title="Secrets"
      description="Provider-based secret resolution. Reference values from env, files, or external commands without writing them to disk."
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
      saveDisabledReason={hasInvalidFilePath ? 'Fix the invalid file path before saving' : null}
    >

      {/* Add buttons */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <AddButton icon={Shield} label="Add Env Provider" onClick={() => addProvider('env')} />
        <AddButton icon={FileText} label="Add File Provider" onClick={() => addProvider('file')} />
        <AddButton icon={Terminal} label="Add Exec Provider" onClick={() => addProvider('exec')} warning />
      </div>

      {/* Provider list */}
      {providerList.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          No providers configured yet. Click one of the buttons above to create your first provider.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {providerList.map(([name, provider]) => (
            <ProviderCard
              key={name}
              name={name}
              provider={provider}
              editing={editingName === name}
              onEdit={() => setEditingName(editingName === name ? null : name)}
              onRename={(newName) => renameProvider(name, newName)}
              onUpdate={(updates) => updateProvider(name, updates)}
              onDelete={() => removeProvider(name)}
              onTest={() => setTestModal({ providerName: name })}
            />
          ))}
        </div>
      )}

      {/* Exec confirm modal */}
      {showExecConfirmModal && (
        <ExecConfirmModal onCancel={() => setShowExecConfirmModal(false)} onConfirm={confirmExecCreate} />
      )}

      {/* Test modal */}
      {testModal && (
        <TestProviderModal
          providerName={testModal.providerName}
          onClose={() => setTestModal(null)}
        />
      )}
    </SectionShell>
  );
}

// ─── Provider Card ───────────────────────────────────────────────────

function ProviderCard({
  name,
  provider,
  editing,
  onEdit,
  onRename,
  onUpdate,
  onDelete,
  onTest,
}: {
  name: string;
  provider: SecretProvider;
  editing: boolean;
  onEdit: () => void;
  onRename: (newName: string) => void;
  onUpdate: (updates: Partial<SecretProvider>) => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  const Icon = providerIcon(provider.source);
  const isExec = provider.source === 'exec';
  const [localName, setLocalName] = useState(name);
  useEffect(() => setLocalName(name), [name]);

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: editing ? 'var(--surface-hover)' : 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <Icon
          size={18}
          style={{ color: isExec ? '#f59e0b' : 'var(--text-dim)', flexShrink: 0 }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>{name}</span>
            <span
              style={{
                fontSize: '0.625rem',
                color: 'var(--text-muted)',
                background: 'var(--border)',
                padding: '1px 6px',
                borderRadius: 8,
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              {provider.source}
            </span>
            {isExec && (
              <span
                title="Exec providers run an arbitrary command on every resolve"
                style={{ display: 'inline-flex', color: '#f59e0b' }}
              >
                <AlertTriangle size={12} />
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 2 }}>
            {providerSummary(provider)}
          </div>
        </div>
        <button onClick={onTest} title="Test provider" style={iconButtonStyle()}>
          <FlaskConical size={14} />
        </button>
        <button onClick={onEdit} title={editing ? 'Close editor' : 'Edit'} style={iconButtonStyle()}>
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} title="Remove provider" style={iconButtonStyle()}>
          <Trash2 size={14} />
        </button>
      </div>

      {/* Editor */}
      {editing && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          {/* Name */}
          <FieldRow label="Name" desc="Identifier used by SecretInput refs.">
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={() => onRename(localName)}
              style={{ ...inputStyle(), width: 220, fontFamily: 'var(--font-mono)' }}
            />
          </FieldRow>

          {provider.source === 'env' && <EnvProviderEditor provider={provider} onUpdate={onUpdate} />}
          {provider.source === 'file' && <FileProviderEditor provider={provider} onUpdate={onUpdate} />}
          {provider.source === 'exec' && <ExecProviderEditor provider={provider} onUpdate={onUpdate} />}
        </div>
      )}
    </div>
  );
}

// ─── Per-source editors ──────────────────────────────────────────────

function EnvProviderEditor({
  provider,
  onUpdate,
}: {
  provider: EnvProvider;
  onUpdate: (updates: Partial<SecretProvider>) => void;
}) {
  const [text, setText] = useState((provider.allowlist ?? []).join('\n'));
  useEffect(() => setText((provider.allowlist ?? []).join('\n')), [provider.allowlist]);

  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text)' }}>Allowlist</div>
      <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '2px 0 6px' }}>
        Names of environment variables this provider is allowed to read. One per line. Anything not in this list will
        be rejected even if it exists in process.env.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const list = text
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
          onUpdate({ allowlist: list } as Partial<SecretProvider>);
        }}
        rows={4}
        placeholder={'GH_TOKEN\nANTHROPIC_KEY\nOPENAI_KEY'}
        style={{ ...inputStyle(), width: '100%', fontFamily: 'var(--font-mono)', resize: 'vertical' }}
      />
    </div>
  );
}

function FileProviderEditor({
  provider,
  onUpdate,
}: {
  provider: FileProvider;
  onUpdate: (updates: Partial<SecretProvider>) => void;
}) {
  // Path must be absolute (Unix /... or starting with ~/ for the user
  // home). The runtime resolver fails on relative paths, but with no
  // surface error in the dash — flag at config time instead.
  const pathInvalid =
    provider.path.length > 0 &&
    !provider.path.startsWith('/') &&
    !provider.path.startsWith('~/');

  return (
    <div>
      <FieldRow label="File path" desc="Absolute path to the file holding the secret(s). Use /... or ~/...">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <input
            type="text"
            value={provider.path}
            onChange={(e) => onUpdate({ path: e.target.value } as Partial<SecretProvider>)}
            placeholder="/etc/openclaw/secrets.json"
            style={{
              ...inputStyle(),
              width: 320,
              fontFamily: 'var(--font-mono)',
              borderColor: pathInvalid ? '#ef4444' : 'var(--border)',
            }}
          />
          {pathInvalid && (
            <span style={{ fontSize: '0.6875rem', color: '#ef4444', fontFamily: 'var(--font-sans)' }}>
              ! Use an absolute path (/...) or ~/...
            </span>
          )}
        </div>
      </FieldRow>
      <FieldRow label="Mode" desc="`singleValue`: file content is the secret. `json`: file is JSON, id is a JSON path.">
        <select
          value={provider.mode ?? 'singleValue'}
          onChange={(e) => onUpdate({ mode: e.target.value as 'singleValue' | 'json' } as Partial<SecretProvider>)}
          style={{ ...inputStyle(), width: 140 }}
        >
          <option value="singleValue">singleValue</option>
          <option value="json">json</option>
        </select>
      </FieldRow>
      <FieldRow label="Timeout (ms)" desc="Max time to wait for the file read.">
        <input
          type="number"
          value={provider.timeout_ms ?? 5000}
          onChange={(e) => onUpdate({ timeout_ms: parseInt(e.target.value, 10) || 5000 } as Partial<SecretProvider>)}
          min={100}
          max={120000}
          style={{ ...inputStyle(), width: 100 }}
        />
      </FieldRow>
      <FieldRow label="Max bytes" desc="Reject files larger than this (security guard).">
        <input
          type="number"
          value={provider.max_bytes ?? 1024 * 1024}
          onChange={(e) => onUpdate({ max_bytes: parseInt(e.target.value, 10) || 1024 * 1024 } as Partial<SecretProvider>)}
          min={1}
          style={{ ...inputStyle(), width: 140 }}
        />
      </FieldRow>
    </div>
  );
}

function ExecProviderEditor({
  provider,
  onUpdate,
}: {
  provider: ExecProvider;
  onUpdate: (updates: Partial<SecretProvider>) => void;
}) {
  const [argsText, setArgsText] = useState((provider.args ?? []).join('\n'));
  useEffect(() => setArgsText((provider.args ?? []).join('\n')), [provider.args]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '10px 12px',
          marginBottom: 12,
          background: '#f59e0b15',
          border: '1px solid #f59e0b40',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.6875rem',
          color: 'var(--text-dim)',
        }}
      >
        <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong style={{ color: '#f59e0b' }}>Exec provider</strong> runs the command below every time a configured
          field reads from this provider. Use only for trusted tools (1password-cli, pass, vault).
        </span>
      </div>

      <FieldRow label="Command" desc="Absolute path to the binary. Relative paths are rejected by default.">
        <input
          type="text"
          value={provider.command}
          onChange={(e) => onUpdate({ command: e.target.value } as Partial<SecretProvider>)}
          placeholder="/usr/bin/op"
          style={{ ...inputStyle(), width: 320, fontFamily: 'var(--font-mono)' }}
        />
      </FieldRow>

      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text)' }}>Args</div>
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '2px 0 6px' }}>
          One arg per line. The id (the value passed at resolve time) is appended automatically as the last arg.
        </p>
        <textarea
          value={argsText}
          onChange={(e) => setArgsText(e.target.value)}
          onBlur={() => {
            const list = argsText
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean);
            onUpdate({ args: list } as Partial<SecretProvider>);
          }}
          rows={3}
          placeholder={'read'}
          style={{ ...inputStyle(), width: '100%', fontFamily: 'var(--font-mono)', resize: 'vertical' }}
        />
      </div>

      <FieldRow label="Timeout (ms)" desc="Max time the command can run before being killed.">
        <input
          type="number"
          value={provider.timeout_ms ?? 10000}
          onChange={(e) => onUpdate({ timeout_ms: parseInt(e.target.value, 10) || 10000 } as Partial<SecretProvider>)}
          min={100}
          max={120000}
          style={{ ...inputStyle(), width: 100 }}
        />
      </FieldRow>
      <FieldRow label="Max output bytes" desc="Reject output larger than this.">
        <input
          type="number"
          value={provider.max_output_bytes ?? 1024 * 1024}
          onChange={(e) => onUpdate({ max_output_bytes: parseInt(e.target.value, 10) || 1024 * 1024 } as Partial<SecretProvider>)}
          min={1}
          style={{ ...inputStyle(), width: 140 }}
        />
      </FieldRow>
      <FieldRow label="JSON only" desc="Reject non-JSON output.">
        <Toggle
          value={provider.json_only ?? false}
          onChange={(v) => onUpdate({ json_only: v } as Partial<SecretProvider>)}
        />
      </FieldRow>
    </div>
  );
}

// ─── Modals ──────────────────────────────────────────────────────────

function ExecConfirmModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [understood, setUnderstood] = useState(false);
  return (
    <ModalShell title="⚠ Exec providers run a command on every secret resolve" onClose={onCancel}>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 16 }}>
        <p style={{ margin: '0 0 12px' }}>
          This means OpenClaw will execute the command you configure here every time a configured field reads from
          this provider. If the command is malicious or compromised, secrets and host integrity are at risk.
        </p>
        <p style={{ margin: 0 }}>
          Only use this for trusted tools like <code>1password-cli</code>, <code>pass</code>, or <code>vault</code>.
        </p>
      </div>
      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          fontSize: '0.8125rem',
          color: 'var(--text)',
          marginBottom: 16,
          cursor: 'pointer',
        }}
      >
        <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
        I understand this runs an arbitrary command on resolve
      </label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={ghostButtonStyle()}>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={!understood}
          style={{
            ...primaryButtonStyle(),
            opacity: understood ? 1 : 0.4,
            cursor: understood ? 'pointer' : 'default',
          }}
        >
          Continue
        </button>
      </div>
    </ModalShell>
  );
}

function TestProviderModal({ providerName, onClose }: { providerName: string; onClose: () => void }) {
  const [id, setId] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; length?: number; error?: string; durationMs: number } | null>(
    null,
  );

  const handleTest = async () => {
    if (!id.trim()) return;
    setTesting(true);
    setResult(null);
    try {
      const res = await gwService.testSecretProvider(providerName, id);
      setResult({
        ok: res.ok,
        length: res.length,
        error: res.error,
        durationMs: res.duration_ms,
      });
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : 'Test failed',
        durationMs: 0,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <ModalShell title={`Test provider: ${providerName}`} onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'block',
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
            marginBottom: 6,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Resolve which id?
        </label>
        <input
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleTest()}
          placeholder="GH_TOKEN"
          autoFocus
          style={{
            ...inputStyle(),
            width: '100%',
            fontFamily: 'var(--font-mono)',
          }}
        />
      </div>

      {result && (
        <div
          style={{
            padding: '10px 12px',
            marginBottom: 12,
            borderRadius: 'var(--radius-sm)',
            background: result.ok ? '#22c55e15' : '#ef444415',
            border: '1px solid ' + (result.ok ? '#22c55e40' : '#ef444440'),
            fontSize: '0.75rem',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {result.ok ? (
            <span style={{ color: '#22c55e' }}>
              ✅ Resolved (length: {result.length} chars, {result.durationMs}ms)
            </span>
          ) : (
            <span style={{ color: '#ef4444' }}>
              ❌ {result.error} ({result.durationMs}ms)
            </span>
          )}
        </div>
      )}

      <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
        The resolved value never reaches the dash. Only metadata (length, duration, error) is shown.
      </p>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={ghostButtonStyle()}>
          Close
        </button>
        <button onClick={handleTest} disabled={testing || !id.trim()} style={primaryButtonStyle()}>
          {testing ? 'Testing...' : 'Test'}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 20,
          maxWidth: 500,
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text)' }}>{title}</h3>
          <button onClick={onClose} style={iconButtonStyle()}>
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Tiny helpers ────────────────────────────────────────────────────

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
        <div style={{ fontSize: '0.75rem', color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
      </div>
      {children}
    </div>
  );
}

function AddButton({
  icon: Icon,
  label,
  onClick,
  warning,
}: {
  icon: typeof Shield;
  label: string;
  onClick: () => void;
  warning?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        background: warning ? '#f59e0b10' : 'var(--surface)',
        border: '1px solid ' + (warning ? '#f59e0b40' : 'var(--border)'),
        borderRadius: 'var(--radius-sm)',
        color: warning ? '#f59e0b' : 'var(--text-dim)',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Icon size={14} />
      <Plus size={11} /> {label}
    </button>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <ToggleSwitch checked={value} onChange={onChange} />;
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

function iconButtonStyle() {
  return {
    padding: 6,
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
  };
}

function ghostButtonStyle() {
  return {
    padding: '8px 14px',
    fontSize: '0.8125rem',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  };
}

function primaryButtonStyle() {
  return {
    padding: '8px 14px',
    fontSize: '0.8125rem',
    fontWeight: 600,
    background: 'var(--amber)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    color: '#000',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  };
}
