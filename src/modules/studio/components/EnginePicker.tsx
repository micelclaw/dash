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

// ─── Studio v3 — EnginePicker (§A1) ─────────────────────────────────
//
// The engine chooser shown when starting a project. Replaces the tiny
// "Engine:" <select> with didactic cards (see the plan's D1 preview):
//   - Built-in (OpenCode)  — recommended, always ready, sub-picks a model.
//   - Claude Code / Codex  — server-side ACP engines; show "Requires
//                            setup" until acpx is enabled, with a
//                            [Configure] deep-link to Settings.
//   - Bring your own tool  — BYO (open in your editor); orthogonal, only
//                            rendered when the parent passes onChooseByo.
//
// Controlled: the parent owns `engine` + `model` and passes the engine
// list (from useStudioEngines, which refreshes on focus). Falls back to
// OpenCode-only when the list hasn't arrived (old Core / fetch failed).
// Every engine gets a model sub-selector when selected: opencode picks
// from `models` (/studio/models), ACP engines pick from their curated
// `engine.models` ('' = harness default).

import { useState } from 'react';
import { Cpu, Command, SquareTerminal, Cloud, Check, TriangleAlert, ChevronDown, Settings } from 'lucide-react';
import type { StudioEngineId, StudioEngineInfo } from '@/stores/studio.store';

export interface EngineModelOption {
  id: string;
  label?: string;
  recommended?: boolean;
}

interface Props {
  /** Engine list + readiness (useStudioEngines). Empty → OpenCode-only fallback. */
  engines?: StudioEngineInfo[];
  engine: StudioEngineId;
  onEngineChange: (e: StudioEngineId) => void;
  /** The selected engine's model: `<provider>/<model>` for opencode, a
   *  curated alias/id for ACP engines ('' = harness default). */
  model: string;
  onModelChange: (m: string) => void;
  /** OpenCode model list (/studio/models); ACP lists ride on the engine. */
  models: EngineModelOption[];
  /** Deep-link to Settings → Studio Engines (for not-ready ACP engines).
   *  Receives the engine id so Settings can focus that engine's key field. */
  onConfigureEngine?: (engineId?: StudioEngineId) => void;
  /** When provided, renders a "Bring your own tool" card that calls this. */
  onChooseByo?: () => void;
  variant?: 'full' | 'compact';
  disabled?: boolean;
}

const ICONS: Record<StudioEngineId, typeof Cpu> = {
  opencode: Cpu,
  acp_claude: Command,
  acp_codex: SquareTerminal,
};

/** OpenCode-only fallback used before Core exposes /studio/engines. */
const FALLBACK_ENGINES: StudioEngineInfo[] = [
  {
    id: 'opencode',
    label: 'Built-in (OpenCode)',
    kind: 'builtin',
    ready: true,
    blurb: 'Runs here, fully guided and safe. Zero setup.',
    detail: { cli_installed: true, vendor_auth: true, acpx_enabled: true },
  },
];

export function EnginePicker({
  engines: enginesProp, engine, onEngineChange, model, onModelChange, models,
  onConfigureEngine, onChooseByo, variant = 'full', disabled,
}: Props) {
  const engines = enginesProp && enginesProp.length > 0 ? enginesProp : FALLBACK_ENGINES;
  const [explain, setExplain] = useState(false);

  const compact = variant === 'compact';

  function pick(e: StudioEngineInfo) {
    if (disabled) return;
    // Picking a not-ready ACP engine still selects it (so the user sees
    // their choice) but the parent should route them to Configure first.
    onEngineChange(e.id);
    if (!e.ready) onConfigureEngine?.(e.id);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 10 }}>
      {engines.map((e) => {
        const Icon = ICONS[e.id] ?? Cpu;
        const selected = engine === e.id;
        return (
          <div
            key={e.id}
            role="radio"
            aria-checked={selected}
            tabIndex={disabled ? -1 : 0}
            onClick={() => pick(e)}
            onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(e); } }}
            style={cardStyle(selected, compact, disabled)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={radioDot(selected)} />
              <Icon size={compact ? 15 : 18} style={{ color: selected ? 'var(--amber)' : 'var(--text-dim)', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, fontSize: compact ? '0.8rem' : '0.9rem', color: 'var(--text)' }}>
                {e.label}
              </span>
              {e.id === 'opencode' && (
                <span style={recBadge}>★ Recommended</span>
              )}
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {e.ready
                  ? <span style={statusOk}><Check size={12} /> Ready</span>
                  : <span style={statusWarn}><TriangleAlert size={12} /> Requires setup</span>}
              </span>
            </div>

            {!compact && (
              <p style={{ margin: '4px 0 0 28px', fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                {e.blurb}
              </p>
            )}

            {/* Requires-setup detail + Configure CTA */}
            {!e.ready && (
              <div style={{ margin: `${compact ? 4 : 6}px 0 0 28px`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {e.requires && e.requires.length > 0 && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Needs: {e.requires.join(' · ')}
                  </span>
                )}
                {onConfigureEngine && (
                  <button
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); onConfigureEngine(e.id); }}
                    style={configureBtn}
                  >
                    <Settings size={12} /> Configure — Settings › Studio Engines
                  </button>
                )}
              </div>
            )}

            {/* Model sub-selector, only when selected. OpenCode picks from
                /studio/models; ACP engines from their curated list. */}
            {selected && (() => {
              const options = e.id === 'opencode' ? models : (e.models ?? []);
              if (options.length === 0) return null;
              return (
                <div style={{ margin: `${compact ? 6 : 10}px 0 2px 28px` }} onClick={(ev) => ev.stopPropagation()}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    Model
                    <select
                      value={model}
                      disabled={disabled}
                      onChange={(ev) => onModelChange(ev.target.value)}
                      style={modelSelect}
                    >
                      {options.map((m) => (
                        <option key={m.id} value={m.id}>
                          {(m.label ?? m.id)}{m.recommended && !(m.label ?? '').toLowerCase().includes('recommended') ? ' · recommended' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })()}
          </div>
        );
      })}

      {/* Bring your own tool — orthogonal escape hatch */}
      {onChooseByo && (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => { if (!disabled) onChooseByo(); }}
          onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (!disabled) onChooseByo(); } }}
          style={cardStyle(false, compact, disabled)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={radioDot(false)} />
            <Cloud size={compact ? 15 : 18} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: compact ? '0.8rem' : '0.9rem', color: 'var(--text)' }}>
              Bring your own tool
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--text-muted)' }}>advanced</span>
          </div>
          {!compact && (
            <p style={{ margin: '4px 0 0 28px', fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
              Open the project in YOUR Claude Code / Cursor / Codex, on your machine, with your
              subscription. Creates the project and gives you a connection file for your editor.
            </p>
          )}
        </div>
      )}

      {/* "How do these differ?" explainer */}
      <div>
        <button
          type="button"
          onClick={() => setExplain((v) => !v)}
          style={explainToggle}
        >
          <ChevronDown size={13} style={{ transform: explain ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          How do these differ?
        </button>
        {explain && (
          <div style={explainBox}>
            <div>▸ <b>Built-in</b> — we run it here for you, guided &amp; governed.</div>
            <div>▸ <b>Claude Code / Codex</b> — delegated to your own server (needs a one-time setup).</div>
            <div>▸ <b>Your own tool</b> — you drive it in your editor.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── styles ─────────────────────────────────────────────────────────

const cardStyle = (selected: boolean, compact: boolean, disabled?: boolean): React.CSSProperties => ({
  padding: compact ? '8px 10px' : '12px 14px',
  background: selected ? 'color-mix(in srgb, var(--amber) 7%, var(--card))' : 'var(--card)',
  border: `1px solid ${selected ? 'var(--amber)' : 'var(--border)'}`,
  borderRadius: 'var(--radius-md)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
  fontFamily: 'var(--font-sans)',
  transition: 'border-color .12s, background .12s',
});
const radioDot = (selected: boolean): React.CSSProperties => ({
  width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
  border: `2px solid ${selected ? 'var(--amber)' : 'var(--border)'}`,
  background: selected ? 'var(--amber)' : 'transparent',
  boxShadow: selected ? 'inset 0 0 0 2px var(--card)' : 'none',
});
const recBadge: React.CSSProperties = {
  fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.02em',
  color: 'var(--amber)', textTransform: 'uppercase',
};
const statusOk: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: '0.7rem', color: 'var(--success, #16a34a)', fontWeight: 500,
};
const statusWarn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: '0.7rem', color: 'var(--amber)', fontWeight: 500,
};
const configureBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
  padding: '5px 10px', fontSize: '0.7rem', fontWeight: 600,
  background: 'color-mix(in srgb, var(--amber) 12%, transparent)',
  border: '1px solid var(--amber)', color: 'var(--amber)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const modelSelect: React.CSSProperties = {
  background: 'var(--surface-2)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 6,
  padding: '6px 10px', fontSize: '0.8rem', width: '100%', maxWidth: 340,
  fontFamily: 'var(--font-sans)',
};
const explainToggle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 0',
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--text-dim)', fontSize: '0.72rem', fontFamily: 'var(--font-sans)',
};
const explainBox: React.CSSProperties = {
  marginTop: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4,
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.5,
};

export default EnginePicker;
