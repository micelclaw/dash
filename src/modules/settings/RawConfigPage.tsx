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

// ─── Raw Config Editor (Ola 7, oc7-7) ───────────────────────────────
//
// Page that lets an admin edit ~/.openclaw/openclaw.json directly via
// CodeMirror. Reuses the editor theme from MicelHub's AppEditor.
//
// Decisions applied:
//   D18=1 — Raw editor only, no schema-driven form renderer
//   D19a  — Page lives at /settings/raw (registered in App.tsx routes)
//   D19d  — Admin-only + interstitial warning the first time per session
//           + automatic backups before each save (rotation: keep last 10)
//
// Concurrency: GET returns the file with a sha256 hash. PUT requires
// the same hash. If the file changed in between, the server returns 409
// and the user has to refresh.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Save, RefreshCw, AlertTriangle, History, ArrowLeft, X } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import type { Extension } from '@codemirror/state';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { useOpenclawSchemaStore } from '@/stores/openclaw-schema.store';
import * as gwService from '@/services/gateway.service';
import type { RawConfigBackup } from '@/services/gateway.service';
import { clawEditorTheme, clawHighlightStyle } from '@/modules/micelhub/editor-theme';

const SESSION_FLAG = 'oc7-raw-warning-acknowledged';

export default function RawConfigPage() {
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.user?.role);
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  const schema = useOpenclawSchemaStore((s) => s.schema);

  const [showWarning, setShowWarning] = useState(false);
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);
  const [understood, setUnderstood] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [hash, setHash] = useState('');
  const [path, setPath] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [showBackups, setShowBackups] = useState(false);
  const [backups, setBackups] = useState<RawConfigBackup[]>([]);
  const seedRef = useRef(false);

  // ─── Warning interstitial (first time per session) ────────────────
  useEffect(() => {
    if (!isAdmin) return;
    const acknowledged = sessionStorage.getItem(SESSION_FLAG) === '1';
    if (acknowledged) {
      setWarningAcknowledged(true);
    } else {
      setShowWarning(true);
    }
  }, [isAdmin]);

  const acknowledgeWarning = () => {
    sessionStorage.setItem(SESSION_FLAG, '1');
    setWarningAcknowledged(true);
    setShowWarning(false);
  };

  // ─── Load config ──────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getRawConfig();
      setContent(data.content);
      setOriginalContent(data.content);
      setHash(data.hash);
      setPath(data.path);
      setParseError(null);
      seedRef.current = true;
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 403) toast.error('Admin role required');
      else toast.error('Failed to load openclaw.json');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (warningAcknowledged) fetchConfig();
  }, [warningAcknowledged, fetchConfig]);

  // ─── Live JSON validation ─────────────────────────────────────────
  useEffect(() => {
    if (!seedRef.current) return;
    if (!content.trim()) {
      setParseError('File is empty');
      return;
    }
    try {
      JSON.parse(content);
      setParseError(null);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, [content]);

  // ─── Save ─────────────────────────────────────────────────────────
  const dirty = content !== originalContent;

  const handleSave = async () => {
    if (parseError) {
      toast.error('Fix the JSON syntax error before saving');
      return;
    }
    setSaving(true);
    try {
      const result = await gwService.saveRawConfig(content, hash);
      setHash(result.new_hash);
      setOriginalContent(content);
      toast.success(`Saved. Backup: ${result.backup.split('/').pop()}`);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const msg = (err as { message?: string })?.message;
      if (status === 409) {
        toast.error('Config changed externally — refresh required');
      } else {
        toast.error(msg ?? 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = () => {
    if (dirty && !confirm('Discard your unsaved changes?')) return;
    fetchConfig();
  };

  const loadBackups = async () => {
    setShowBackups(true);
    try {
      const list = await gwService.listRawConfigBackups();
      setBackups(list);
    } catch {
      toast.error('Failed to list backups');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
        <h2 style={{ color: 'var(--text)', fontSize: '1rem' }}>Forbidden</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>
          Only admins can edit the raw OpenClaw config.
        </p>
        <button onClick={() => navigate('/settings')} style={ghostButtonStyle()}>
          ← Back to Settings
        </button>
      </div>
    );
  }

  if (showWarning) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid #f59e0b40',
            borderRadius: 'var(--radius-md)',
            padding: 24,
            maxWidth: 540,
            width: '90%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <AlertTriangle size={22} style={{ color: '#f59e0b' }} />
            <h2 style={{ margin: 0, fontSize: '1rem', color: 'var(--text)' }}>
              Editing this file directly can break OpenClaw
            </h2>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px' }}>
              You are about to edit <code>~/.openclaw/openclaw.json</code> directly. A malformed JSON or invalid
              field can break the Gateway and require manual recovery from a terminal.
            </p>
            <p style={{ margin: '0 0 10px' }}>
              <strong>Backups:</strong> every save creates a timestamped backup in <code>~/.openclaw/backups/</code>.
              The last 10 backups are kept; older ones are pruned automatically.
            </p>
            <p style={{ margin: 0 }}>
              For most settings, use the dedicated sections in Settings instead. This editor is for fields that have
              no UI yet (about 22 sections of the OpenClaw schema).
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
            I understand the risks
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => navigate('/settings')} style={ghostButtonStyle()}>
              Cancel
            </button>
            <button
              onClick={acknowledgeWarning}
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
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 40, color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>Loading…</div>
    );
  }

  const extensions: Extension[] = [json(), clawEditorTheme, clawHighlightStyle];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <button onClick={() => navigate('/settings')} style={iconButtonStyle()} title="Back to Settings">
          <ArrowLeft size={14} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            Raw config editor
          </h1>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            {path}
          </div>
        </div>

        <button onClick={loadBackups} style={ghostButtonStyle()} title="View backups">
          <History size={13} style={{ marginRight: 4 }} /> Backups
        </button>
        <button onClick={handleRefresh} style={iconButtonStyle()} title="Reload from disk">
          <RefreshCw size={14} />
        </button>
        <button
          onClick={handleSave}
          disabled={!dirty || saving || !!parseError}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 14px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            background: dirty && !parseError ? 'var(--amber)' : 'var(--surface)',
            border: dirty && !parseError ? 'none' : '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: dirty && !parseError ? '#000' : 'var(--text-muted)',
            cursor: dirty && !parseError ? 'pointer' : 'default',
            opacity: saving ? 0.7 : 1,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Save size={14} /> {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <CodeMirror
          value={content}
          height="100%"
          extensions={extensions}
          onChange={(v) => setContent(v)}
          theme="dark"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            tabSize: 2,
          }}
        />
      </div>

      {/* Footer with parse error / status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          fontSize: '0.6875rem',
          fontFamily: 'var(--font-mono)',
          flexShrink: 0,
          background: parseError ? '#ef444415' : 'var(--surface)',
          color: parseError ? '#ef4444' : 'var(--text-muted)',
        }}
      >
        {parseError ? (
          <span>⚠ {parseError}</span>
        ) : (
          <span>
            {dirty ? '● Unsaved changes' : '✓ Synced'}
            {schema && ' · schema loaded'}
            {' · '}
            {content.length} chars
          </span>
        )}
      </div>

      {/* Backups modal */}
      {showBackups && (
        <div
          onClick={() => setShowBackups(false)}
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
              maxWidth: 540,
              width: '90%',
              maxHeight: '70vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text)' }}>
                Backups (last {backups.length})
              </h3>
              <button onClick={() => setShowBackups(false)} style={iconButtonStyle()}>
                <X size={14} />
              </button>
            </div>
            {backups.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No backups yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {backups.map((b) => (
                  <div
                    key={b.filename}
                    style={{
                      padding: '8px 10px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.6875rem',
                      color: 'var(--text-dim)',
                    }}
                  >
                    <div style={{ color: 'var(--text)' }}>{new Date(b.created_at).toLocaleString()}</div>
                    <div style={{ marginTop: 2, opacity: 0.7 }}>
                      {b.filename} · {b.size_bytes} bytes
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 12 }}>
              Restore is not yet supported via the UI. Copy the file from {`~/.openclaw/backups/`} manually if needed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

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
    padding: '6px 12px',
    fontSize: '0.75rem',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    display: 'flex',
    alignItems: 'center',
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
