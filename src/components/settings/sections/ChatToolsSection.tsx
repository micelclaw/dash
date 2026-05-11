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

import { useToolVisibility } from '@/hooks/use-tool-visibility';
import { TOOL_DEFS, type Preset, classify, shouldRenderTool } from '@/config/tool-rendering';

const PRESET_OPTIONS: Array<{ id: Preset; label: string; desc: string }> = [
  { id: 'minimal',  label: 'Minimal',  desc: 'Only delegations and scheduled tasks (Tier 1).' },
  { id: 'default',  label: 'Default',  desc: 'Delegations + bash, file edits, web/search (Tier 1+2). Recomendado.' },
  { id: 'verbose',  label: 'Verbose',  desc: 'Everything including memory, agents_list, process_status (Tier 1+2+3).' },
  { id: 'custom',   label: 'Custom',   desc: 'Default + manual overrides per-tool below.' },
];

export function ChatToolsSection() {
  const { visibility, setPreset, toggleTool, reset } = useToolVisibility();

  // Group TOOL_DEFS by tier for the table.
  const byTier = new Map<number, typeof TOOL_DEFS>();
  for (const def of TOOL_DEFS) {
    const arr = byTier.get(def.tier) ?? [];
    arr.push(def);
    byTier.set(def.tier, arr);
  }

  return (
    <div style={{ padding: '16px 24px', maxWidth: 720 }}>
      <header style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>
          Chat Tools Display
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
          Decide which tool calls (bash, edits, web fetches, delegations, memory lookups…) appear
          inside chat messages, collapsed by default. Verbose tools cluttering the chat? Pick "Minimal".
          Want to see exactly what the agent is doing? Pick "Verbose".
        </p>
      </header>

      {/* Preset selector */}
      <section style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
          Preset
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PRESET_OPTIONS.map((p) => (
            <label
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 12px',
                border: `1px solid ${visibility.preset === p.id ? 'var(--amber)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                background: visibility.preset === p.id ? 'var(--surface-hover)' : 'transparent',
              }}
            >
              <input
                type="radio"
                name="preset"
                checked={visibility.preset === p.id}
                onChange={() => setPreset(p.id)}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>{p.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{p.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Per-tool overrides */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
            Per-tool overrides
          </h3>
          <button
            onClick={reset}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-dim)',
              fontSize: '0.75rem',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            Reset all
          </button>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Toggle individual tools regardless of the active preset. Switching any toggle moves you to
          the "custom" preset.
        </p>
        {[1, 2, 3].map((tier) => {
          const items = byTier.get(tier) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={tier} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.04em' }}>
                Tier {tier}
                {tier === 1 && ' — featured (always visible by default)'}
                {tier === 2 && ' — visible (default preset)'}
                {tier === 3 && ' — hidden by default'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map((def) => {
                  const enabled = shouldRenderTool(def.name, visibility);
                  return (
                    <label
                      key={def.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '6px 10px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => toggleTool(def.name, e.target.checked)}
                      />
                      <span style={{ fontSize: '0.875rem' }}>{def.icon}</span>
                      <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text)' }}>{def.label}</span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                        {def.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
        <p style={{ margin: '12px 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          Unknown tools (not in this list) are classified as Tier 3 by default. They follow the
          preset rules unless explicitly toggled here.
        </p>
      </section>

      {/* Live classify utility for debugging — uncomment if useful */}
      {false && (
        <section style={{ marginTop: 24, padding: 12, background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Try a tool name: {classify('foo').label}
          </div>
        </section>
      )}
    </div>
  );
}
