/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import * as agentsAdmin from '@/services/agents-admin.service';
import { describeError } from '@/lib/api-errors';
import { SectionShell } from '../shared/SectionShell';

const TOOL_DESCRIPTIONS: Record<string, string> = {
  read: 'Read file contents from the agent workspace',
  write: 'Create new files or overwrite existing ones',
  edit: 'Make precise line-level edits to files',
  apply_patch: 'Apply unified diffs/patches to files (OpenAI format)',
  exec: 'Run shell commands (ls, git, curl, etc.)',
  process: 'Manage long-running background processes',
  web_search: 'Search the web via Brave, Perplexity, or other providers',
  web_fetch: 'Download and read web page content',
  memory_search: 'Semantic search across agent memory files',
  memory_get: 'Read specific memory files by path',
  sessions_list: 'List active chat sessions',
  sessions_history: 'Read message history from a session',
  sessions_send: 'Send a message to another session',
  sessions_spawn: 'Create a sub-agent to handle a task',
  sessions_yield: 'Receive results from a spawned sub-agent',
  subagents: 'List, steer, or terminate running sub-agents',
  session_status: 'Check current session state and metadata',
  browser: 'Control a headless browser (navigate, click, type, screenshot)',
  canvas: 'Render HTML/SVG canvas for visual output',
  message: 'Send messages to external channels (Telegram, Discord, etc.)',
  cron: 'Create, edit, or manage scheduled tasks',
  gateway: 'Read or modify gateway configuration',
  nodes: 'Interact with remote nodes and devices',
  agents_list: 'List other agents in the system',
  image: 'Analyze and understand image content',
  tts: 'Convert text replies to audio (text-to-speech)',
};

const ALL_TOOLS = Object.keys(TOOL_DESCRIPTIONS);

// Native OpenClaw preset definitions (base, before allow/deny overrides)
const PRESET_TOOLS: Record<string, Set<string>> = {
  minimal: new Set(['session_status']),
  coding: new Set([
    'read', 'write', 'edit', 'apply_patch', 'exec', 'process',
    'web_search', 'web_fetch', 'memory_search', 'memory_get',
    'sessions_list', 'sessions_history', 'sessions_send',
    'sessions_spawn', 'sessions_yield', 'subagents', 'session_status',
    'cron', 'image',
  ]),
  messaging: new Set([
    'sessions_list', 'sessions_history', 'sessions_send',
    'session_status', 'message',
  ]),
  full: new Set(ALL_TOOLS),
};

const PROFILES = [
  { value: 'minimal', label: 'Minimal', desc: '1 tool — session_status only' },
  { value: 'coding', label: 'Coding', desc: '19 tools — files, runtime, web, memory, sessions (recommended)' },
  { value: 'messaging', label: 'Messaging', desc: '5 tools — sessions + message' },
  { value: 'full', label: 'Full', desc: 'All 26 tools enabled' },
];

// Tool access response shape lives in agents-admin.service.ts now.

export function ToolAccessDefaultsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [profile, setProfile] = useState('coding');
  // alsoAllow: tools to add ON TOP of the preset (without replacing allow)
  // deny: tools to remove FROM the preset
  const [alsoAllow, setAlsoAllow] = useState<Set<string>>(new Set());
  const [deny, setDeny] = useState<Set<string>>(new Set());

  const [firstAgentId, setFirstAgentId] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const agents = await agentsAdmin.listManagedAgents();
      const first = agents[0];
      if (first?.id) {
        setFirstAgentId(first.id);
        const data = await agentsAdmin.getToolAccess(first.id);
        setProfile(data.global.profile ?? 'coding');
        setAlsoAllow(new Set(data.global.also_allow ?? data.global.allow ?? []));
        setDeny(new Set(data.global.deny ?? []));
      }
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to load tool access defaults'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const isToolEnabled = (tool: string): boolean => {
    if (deny.has(tool)) return false;
    if (alsoAllow.has(tool)) return true;
    const base = PRESET_TOOLS[profile] ?? PRESET_TOOLS.coding;
    return base.has(tool);
  };

  const handleToolToggle = (tool: string) => {
    const base = PRESET_TOOLS[profile] ?? PRESET_TOOLS.coding;
    const currentlyEnabled = isToolEnabled(tool);
    const newAlsoAllow = new Set(alsoAllow);
    const newDeny = new Set(deny);

    if (currentlyEnabled) {
      // Disable the tool
      newAlsoAllow.delete(tool);
      if (base.has(tool)) {
        // Tool is in the base preset — need to deny it
        newDeny.add(tool);
      }
    } else {
      // Enable the tool
      newDeny.delete(tool);
      if (!base.has(tool)) {
        // Tool is NOT in the base preset — need to also-allow it
        newAlsoAllow.add(tool);
      }
    }

    setAlsoAllow(newAlsoAllow);
    setDeny(newDeny);
    setDirty(true);
  };

  const handleProfileSelect = (value: string) => {
    setProfile(value);
    // Reset overrides when changing profile
    setAlsoAllow(new Set());
    setDeny(new Set());
    setDirty(true);
  };

  const handleSave = async () => {
    if (!firstAgentId) return;
    setSaving(true);
    try {
      await agentsAdmin.updateToolAccess(firstAgentId, {
        scope: 'global',
        profile,
        allow: alsoAllow.size > 0 ? [...alsoAllow] : null,
        deny: deny.size > 0 ? [...deny] : null,
      });
      toast.success('Global tool access defaults updated');
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to update tool access defaults'));
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = ALL_TOOLS.filter(t => isToolEnabled(t)).length;
  const hasOverrides = alsoAllow.size > 0 || deny.size > 0;

  // Loading state is rendered by SectionShell. The "no agents" state
  // is a separate empty-state — bypass the shell entirely.
  if (!loading && !firstAgentId) {
    return (
      <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        No agents available yet. Create an agent first under <strong>Agents</strong>.
      </div>
    );
  }

  return (
    <SectionShell
      title="Tool Access Defaults"
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
    >
      <p style={{ margin: '-12px 0 20px', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
        Global default applied to every agent set to <strong>Inherit</strong> mode.
        Agents with their own preset (Minimal/Coding/Messaging/Full) ignore this.{' '}
        <Link
          to="/agents"
          style={{ color: 'var(--amber)', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          Per-agent overrides <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'baseline' }} />
        </Link>
        {hasOverrides && <span style={{ color: 'var(--amber)', marginLeft: 6 }}>· custom overrides active</span>}
      </p>

      {/* Profile selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {PROFILES.map(p => (
          <label
            key={p.value}
            onClick={() => handleProfileSelect(p.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
              background: profile === p.value ? 'var(--surface-hover)' : 'var(--surface)',
              border: profile === p.value ? '1px solid var(--amber-dim)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              border: profile === p.value ? '5px solid var(--amber)' : '2px solid var(--text-muted)',
              background: 'transparent', flexShrink: 0,
              transition: 'border 0.2s',
            }} />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>{p.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>{p.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Interactive tool tags */}
      <div>
        <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Tools enabled ({enabledCount}/{ALL_TOOLS.length})
        </h3>
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>
          Click to toggle. Overrides are saved on top of the selected profile.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {ALL_TOOLS.map(tool => {
            const enabled = isToolEnabled(tool);
            const base = PRESET_TOOLS[profile] ?? PRESET_TOOLS.coding;
            const isOverrideAdded = alsoAllow.has(tool); // added on top of preset
            const isOverrideRemoved = deny.has(tool) && base.has(tool); // removed from preset
            return (
              <span
                key={tool}
                onClick={() => handleToolToggle(tool)}
                style={{
                  padding: '4px 10px', fontSize: '0.6875rem',
                  background: enabled ? '#22c55e18' : 'var(--surface)',
                  color: enabled ? '#22c55e' : 'var(--text-muted)',
                  border: `1px solid ${
                    isOverrideAdded ? 'var(--amber-dim)' :
                    isOverrideRemoved ? '#ef444440' :
                    enabled ? '#22c55e30' : 'var(--border)'
                  }`,
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-mono, var(--font-sans))',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                  textDecoration: isOverrideRemoved ? 'line-through' : 'none',
                  userSelect: 'none',
                }}
                title={TOOL_DESCRIPTIONS[tool] ?? tool}
              >
                {tool}
              </span>
            );
          })}
        </div>
        {hasOverrides && (
          <button
            onClick={() => { setAlsoAllow(new Set()); setDeny(new Set()); setDirty(true); }}
            style={{
              marginTop: 8, padding: '3px 8px', fontSize: '0.6875rem',
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Clear overrides
          </button>
        )}
      </div>
    </SectionShell>
  );
}
