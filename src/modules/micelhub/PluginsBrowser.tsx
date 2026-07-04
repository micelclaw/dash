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

// ─── MicelHub → Plugins (§PARTE 3) ──────────────────────────────────
// Admin-only catalog of OpenClaw tool/runtime/utility plugins. Providers
// live in Gateway → Models and channels in Gateway/Channels (linked out).
// Installing runs code in the Gateway host-side (no sandbox) → trust note.
// acpx (the ACP engine runtime) is the flagship entry; Studio Engines
// deep-links here (?focus=acpx).

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Puzzle, Download, Trash2, Power, Loader2, Check, X, Search, TriangleAlert, RefreshCw,
} from 'lucide-react';
import * as pluginsService from '@/services/plugins.service';
import type { CatalogPlugin } from '@/services/plugins.service';
import { restartGateway } from '@/services/gateway.service';
import { useWebSocket } from '@/hooks/use-websocket';
import { useAppsStore } from '@/stores/apps.store';
import { describeError } from '@/lib/api-errors';

type LogState = 'idle' | 'running' | 'ready' | 'failed';

export function PluginsBrowser({ focusId }: { focusId?: string }) {
  const setRestartRequired = useAppsStore((s) => s.setRestartRequired);
  const restartRequired = useAppsStore((s) => s.restartRequired);

  const [plugins, setPlugins] = useState<CatalogPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [installRef, setInstallRef] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<pluginsService.PluginSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  // Live install/uninstall logs (WS service.* filtered to 'plugin-install').
  const [logState, setLogState] = useState<LogState>('idle');
  const [logName, setLogName] = useState('');
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logError, setLogError] = useState<string | null>(null);
  const logsRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await pluginsService.getPlugins();
      setPlugins(res.plugins);
    } catch (err) {
      toast.error(describeError(err, 'Failed to load plugins'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const markBusy = (id: string, on: boolean) =>
    setBusy((prev) => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; });

  // ── live logs ──
  const wsEvent = useWebSocket('service.*');
  useEffect(() => {
    if (!wsEvent || (wsEvent.data as Record<string, unknown>)?.service !== 'plugin-install') return;
    const data = wsEvent.data as Record<string, unknown>;
    switch (wsEvent.event) {
      case 'service.starting':
        setLogState('running'); setLogName(String(data.name ?? '')); setLogLines([]); setLogError(null);
        break;
      case 'service.logs': {
        const lines = data.lines as string[] | undefined;
        if (lines?.length) setLogLines((p) => [...p, ...lines].slice(-200));
        break;
      }
      case 'service.ready':
        setLogState('ready');
        setRestartRequired('openclaw', 'A plugin was installed — reload the Gateway to load it.');
        void load();
        break;
      case 'service.failed':
        setLogState('failed'); setLogError((data.error as string) ?? 'Operation failed');
        break;
    }
  }, [wsEvent]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight; }, [logLines]);

  // ── actions ──
  async function doInstall(ref: string) {
    if (!ref.trim()) return;
    try {
      await pluginsService.installPlugin(ref.trim(), true);
      setLogState('running'); setLogName(ref.trim()); setLogLines([]); setLogError(null);
      setInstallRef('');
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) { toast.warning('Another plugin operation is running.'); return; }
      toast.error(describeError(err, 'Install failed'));
    }
  }
  async function doUninstall(p: CatalogPlugin) {
    markBusy(p.id, true);
    try {
      await pluginsService.uninstallPlugin(p.id);
      setLogState('running'); setLogName(`uninstall ${p.id}`); setLogLines([]); setLogError(null);
    } catch (err) {
      toast.error(describeError(err, 'Uninstall failed'));
    } finally { markBusy(p.id, false); }
  }
  async function doToggle(p: CatalogPlugin) {
    markBusy(p.id, true);
    try {
      if (p.enabled) await pluginsService.disablePlugin(p.id);
      else await pluginsService.enablePlugin(p.id);
      setRestartRequired('openclaw', 'Plugin state changed — reload the Gateway to apply.');
      await load();
    } catch (err) {
      toast.error(describeError(err, 'Failed to update plugin'));
    } finally { markBusy(p.id, false); }
  }

  async function doSearch() {
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    try { setResults(await pluginsService.searchPlugins(query.trim())); }
    catch (err) { toast.error(describeError(err, 'Search failed')); }
    finally { setSearching(false); }
  }

  const sorted = useMemo(() => {
    if (!focusId) return plugins;
    return [...plugins].sort((a, b) => (a.id === focusId ? -1 : b.id === focusId ? 1 : 0));
  }, [plugins, focusId]);

  return (
    <div style={{ padding: 4 }}>
      {/* Reload banner */}
      {restartRequired.openclaw && (
        <div style={reloadBanner}>
          <TriangleAlert size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{restartRequired.reason ?? 'Reload the Gateway to apply plugin changes.'}</span>
          <button onClick={() => { void restartGateway().then(() => toast.success('Gateway reloading…')); }} style={btnAmber}>
            <RefreshCw size={13} /> Reload Gateway
          </button>
        </div>
      )}

      {/* Header + trust note */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Puzzle size={16} style={{ color: 'var(--amber)' }} />
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>Plugins</h3>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>tools &amp; runtimes · admin only</span>
      </div>
      <div style={trustNote}>
        <TriangleAlert size={13} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
        <span>Plugins run in the Gateway <b>without a sandbox</b> and affect all agents. Install only sources you trust. Model providers live in Gateway → Models, channels in Gateway → Channels.</span>
      </div>

      {/* Install from source (power-user) + search */}
      <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 280 }}>
          <input value={installRef} onChange={(e) => setInstallRef(e.target.value)}
            placeholder="Install from source: clawhub:@openclaw/acpx · npm:… · git:…"
            onKeyDown={(e) => { if (e.key === 'Enter') void doInstall(installRef); }}
            style={{ ...input, flex: 1, fontFamily: 'var(--font-mono)' }} />
          <button onClick={() => void doInstall(installRef)} disabled={!installRef.trim() || logState === 'running'} style={btnAmber}>
            <Download size={13} /> Install
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, minWidth: 240 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-muted)' }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void doSearch(); }}
              placeholder="Search ClawHub…" style={{ ...input, paddingLeft: 28 }} />
          </div>
          <button onClick={() => void doSearch()} disabled={searching} style={btnGhost}>
            {searching ? <Loader2 size={13} className="spin" /> : 'Search'}
          </button>
        </div>
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div style={{ marginBottom: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{ padding: '6px 10px', fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--surface)' }}>ClawHub results</div>
          {results.map((r) => (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text)' }}>{r.name}</div>
                {r.description && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.description}</div>}
              </div>
              <button onClick={() => void doInstall(r.install_ref ?? `clawhub:${r.name}`)} disabled={logState === 'running'} style={rowBtn}>
                <Download size={12} /> Install
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Live install/uninstall logs */}
      {logState !== 'idle' && (
        <div style={{ marginBottom: 14, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', marginBottom: 8 }}>
            {logState === 'running' && <><Loader2 size={14} className="spin" style={{ color: 'var(--amber)' }} /> <span style={{ color: 'var(--text)' }}>Working on <code style={code}>{logName}</code>…</span></>}
            {logState === 'ready' && <><Check size={14} style={{ color: '#22c55e' }} /> <span style={{ color: '#22c55e' }}>Done — reload the Gateway to finish.</span></>}
            {logState === 'failed' && <><X size={14} style={{ color: '#ef4444' }} /> <span style={{ color: '#ef4444' }}>Failed: {logError}</span></>}
          </div>
          {logLines.length > 0 && (
            <div ref={logsRef} style={logBox}>{logLines.join('\n')}</div>
          )}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ padding: 16, fontSize: '0.8rem', color: 'var(--text-dim)' }}>Loading plugins…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {sorted.map((p) => (
            <PluginCard key={p.id} p={p} busy={busy.has(p.id)} focused={p.id === focusId}
              onInstall={() => void doInstall(p.install_ref ?? p.id)}
              onToggle={() => void doToggle(p)} onUninstall={() => void doUninstall(p)}
              installDisabled={logState === 'running'} />
          ))}
        </div>
      )}
    </div>
  );
}

function PluginCard({ p, busy, focused, onInstall, onToggle, onUninstall, installDisabled }: {
  p: CatalogPlugin; busy: boolean; focused: boolean;
  onInstall: () => void; onToggle: () => void; onUninstall: () => void; installDisabled: boolean;
}) {
  return (
    <div style={{
      padding: 12, background: 'var(--card)', borderRadius: 'var(--radius-md)',
      border: `1px solid ${focused ? 'var(--amber)' : 'var(--border)'}`,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Puzzle size={15} style={{ color: p.enabled ? '#22c55e' : 'var(--text-dim)' }} />
        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)', flex: 1 }}>{p.name}</span>
        {p.featured && <span style={badge('var(--amber)')}>★</span>}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <span style={badge('var(--text-muted)')}>{p.surface}</span>
        <span style={badge('var(--text-muted)')}>{p.distribution}</span>
        {p.installed
          ? <span style={badge(p.enabled ? '#22c55e' : 'var(--text-dim)')}>{p.enabled ? 'enabled' : 'disabled'}</span>
          : <span style={badge('var(--amber)')}>not installed</span>}
      </div>
      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.4, minHeight: 30 }}>{p.description}</p>
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        {!p.installed ? (
          <button onClick={onInstall} disabled={installDisabled} style={rowBtn}><Download size={12} /> Install</button>
        ) : (
          <>
            <button onClick={onToggle} disabled={busy} style={rowBtn}>
              {busy ? <Loader2 size={12} className="spin" /> : <Power size={12} />} {p.enabled ? 'Disable' : 'Enable'}
            </button>
            {p.distribution !== 'bundled' && (
              <button onClick={onUninstall} disabled={busy} style={{ ...rowBtn, color: '#ef4444' }}><Trash2 size={12} /></button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── styles ─────────────────────────────────────────────────────────
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: '0.78rem',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text)', fontFamily: 'var(--font-sans)', outline: 'none',
};
const btnAmber: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: '0.78rem', fontWeight: 600,
  background: 'var(--amber)', color: '#000', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0,
};
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: '0.78rem', fontWeight: 500,
  background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0,
};
const rowBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: '0.72rem', fontWeight: 500,
  background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const badge = (color: string): React.CSSProperties => ({
  fontSize: '0.6rem', fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-full)',
  color, border: `1px solid ${color}`, textTransform: 'uppercase', letterSpacing: '0.02em',
});
const trustNote: React.CSSProperties = {
  display: 'flex', gap: 8, padding: '8px 10px',
  background: 'color-mix(in srgb, var(--amber) 7%, transparent)',
  border: '1px solid color-mix(in srgb, var(--amber) 30%, var(--border))',
  borderRadius: 'var(--radius-sm)', fontSize: '0.7rem', color: 'var(--text-dim)', lineHeight: 1.5,
};
const reloadBanner: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 12,
  background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
  border: '1px solid var(--amber)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: 'var(--text)',
};
const logBox: React.CSSProperties = {
  maxHeight: 200, overflowY: 'auto', background: 'var(--surface-hover, var(--bg))',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 8,
  fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
};
const code: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: '0.9em', background: 'var(--surface-hover, var(--bg))', padding: '1px 4px', borderRadius: 3, color: 'var(--text)',
};

export default PluginsBrowser;
