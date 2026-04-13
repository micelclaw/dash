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

// ─── PreviewPanel — interactive API explorer for the sandbox ────────
//
// Phase 8 ships an in-dash API explorer instead of a Vite-served
// iframe. Rationale: L2 Studio apps treat the dash itself as their
// frontend; the LLM only generates `api/*.route.mjs` (no React/JSX in
// the workspace). The explorer lets the user fill in path params, body,
// and execute requests against the live sandbox dispatch — giving the
// same "see your app working" feedback loop as a hot-reloading frontend
// without requiring any subprocess, node_modules, or framework code.
//
// Each route is collapsible. The body editor is a textarea (JSON
// validated on submit). Path params get a small inline form. Response
// is rendered as syntax-coloured JSON with status code + duration.

import { useEffect, useMemo, useState } from 'react';
import { Play, Loader2, RefreshCw, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { useStudioStore, type StudioMountedRoute } from '@/stores/studio.store';

interface Props {
  projectId: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET:    '#22c55e',
  POST:   '#3b82f6',
  PATCH:  '#f59e0b',
  PUT:    '#f59e0b',
  DELETE: '#ef4444',
};

export function PreviewPanel({ projectId }: Props) {
  const fetchSandboxRoutes = useStudioStore((s) => s.fetchSandboxRoutes);
  const callSandbox = useStudioStore((s) => s.callSandbox);

  const [routes, setRoutes] = useState<StudioMountedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setRoutes(await fetchSandboxRoutes(projectId));
    } catch (err) {
      console.warn('[studio] fetch routes failed', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [projectId]);

  // Group routes by their first path segment for visual hierarchy
  const grouped = useMemo(() => groupRoutes(routes), [routes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--card)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <span style={{
          fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em',
          color: 'var(--text-muted)', fontWeight: 600,
        }}>
          API explorer
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
          {routes.length} {routes.length === 1 ? 'ruta' : 'rutas'}
        </span>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={refresh} style={refreshBtn} title="Recargar rutas">
          <RefreshCw size={11} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {loading && routes.length === 0 ? (
          <div style={emptyHint}>
            <Loader2 size={14} className="animate-spin" /> Cargando rutas…
          </div>
        ) : routes.length === 0 ? (
          <div style={emptyHint}>
            <AlertCircle size={14} />
            Aún no hay rutas montadas. Ejecuta una sesión que genere un archivo
            <code style={{ margin: '0 4px', fontFamily: 'var(--font-mono)' }}>api/*.route.mjs</code>.
          </div>
        ) : (
          <>
            {grouped.map(({ group, items }) => (
              <div key={group} style={{ marginBottom: 12 }}>
                <div style={groupHeader}>{group}</div>
                {items.map((r) => {
                  const key = `${r.method} ${r.pattern}`;
                  return (
                    <RouteCard
                      key={key}
                      route={r}
                      expanded={expandedKey === key}
                      onToggle={() => setExpandedKey((k) => (k === key ? null : key))}
                      onCall={(method, path, body) => callSandbox(projectId, method, path, body)}
                    />
                  );
                })}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── RouteCard ──────────────────────────────────────────────────────

interface RouteCardProps {
  route: StudioMountedRoute;
  expanded: boolean;
  onToggle: () => void;
  onCall: (method: string, path: string, body: unknown) => Promise<{ status: number; body: unknown; durationMs: number }>;
}

function RouteCard({ route, expanded, onToggle, onCall }: RouteCardProps) {
  const [params, setParams] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState('{}');
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<{ status: number; body: unknown; durationMs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasBody = route.method !== 'GET' && route.method !== 'DELETE';
  const color = METHOD_COLORS[route.method] ?? 'var(--text-muted)';

  async function handleExecute() {
    setBusy(true);
    setError(null);
    try {
      // Substitute :param with the user's input
      let path = route.pattern;
      for (const name of route.param_names) {
        const v = params[name] ?? '';
        path = path.replace(new RegExp(`:${name}\\b`, 'g'), encodeURIComponent(v));
      }

      let body: unknown = undefined;
      if (hasBody) {
        try {
          body = bodyText.trim().length > 0 ? JSON.parse(bodyText) : null;
        } catch {
          setError('Body no es JSON válido');
          setBusy(false);
          return;
        }
      }

      const res = await onCall(route.method, path, body);
      setResponse(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      marginBottom: 6,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '6px 8px',
          background: 'transparent', border: 'none',
          textAlign: 'left', cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span style={{
          fontSize: '0.625rem', fontWeight: 700, color,
          minWidth: 42, textAlign: 'center',
          padding: '1px 4px',
          border: `1px solid ${color}55`,
          borderRadius: 'var(--radius-sm)',
        }}>
          {route.method}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text)', flex: 1, minWidth: 0 }}>
          {route.pattern}
        </span>
      </button>

      {expanded && (
        <div style={{
          padding: 10, borderTop: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 8,
          background: 'var(--surface)',
        }}>
          {route.param_names.length > 0 && (
            <div>
              <div style={fieldLabel}>Parámetros</div>
              {route.param_names.map((name) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={paramName}>:{name}</span>
                  <input
                    type="text"
                    value={params[name] ?? ''}
                    onChange={(e) => setParams((p) => ({ ...p, [name]: e.target.value }))}
                    placeholder={`<${name}>`}
                    style={input}
                  />
                </div>
              ))}
            </div>
          )}

          {hasBody && (
            <div>
              <div style={fieldLabel}>Body (JSON)</div>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={4}
                spellCheck={false}
                style={{
                  ...input, width: '100%',
                  fontFamily: 'var(--font-mono)', fontSize: '0.6875rem',
                  resize: 'vertical', marginTop: 4,
                }}
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleExecute}
            disabled={busy}
            style={executeBtn(busy)}
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
            {busy ? 'Ejecutando…' : 'Ejecutar'}
          </button>

          {error && (
            <div style={{
              padding: 6, fontSize: '0.6875rem', color: 'var(--text)',
              background: 'color-mix(in srgb, var(--danger) 12%, var(--card))',
              border: '1px solid color-mix(in srgb, var(--danger) 40%, var(--border))',
              borderRadius: 'var(--radius-sm)',
            }}>
              {error}
            </div>
          )}

          {response && (
            <ResponseBlock response={response} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── ResponseBlock ──────────────────────────────────────────────────

function ResponseBlock({ response }: { response: { status: number; body: unknown; durationMs: number } }) {
  const ok = response.status >= 200 && response.status < 300;
  const color = ok ? '#22c55e' : 'var(--danger)';
  const pretty = useMemo(() => {
    try { return JSON.stringify(response.body, null, 2); }
    catch { return String(response.body); }
  }, [response.body]);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: '0.6875rem', marginBottom: 4,
      }}>
        <span style={{
          padding: '1px 6px', fontWeight: 700,
          background: `${color}22`, color, borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-mono)',
        }}>
          {response.status}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>{response.durationMs}ms</span>
      </div>
      <pre style={{
        margin: 0, padding: 8,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.625rem', fontFamily: 'var(--font-mono)',
        color: 'var(--text)',
        maxHeight: 320, overflow: 'auto',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {pretty}
      </pre>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function groupRoutes(routes: StudioMountedRoute[]): Array<{ group: string; items: StudioMountedRoute[] }> {
  const map = new Map<string, StudioMountedRoute[]>();
  for (const r of routes) {
    const seg = r.pattern.split('/').filter(Boolean)[0] ?? 'root';
    const arr = map.get(seg) ?? [];
    arr.push(r);
    map.set(seg, arr);
  }
  return [...map.entries()]
    .map(([group, items]) => ({ group, items }))
    .sort((a, b) => a.group.localeCompare(b.group));
}

// ─── Styles ─────────────────────────────────────────────────────────

const refreshBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  padding: 4, background: 'transparent',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text-dim)', cursor: 'pointer',
};
const emptyHint: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  height: '100%', color: 'var(--text-dim)', fontSize: '0.75rem',
  textAlign: 'center', padding: 16,
};
const groupHeader: React.CSSProperties = {
  padding: '4px 8px', fontSize: '0.625rem',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'var(--text-muted)', fontWeight: 600,
};
const fieldLabel: React.CSSProperties = {
  fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'var(--text-muted)', fontWeight: 600,
};
const paramName: React.CSSProperties = {
  fontSize: '0.6875rem', fontFamily: 'var(--font-mono)',
  color: 'var(--text-dim)', minWidth: 60,
};
const input: React.CSSProperties = {
  flex: 1, padding: '4px 6px', fontSize: '0.6875rem',
  background: 'var(--card)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-sans)',
};
const executeBtn = (busy: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  padding: '6px 12px',
  background: 'var(--amber)', color: '#000',
  border: 'none', borderRadius: 'var(--radius-sm)',
  fontSize: '0.6875rem', fontWeight: 600,
  cursor: busy ? 'wait' : 'pointer',
  fontFamily: 'var(--font-sans)',
});
