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

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import * as hal from '@/services/hal.service';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingToggle } from '../SettingToggle';
import { SettingInput } from '../SettingInput';
import { SettingSelect } from '../SettingSelect';
import { SaveBar } from '../SaveBar';
import { SettingsBlock } from '../shared/SettingsBlock';
import { ProLockBanner, useIsPro } from '../shared/ProLockBanner';
import { ToggleSwitch } from '../shared/ToggleSwitch';

// Ports that we know Micelclaw uses by default. Used to flag conflicts
// in the canvas-host port input. This is a "warn, don't block" list —
// the user can still save (they may have moved the conflicting service
// to a different port already).
const KNOWN_PORTS: Record<number, string> = {
  22: 'SSH',
  80: 'HTTP',
  443: 'HTTPS',
  3000: 'Vite/dev frontend',
  5432: 'PostgreSQL',
  6379: 'Redis',
  7200: 'Core API',
  8080: 'common HTTP alt',
  8123: 'Home Assistant',
  11434: 'Ollama',
};

function describeKnownPort(port: number): string | null {
  return KNOWN_PORTS[port] ?? null;
}

const ROTATION_OPTIONS = [
  { value: 'smart', label: 'Smart' },
  { value: 'fifo', label: 'FIFO (First In, First Out)' },
  { value: 'none', label: 'None (keep all)' },
];

function StorageProviderSection() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  const fetchProvider = useCallback(async () => {
    try {
      const { provider } = await hal.getStorageProvider();
      setProvider(provider);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchProvider(); }, [fetchProvider]);

  const handleDetect = async () => {
    setDetecting(true);
    try {
      await hal.detectStorageProvider();
      await fetchProvider();
      toast.success('Provider re-detected');
    } catch {
      toast.error('Failed to detect provider');
    }
    setDetecting(false);
  };

  return (
    <SettingSection title="Storage Provider" description="HAL storage provider detection and monitoring.">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Provider</span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
          {provider ?? '...'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '12px 0' }}>
        <button
          onClick={handleDetect}
          disabled={detecting}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)', cursor: detecting ? 'default' : 'pointer',
            opacity: detecting ? 0.6 : 1,
          }}
        >
          <RefreshCw size={12} style={detecting ? { animation: 'spin 1s linear infinite' } : undefined} />
          Re-detect provider
        </button>
        <button
          onClick={() => navigate('/storage')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)', cursor: 'pointer',
          }}
        >
          <ExternalLink size={12} />
          Open Storage
        </button>
      </div>
    </SettingSection>
  );
}

export function StorageSection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const isPro = useIsPro();
  const [saving, setSaving] = useState(false);
  const [editingPatterns, setEditingPatterns] = useState(false);
  const [editingFolders, setEditingFolders] = useState(false);
  const [patternsText, setPatternsText] = useState('');
  const [foldersText, setFoldersText] = useState('');

  if (!settings) return null;
  const s = settings.storage;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('storage', settings.storage as unknown as Record<string, unknown>);
      toast.success('Storage saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  const openPatternEditor = () => {
    setPatternsText(s.snapshots.excluded_patterns.join('\n'));
    setEditingPatterns(true);
  };
  const savePatterns = () => {
    setLocalValue('storage.snapshots.excluded_patterns', patternsText.split('\n').map((l) => l.trim()).filter(Boolean));
    setEditingPatterns(false);
  };

  const openFolderEditor = () => {
    setFoldersText(s.snapshots.excluded_folders.join('\n'));
    setEditingFolders(true);
  };
  const saveFolders = () => {
    setLocalValue('storage.snapshots.excluded_folders', foldersText.split('\n').map((l) => l.trim()).filter(Boolean));
    setEditingFolders(false);
  };

  return (
    <>
      <SettingSection title="Storage Paths" description="Read-only. Configured at install time.">
        {[
          { label: 'Data Path', value: s.data_path },
          { label: 'Files Path', value: s.files_path },
          { label: 'Backup Path', value: s.backup_path },
          { label: 'Domain', value: s.claw_domain },
        ].map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{item.label}</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>{item.value}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>HAL Status</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: s.hal_enabled ? '#22c55e' : '#6b7280' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.hal_enabled ? '#22c55e' : '#6b7280' }} />
            {s.hal_enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </SettingSection>

      <StorageProviderSection />

      <SettingSection title="File Snapshots (Pro)" description="Version history for your files.">
        {/* Pro gate: banner + `disabled={!isPro}` on every control.
            Free users can still see the controls (so they understand
            what they'd unlock) but can't toggle them. */}
        <ProLockBanner description="Automatic version history for files saved in the Files app. Roll back any document to a previous state." />

        <SettingToggle
          label="Enabled"
          checked={s.snapshots.enabled}
          onChange={(v) => setLocalValue('storage.snapshots.enabled', v)}
          disabled={!isPro}
        />
        <SettingInput
          label="Max Versions per File"
          type="number"
          value={String(s.snapshots.max_versions_per_file)}
          onChange={(v) => setLocalValue('storage.snapshots.max_versions_per_file', Math.max(1, parseInt(v) || 32))}
          min={1}
          disabled={!isPro}
        />
        <SettingSelect
          label="Rotation Policy"
          value={s.snapshots.rotation_policy}
          options={ROTATION_OPTIONS}
          onChange={(v) => setLocalValue('storage.snapshots.rotation_policy', v)}
          disabled={!isPro}
        />

        {/* Excluded patterns */}
        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Excluded Patterns</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {s.snapshots.excluded_patterns.join(', ') || 'None'}
              </div>
            </div>
            {!editingPatterns && (
              <button
                onClick={openPatternEditor}
                disabled={!isPro}
                style={{
                  height: 26, padding: '0 10px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
                  fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
                  cursor: isPro ? 'pointer' : 'not-allowed',
                  opacity: isPro ? 1 : 0.5,
                }}
              >
                Edit list...
              </button>
            )}
          </div>
          {editingPatterns && (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={patternsText}
                onChange={(e) => setPatternsText(e.target.value)}
                rows={5}
                style={{
                  width: '100%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem',
                  fontFamily: 'var(--font-mono, monospace)', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditingPatterns(false)} style={{ height: 26, padding: '0 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={savePatterns} style={{ height: 26, padding: '0 10px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Save</button>
              </div>
            </div>
          )}
        </div>

        {/* Excluded folders */}
        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Excluded Folders</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {s.snapshots.excluded_folders.join(', ') || 'None'}
              </div>
            </div>
            {!editingFolders && (
              <button
                onClick={openFolderEditor}
                disabled={!isPro}
                style={{
                  height: 26, padding: '0 10px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
                  fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
                  cursor: isPro ? 'pointer' : 'not-allowed',
                  opacity: isPro ? 1 : 0.5,
                }}
              >
                Edit list...
              </button>
            )}
          </div>
          {editingFolders && (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={foldersText}
                onChange={(e) => setFoldersText(e.target.value)}
                rows={3}
                style={{
                  width: '100%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem',
                  fontFamily: 'var(--font-mono, monospace)', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditingFolders(false)} style={{ height: 26, padding: '0 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveFolders} style={{ height: 26, padding: '0 10px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>Save</button>
              </div>
            </div>
          )}
        </div>
      </SettingSection>

      <SaveBar visible={!!dirty.storage} saving={saving} onSave={handleSave} onDiscard={() => resetSection('storage')} />

      {/* Ola 7 (oc7-5.1h) — OpenClaw canvas hosting */}
      <CanvasHostBlock />
    </>
  );
}

// ─── Canvas Host Config block (Ola 7, oc7-5.1h) ────────────────────
//
// Exposes `canvasHost.*` (enabled, root, port, liveReload). Lives
// inside StorageSection because `root` is a filesystem path. Saves
// independently from the rest of Storage (different endpoint).
//
// When enabled, OpenClaw spins up an HTTP server that serves files
// from `root`. The dash consumes this via the /canvas-host/* proxy
// in Core (which adds the capability token transparently). Files
// auto-reload in the iframe when chokidar detects changes.

import * as gwService from '@/services/gateway.service';
import type { CanvasHostConfig } from '@/services/gateway.service';

function CanvasHostBlock() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [root, setRoot] = useState('');
  const [port, setPort] = useState(18793);
  const [liveReload, setLiveReload] = useState(true);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getCanvasConfig();
      setEnabled(data.enabled ?? false);
      setRoot(data.root ?? '');
      setPort(data.port ?? 18793);
      setLiveReload(data.live_reload ?? true);
      setDirty(false);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded && !loading && !dirty) fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // Root validation: must be an absolute path (Unix /... or Windows
  // C:\...) or start with "~/" so OpenClaw can expand it. Empty is OK
  // because the backend falls back to ~/.openclaw/canvas/.
  const rootTrimmed = root.trim();
  const rootInvalid =
    rootTrimmed.length > 0 &&
    !rootTrimmed.startsWith('/') &&
    !rootTrimmed.startsWith('~/') &&
    !/^[A-Za-z]:[\\/]/.test(rootTrimmed);

  // Port range + known-port collision warning. Out-of-range is hard
  // (block save); known-port collision is soft (warn, allow save).
  const portOutOfRange = port < 1 || port > 65535;
  const portWarn = describeKnownPort(port);

  const handleSave = async () => {
    if (rootInvalid) {
      toast.error('Root must be an absolute path (e.g. /home/me/canvas) or start with ~/');
      return;
    }
    if (portOutOfRange) {
      toast.error('Port must be between 1 and 65535');
      return;
    }
    setSaving(true);
    try {
      const config: CanvasHostConfig = {
        enabled,
        root: rootTrimmed || undefined,
        port,
        live_reload: liveReload,
      };
      await gwService.updateCanvasConfig(config);
      toast.success('Canvas Host saved');
      setDirty(false);
    } catch {
      toast.error('Failed to update canvas host config');
    } finally {
      setSaving(false);
    }
  };

  const openCanvasUrl = `http://localhost:${port}/__openclaw__/canvas/`;
  const saveBlocked = rootInvalid || portOutOfRange;

  return (
    <SettingsBlock
      title="OpenClaw Canvas Host"
      description="Static HTTP server for canvas files"
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
      dirty={dirty && !saveBlocked}
      saving={saving}
      onSave={handleSave}
      saveLabel="Save canvas host"
      footerExtra={
        enabled ? (
          <a
            href={openCanvasUrl}
            target="_blank"
            rel="noopener"
            style={{
              fontSize: '0.6875rem',
              color: 'var(--amber)',
              textDecoration: 'none',
            }}
          >
            Open: {openCanvasUrl} ↗
          </a>
        ) : null
      }
    >
      <p
        style={{
          margin: '12px 0',
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        OpenClaw can serve HTML files from a directory over HTTP, with chokidar live-reload. The dash uses this
        for canvas iframes via a server-side proxy. Agents that generate visual content (charts, reports) write
        to <code>{root || '~/.openclaw/canvas/'}</code> and the iframe loads them automatically.
      </p>

      {/* enabled */}
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
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Enable canvas host</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Spin up the HTTP server. Required for the dash canvas to load files via URL (the recommended path).
          </div>
        </div>
        <ToggleSwitch
          checked={enabled}
          onChange={(v) => { setEnabled(v); setDirty(true); }}
          ariaLabel="Enable canvas host"
        />
      </div>

      {/* root */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 0',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Root directory</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Absolute path of the directory served. Default: <code>~/.openclaw/canvas/</code>.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <input
            type="text"
            value={root}
            onChange={(e) => {
              setRoot(e.target.value);
              setDirty(true);
            }}
            placeholder="~/.openclaw/canvas/"
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              width: 280,
              background: 'var(--surface)',
              border: `1px solid ${rootInvalid ? '#ef4444' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
          {rootInvalid && (
            <div style={{
              fontSize: '0.6875rem', color: '#ef4444',
              fontFamily: 'var(--font-sans)',
              maxWidth: 280, textAlign: 'right',
            }}>
              ! Use an absolute path (/...) or ~/...
            </div>
          )}
        </div>
      </div>

      {/* port */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 0',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>HTTP port</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Default: <code>18793</code>. Make sure no other service uses this port.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <input
            type="number"
            value={port}
            onChange={(e) => {
              setPort(parseInt(e.target.value, 10) || 18793);
              setDirty(true);
            }}
            min={1}
            max={65535}
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              width: 100,
              background: 'var(--surface)',
              border: `1px solid ${portOutOfRange ? '#ef4444' : portWarn ? 'var(--amber)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
          {portOutOfRange ? (
            <div style={{ fontSize: '0.6875rem', color: '#ef4444', fontFamily: 'var(--font-sans)' }}>
              ! Out of range
            </div>
          ) : portWarn ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: '0.6875rem', color: 'var(--amber)',
              fontFamily: 'var(--font-sans)',
              maxWidth: 200, textAlign: 'right',
            }}>
              <AlertTriangle size={11} />
              <span>Conflicts with {portWarn}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* liveReload */}
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
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Live reload</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Watch the root directory and notify clients when files change (chokidar, 75ms debounce).
          </div>
        </div>
        <ToggleSwitch
          checked={liveReload}
          onChange={(v) => { setLiveReload(v); setDirty(true); }}
          ariaLabel="Live reload"
        />
      </div>
    </SettingsBlock>
  );
}
