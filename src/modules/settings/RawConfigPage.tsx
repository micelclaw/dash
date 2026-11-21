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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Save, RefreshCw, AlertTriangle, History, ArrowLeft, X, Power } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { toast } from 'sonner';
import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { useAuthStore } from '@/stores/auth.store';
import { useOpenclawSchemaStore } from '@/stores/openclaw-schema.store';
import * as gwService from '@/services/gateway.service';
import type { RawConfigBackup } from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { TypeToConfirmModal } from '@/components/settings/shared/TypeToConfirmModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { RetryBanner } from '@/components/settings/shared/RetryBanner';
import { clawEditorTheme, clawHighlightStyle } from '@/modules/micelhub/editor-theme';
import { useI18n } from '@/i18n';

const SESSION_FLAG = 'oc7-raw-warning-acknowledged';

// ─── AJV singleton ───────────────────────────────────────────────────
// Shared across instances to amortize compile cost. `strict: false`
// because OpenClaw schemas use a few keywords AJV rejects in strict
// mode (`example`, custom annotations).
const ajv = new Ajv({ strict: false, allErrors: true, allowUnionTypes: true });
addFormats(ajv);

interface SchemaValidationResult {
  ok: boolean;
  errors: ErrorObject[];
}

function describeAjvError(err: ErrorObject): string {
  const path = err.instancePath || '(root)';
  return `${path} — ${err.message ?? 'invalid'}`;
}

// Per-section overrides for the shared describeError helper. The raw
// config save has its own rate-limit copy ("3 per minute") because
// that's the configPatch-specific rate limit documented in CLAUDE.md.
const RAW_CONFIG_ERROR_OVERRIDES = {
  status: {
    409: 'Config changed externally — refresh and reapply your edit.',
    429: 'Save rate-limited (3 per minute). Wait and try again.',
  },
  code: {
    INVALID_JSON: 'Backend rejected the JSON — check syntax.',
    HASH_MISMATCH: 'Config changed externally — refresh and reapply your edit.',
    RAW_CONFIG_WRITE_FAILED: 'Disk write failed — check Gateway permissions.',
    RATE_LIMIT: 'Save rate-limited (3 per minute). Wait and try again.',
  },
};

export default function RawConfigPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const userRole = useAuthStore((s) => s.user?.role);
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  const schema = useOpenclawSchemaStore((s) => s.schema);
  const schemaError = useOpenclawSchemaStore((s) => s.error);
  const schemaLoading = useOpenclawSchemaStore((s) => s.loading);
  const reloadConfigSchema = useOpenclawSchemaStore((s) => s.reloadConfigSchema);

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
  const [schemaErrors, setSchemaErrors] = useState<ErrorObject[]>([]);
  const [showBackups, setShowBackups] = useState(false);
  const [backups, setBackups] = useState<RawConfigBackup[]>([]);
  // Backup cuya restauración está pendiente de confirmar (solo se pregunta si
  // hay cambios sin guardar, que es lo único que la carga puede destruir).
  const [pendingRestore, setPendingRestore] = useState<RawConfigBackup | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const seedRef = useRef(false);

  // Compile the schema once per schema instance. Returns a validator
  // function or null if the schema isn't loaded / failed compile.
  const validate = useMemo(() => {
    if (!schema) return null;
    try {
      return ajv.compile(schema);
    } catch (err) {
      // Bad schema is a backend bug, not a user one — log and fail open.
      console.warn('[raw-config] schema failed to compile:', err);
      return null;
    }
  }, [schema]);

  const validateAgainstSchema = useCallback(
    (text: string): SchemaValidationResult => {
      if (!validate) return { ok: true, errors: [] };
      try {
        const parsed = JSON.parse(text);
        const ok = validate(parsed) as boolean;
        return { ok, errors: ok ? [] : (validate.errors ?? []) };
      } catch {
        // JSON syntax errors are surfaced separately via parseError;
        // skip schema check until syntax is valid.
        return { ok: true, errors: [] };
      }
    },
    [validate],
  );

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
      if (status === 403) toast.error(t('settings.raw.adminRequired'));
      else toast.error(t('settings.raw.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (warningAcknowledged) fetchConfig();
  }, [warningAcknowledged, fetchConfig]);

  // ─── Live JSON + schema validation ────────────────────────────────
  useEffect(() => {
    if (!seedRef.current) return;
    if (!content.trim()) {
      setParseError(t('settings.raw.fileEmpty'));
      setSchemaErrors([]);
      return;
    }
    try {
      JSON.parse(content);
      setParseError(null);
      // Schema validation only runs when JSON is syntactically valid.
      const result = validateAgainstSchema(content);
      setSchemaErrors(result.errors);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : t('settings.raw.invalidJson'));
      setSchemaErrors([]);
    }
  }, [content, validateAgainstSchema, t]);

  // ─── Save ─────────────────────────────────────────────────────────
  const dirty = content !== originalContent;
  const schemaInvalid = schemaErrors.length > 0;
  // Without a schema we cannot validate, so block save until the admin
  // either reloads it or accepts the risk via the backend round-trip.
  const schemaUnavailable = !schemaLoading && !schema && !!schemaError;
  const saveBlocked = !!parseError || schemaInvalid || schemaUnavailable;

  const requestSave = () => {
    if (parseError) { toast.error(t('settings.raw.fixJsonBeforeSave')); return; }
    if (schemaInvalid) { toast.error(t('settings.raw.fixSchemaErrors', { count: schemaErrors.length })); return; }
    if (schemaUnavailable) { toast.error(t('settings.raw.schemaUnavailable')); return; }
    setShowSaveConfirm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await gwService.saveRawConfig(content, hash);
      setHash(result.new_hash);
      setOriginalContent(content);
      toast.success(`${t('settings.raw.saved')}. ${t('settings.raw.backups')}: ${result.backup.split('/').pop()}`);
      setShowSaveConfirm(false);
    } catch (err) {
      toast.error(describeError(err, t('settings.raw.saveFailed'), RAW_CONFIG_ERROR_OVERRIDES));
    } finally {
      setSaving(false);
    }
  };

  const handleRetrySchema = async () => {
    await reloadConfigSchema();
  };

  const handleRefresh = () => {
    if (dirty && !confirm(t('settings.raw.discardChanges'))) return;
    fetchConfig();
  };

  const loadBackups = async () => {
    setShowBackups(true);
    try {
      const list = await gwService.listRawConfigBackups();
      setBackups(list);
    } catch {
      toast.error(t('settings.raw.backupListFailed'));
    }
  };

  // ─── Restore from backup ──────────────────────────────────────────
  // Restaurar = cargar el backup EN EL EDITOR, no escribirlo a disco. El
  // admin lo revisa y lo guarda con el botón de siempre, que valida el
  // JSON contra el schema, comprueba el hash y hace backup del estado
  // actual antes de escribir → la restauración es reversible.
  const doRestore = async (backup: RawConfigBackup) => {
    setRestoring(true);
    try {
      const { content: restored } = await gwService.getRawConfigBackup(backup.filename);
      setContent(restored);
      setShowBackups(false);
      setPendingRestore(null);
      toast.success(t('settings.raw.backupLoaded'));
    } catch (err) {
      toast.error(describeError(err, t('settings.raw.backupReadFailed')));
    } finally {
      setRestoring(false);
    }
  };

  const requestRestore = (backup: RawConfigBackup) => {
    if (dirty) { setPendingRestore(backup); return; }
    void doRestore(backup);
  };

  // ─── Render ───────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
        <h2 style={{ color: 'var(--text)', fontSize: '1rem' }}>{t('settings.raw.forbidden')}</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>
          {t('settings.raw.forbiddenDescription')}
        </p>
        <button onClick={() => navigate('/settings')} style={ghostButtonStyle()}>
          ← {t('settings.raw.back')}
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
              {t('settings.raw.warningHeading')}
            </h2>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px' }}>
              {t('settings.raw.warningBody')} {t('settings.raw.warningDetails')}
            </p>
            <p style={{ margin: '0 0 10px' }}>
              <strong>{t('settings.raw.backups')}:</strong> {t('settings.raw.backupsInfo')}
            </p>
            <p style={{ margin: 0 }}>
              {t('settings.raw.warningUseSections')}
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
            {t('settings.raw.understandRisk')}
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => navigate('/settings')} style={ghostButtonStyle()}>
              {t('settings.raw.cancel')}
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
              {t('settings.raw.continue')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 40, color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>{t('settings.raw.loading')}</div>
    );
  }

  const extensions: Extension[] = [
    json(),
    clawEditorTheme,
    clawHighlightStyle,
    // Lock editor while a save is in flight so the user can't edit
    // content that's about to be overwritten by the server response.
    EditorView.editable.of(!saving),
  ];

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
        <button onClick={() => navigate('/settings')} style={iconButtonStyle()} title={t('settings.raw.back')}>
          <ArrowLeft size={14} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            {t('settings.raw.title')}
          </h1>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            {path}
          </div>
        </div>

        <button onClick={loadBackups} style={ghostButtonStyle()} title={t('settings.raw.viewBackups')}>
          <History size={13} style={{ marginRight: 4 }} /> {t('settings.raw.backups')}
        </button>
        <button onClick={handleRefresh} style={iconButtonStyle()} title={t('settings.raw.reloadFromDisk')}>
          <RefreshCw size={14} />
        </button>
        <button
          onClick={requestSave}
          disabled={!dirty || saving || saveBlocked}
          title={
            saveBlocked
              ? parseError
                ? t('settings.raw.fixJson')
                : schemaInvalid
                ? t('settings.raw.fixSchemaFirst', { count: schemaErrors.length })
                : t('settings.raw.retrySchema')
              : undefined
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 14px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            background: dirty && !saveBlocked ? 'var(--amber)' : 'var(--surface)',
            border: dirty && !saveBlocked ? 'none' : '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: dirty && !saveBlocked ? '#000' : 'var(--text-muted)',
            cursor: (dirty && !saveBlocked) ? 'pointer' : 'not-allowed',
            opacity: saving ? 0.7 : 1,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Save size={14} /> {saving ? t('settings.raw.saving') : dirty ? t('settings.raw.save') : t('settings.raw.saved')}
        </button>
      </div>

      {/* Schema-load error banner — admin must retry or the editor
          can't validate before save. */}
      {schemaUnavailable && (
        <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
          <RetryBanner
            severity="error"
            title={t('settings.raw.schemaUnavailableTitle')}
            message={t('settings.raw.schemaUnavailableMessage', { error: schemaError ?? t('settings.raw.schemaLoadFailed') })}
            onRetry={handleRetrySchema}
            loading={schemaLoading}
          />
        </div>
      )}

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

      {/* Footer with parse / schema / status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          fontSize: '0.6875rem',
          fontFamily: 'var(--font-mono)',
          flexShrink: 0,
          background: parseError ? '#ef444415' : schemaInvalid ? '#f59e0b15' : 'var(--surface)',
          color: parseError ? '#ef4444' : schemaInvalid ? '#f59e0b' : 'var(--text-muted)',
        }}
      >
        {parseError ? (
          <span>⚠ {parseError}</span>
        ) : schemaInvalid ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            <span style={{ fontWeight: 600 }}>
              ⚠ {t('settings.raw.schemaErrors', { count: schemaErrors.length })}
            </span>
            {schemaErrors.slice(0, 3).map((e, i) => (
              <span key={i} style={{ opacity: 0.85 }}>· {describeAjvError(e)}</span>
            ))}
            {schemaErrors.length > 3 && (
              <span style={{ opacity: 0.6 }}>… {t('settings.raw.moreErrors', { count: schemaErrors.length - 3 })}</span>
            )}
          </div>
        ) : (
          <span>
            {dirty ? `● ${t('settings.raw.unsavedChanges')}` : `✓ ${t('settings.raw.synced')}`}
            {schema && ` · ${t('settings.raw.schemaLoaded')}`}
            {' · '}
            {content.length} chars
          </span>
        )}
      </div>

      {/* Type-to-confirm save modal — editing the entire openclaw.json
          is irreversible from the UI (rollback only via shell + backup
          file), so we gate it behind an explicit ack. */}
      <TypeToConfirmModal
        open={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        onConfirm={handleSave}
        title={t('settings.raw.overwriteTitle')}
        description={
          <>
            {t('settings.raw.confirmDescription')}
          </>
        }
        requireWord="SAVE"
        confirmLabel={t('settings.raw.overwrite')}
        runningLabel={t('settings.raw.saving')}
        running={saving}
        confirmIcon={Power}
      />

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
                {t('settings.raw.backupCount', { count: backups.length })}
              </h3>
              <button onClick={() => setShowBackups(false)} style={iconButtonStyle()}>
                <X size={14} />
              </button>
            </div>
            {backups.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{t('settings.raw.noBackups')}</p>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--text)' }}>{new Date(b.created_at).toLocaleString()}</div>
                        <div style={{ marginTop: 2, opacity: 0.7, overflowWrap: 'anywhere' }}>
                          {b.filename} · {b.size_bytes} bytes
                        </div>
                      </div>
                      <button
                        onClick={() => requestRestore(b)}
                        disabled={restoring}
                        style={{ ...ghostButtonStyle(), flexShrink: 0 }}
                        title={t('settings.raw.loadBackupTitle')}
                      >
                        {t('settings.raw.restore')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 12 }}>
              {t('settings.raw.restoreHelp')}
            </p>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingRestore}
        onClose={() => setPendingRestore(null)}
        onConfirm={() => { if (pendingRestore) void doRestore(pendingRestore); }}
        title={t('settings.raw.discardChanges')}
        description={t('settings.raw.discardForBackupDescription')}
        confirmLabel={t('settings.raw.loadBackup')}
        variant="warning"
      />
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
