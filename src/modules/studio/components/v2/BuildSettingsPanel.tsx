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

// ─── Studio v2 — per-project Build settings ────────────────────────
//
// Floating panel anchored to the header ⚙ button. Lets the user change
// the project's ENGINE (OpenCode / Claude Code / Codex — the "you can
// change it later" the create modal promises), its model (engine-aware:
// /studio/models for OpenCode, the curated list for ACP engines), and
// the token / turn caps for the Build phase. Switching engines with a
// live build returns 409 ENGINE_CHANGE_BLOCKED → explicit confirm →
// abort → retry. All writes go through the studio store so BuildPhase
// re-renders the right chat without a refresh.

import { useEffect, useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { useStudioStore, type StudioEngineId } from '@/stores/studio.store';
import { api, ApiError } from '@/services/api';
import { EnginePicker } from '../EnginePicker';
import { useStudioEngines } from '../../hooks/useStudioEngines';
import { useConfirm } from '../../lib/useConfirm';

interface Props {
  projectId: string;
  workspacePath: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function BuildSettingsPanel({ projectId, workspacePath, onClose, onSaved }: Props) {
  const fetchBuildSettings = useStudioStore((s) => s.fetchBuildSettings);
  const saveBuildSettings = useStudioStore((s) => s.saveBuildSettings);
  const updateProject = useStudioStore((s) => s.updateProject);
  const abortBuild = useStudioStore((s) => s.abortBuild);
  const { engines } = useStudioEngines();
  const { confirm, confirmDialog } = useConfirm();

  const [engine, setEngine] = useState<StudioEngineId>('opencode');
  const [initialEngine, setInitialEngine] = useState<StudioEngineId>('opencode');
  const [model, setModel] = useState<string | null>(null);
  const [initialModel, setInitialModel] = useState<string | null>(null);
  const [models, setModels] = useState<Array<{ id: string; label?: string; recommended?: boolean }>>([]);
  const [tokenCap, setTokenCap] = useState<number>(2_000_000);
  const [turnCap, setTurnCap] = useState<number>(80);
  const [forcePlan, setForcePlan] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const settings = await fetchBuildSettings(projectId);
        if (cancelled) return;
        setTokenCap(settings.build_token_cap);
        setTurnCap(settings.build_turn_cap);
        setForcePlan(settings.build_force_plan_mode);
        setEngine(settings.engine);
        setInitialEngine(settings.engine);
        setModel(settings.model);
        setInitialModel(settings.model);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, fetchBuildSettings]);

  // OpenCode models load lazily — only while the built-in engine is picked.
  useEffect(() => {
    if (loading || engine !== 'opencode' || models.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<{ data: { models: Array<{ id: string; label?: string; recommended?: boolean }> } }>('/studio/models');
        if (!cancelled) setModels(res.data.models ?? []);
      } catch { /* leave picker empty → falls back to showing current value */ }
    })();
    return () => { cancelled = true; };
  }, [loading, engine, models.length]);

  function changeEngine(next: StudioEngineId) {
    setEngine(next);
    // `model` is engine-scoped: restore the saved value when returning to
    // the saved engine, otherwise reset to the axis default.
    if (next === initialEngine) setModel(initialModel);
    else if (next === 'opencode') setModel(models.find((m) => m.recommended)?.id ?? models[0]?.id ?? null);
    else setModel(null);
  }

  const acpModels = engines.find((e) => e.id === engine)?.models ?? [];

  async function save() {
    setSaving(true);
    try {
      const engineChanged = engine !== initialEngine;
      const modelChanged = (model ?? '') !== (initialModel ?? '');
      if (engineChanged || modelChanged) {
        const body = engineChanged
          ? { engine, model: model || null }
          : { model: model || null };
        try {
          await updateProject(projectId, body);
        } catch (err) {
          if (engineChanged && err instanceof ApiError && err.code === 'ENGINE_CHANGE_BLOCKED') {
            const ok = await confirm({
              title: 'Stop the current build and switch engines?',
              body: 'A build session is running on this project. Switching engines stops it — anything already written to the workspace is kept, and you can start a new build with the new engine.',
              confirmLabel: 'Stop build & switch',
              danger: true,
            });
            if (!ok) { setSaving(false); return; }
            await abortBuild(projectId);
            await updateProject(projectId, body);
          } else {
            throw err;
          }
        }
        setInitialEngine(engine);
        setInitialModel(model);
      }
      await saveBuildSettings(projectId, {
        build_token_cap: tokenCap,
        build_turn_cap: turnCap,
        build_force_plan_mode: forcePlan,
      });
      setError(null);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'absolute', top: 48, right: 16, zIndex: 30,
      width: 380, maxWidth: 'calc(100vw - 32px)',
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>Build settings</span>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 4, color: 'var(--text-dim)', display: 'flex',
          }}
        >
          <X size={14} />
        </button>
      </div>
      <div style={{ padding: 14, maxHeight: '70vh', overflowY: 'auto' }}>
        {loading && <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Loading…</div>}
        {!loading && error && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 6,
            padding: '8px 10px', marginBottom: 12,
            background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
            border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)',
            fontSize: '0.7rem', color: 'var(--danger)',
          }}>
            <AlertCircle size={12} style={{ marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}
        {!loading && (
          <>
            <Field label="Engine">
              <EnginePicker
                variant="compact"
                engines={engines}
                engine={engine}
                onEngineChange={changeEngine}
                model={model ?? ''}
                onModelChange={(m) => setModel(m || null)}
                models={models}
              />
              <p style={hintStyle}>
                Which engine runs the build. Switching with a build in progress asks you to stop it first. Saved with "Save".
              </p>
            </Field>

            {engine === 'opencode' && models.length === 0 && (
              <Field label="Project model">
                <code style={{
                  display: 'block', padding: '8px 10px',
                  background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem', color: 'var(--text)', fontFamily: 'var(--font-mono)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{model ?? '(no model picked)'}</code>
                <p style={hintStyle}>
                  Applies to every phase. Only models the build engine (OpenCode) can actually reach are listed.
                </p>
              </Field>
            )}
            {engine === 'opencode' && models.length > 0 && model && !models.some((m) => m.id === model) && (
              <p style={{ ...hintStyle, marginTop: -6, marginBottom: 12 }}>
                Current model <code style={{ fontFamily: 'var(--font-mono)' }}>{model}</code> isn't reachable by OpenCode right now — pick one from the list above.
              </p>
            )}
            {engine !== 'opencode' && acpModels.length === 0 && (
              <p style={{ ...hintStyle, marginTop: -6, marginBottom: 12 }}>
                Model: {model || 'harness default'}.
              </p>
            )}

            <Field label="Token cap">
              <input
                type="number"
                min={10_000}
                max={50_000_000}
                step={100_000}
                value={tokenCap}
                onChange={(e) => setTokenCap(parseInt(e.target.value, 10) || 0)}
                style={inputStyle}
              />
              <p style={hintStyle}>Hard cap on the build's cumulative tokens. Default 2M.</p>
            </Field>

            <Field label="Turn cap">
              <input
                type="number"
                min={1}
                max={1000}
                value={turnCap}
                onChange={(e) => setTurnCap(parseInt(e.target.value, 10) || 0)}
                style={inputStyle}
              />
              <p style={hintStyle}>Maximum number of agent turns. Default 80.</p>
            </Field>

            <Field label="Mode">
              <select
                value={forcePlan ? 'force_plan' : 'build'}
                onChange={(e) => setForcePlan(e.target.value === 'force_plan')}
                style={inputStyle}
              >
                <option value="build">Build mode (default)</option>
                <option value="force_plan">Forced plan mode</option>
              </select>
              <p style={hintStyle}>
                <strong>Build:</strong> the agent executes without asking per turn (only
                the first turn goes through plan mode).<br />
                <strong>Forced plan:</strong> every turn starts in plan mode — the agent
                proposes before acting and you approve manually.
              </p>
            </Field>

            {workspacePath && (
              <Field label="Workspace">
                <code style={{
                  display: 'block', padding: '6px 8px',
                  background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
                  fontSize: '0.7rem', color: 'var(--text-dim)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-mono)',
                }}>{workspacePath}</code>
              </Field>
            )}
          </>
        )}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 8,
        padding: '10px 14px', borderTop: '1px solid var(--border)',
      }}>
        <button onClick={onClose} style={btnSecondary}>Cancel</button>
        <button onClick={() => { void save(); }} disabled={loading || saving} style={btnPrimary}>
          <Save size={12} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {confirmDialog}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'block', fontSize: '0.7rem', fontWeight: 600,
        color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em',
        marginBottom: 4,
      }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '6px 8px', fontSize: '0.8125rem',
  background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-mono)',
};
const hintStyle: React.CSSProperties = {
  margin: '4px 0 0', fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.4,
};
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600,
  background: 'var(--amber)', color: '#000',
  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  padding: '6px 12px', fontSize: '0.75rem',
  background: 'transparent', color: 'var(--text-dim)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
};
