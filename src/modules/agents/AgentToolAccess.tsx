/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface AgentToolAccessProps {
  agentId: string;
  agentName: string;
}

type ToolProfile = 'inherit' | 'minimal' | 'coding' | 'messaging' | 'full' | 'custom';

interface ToolAccessResponse {
  data: {
    global: { profile: string | null; allow: string[] | null; deny: string[] | null };
    agent: { profile: string | null; allow: string[] | null; deny: string[] | null };
    openclaw_agent_id: string;
  };
}

const TOOL_GROUPS: { label: string; tools: { name: string; desc: string }[] }[] = [
  { label: 'Files', tools: [
    { name: 'read', desc: 'Read file contents' },
    { name: 'write', desc: 'Create or overwrite files' },
    { name: 'edit', desc: 'Make precise edits' },
    { name: 'apply_patch', desc: 'Patch files (OpenAI)' },
  ]},
  { label: 'Runtime', tools: [
    { name: 'exec', desc: 'Run shell commands' },
    { name: 'process', desc: 'Manage background processes' },
  ]},
  { label: 'Web', tools: [
    { name: 'web_search', desc: 'Search the web' },
    { name: 'web_fetch', desc: 'Fetch web content' },
  ]},
  { label: 'Memory', tools: [
    { name: 'memory_search', desc: 'Semantic search' },
    { name: 'memory_get', desc: 'Read memory files' },
  ]},
  { label: 'Sessions', tools: [
    { name: 'sessions_list', desc: 'List sessions' },
    { name: 'sessions_history', desc: 'Session history' },
    { name: 'sessions_send', desc: 'Send to session' },
    { name: 'sessions_spawn', desc: 'Spawn sub-agent' },
    { name: 'sessions_yield', desc: 'Receive sub-agent results' },
    { name: 'subagents', desc: 'Manage sub-agents' },
    { name: 'session_status', desc: 'Session status' },
  ]},
  { label: 'UI', tools: [
    { name: 'browser', desc: 'Control web browser' },
    { name: 'canvas', desc: 'Control canvases' },
  ]},
  { label: 'Messaging', tools: [
    { name: 'message', desc: 'Send messages' },
  ]},
  { label: 'Automation', tools: [
    { name: 'cron', desc: 'Schedule tasks' },
    { name: 'gateway', desc: 'Gateway control' },
  ]},
  { label: 'Other', tools: [
    { name: 'nodes', desc: 'Nodes & devices' },
    { name: 'agents_list', desc: 'List agents' },
    { name: 'image', desc: 'Image understanding' },
    { name: 'tts', desc: 'Text-to-speech' },
  ]},
];

const ALL_TOOLS = TOOL_GROUPS.flatMap(g => g.tools.map(t => t.name));

// Native OpenClaw preset definitions (source of truth)
const PRESET_TOOLS: Record<string, Set<string>> = {
  minimal: new Set(['session_status']),
  coding: new Set([
    'read', 'write', 'edit', 'apply_patch',
    'exec', 'process',
    'web_search', 'web_fetch',
    'memory_search', 'memory_get',
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

const PRESETS: { label: string; value: ToolProfile; desc: string }[] = [
  { label: 'Inherit', value: 'inherit', desc: 'Use global defaults from Settings' },
  { label: 'Minimal', value: 'minimal', desc: '1 tool: session_status only' },
  { label: 'Coding', value: 'coding', desc: '19 tools: files, runtime, web, memory, sessions' },
  { label: 'Messaging', value: 'messaging', desc: '5 tools: sessions + message' },
  { label: 'Full', value: 'full', desc: 'All 26 tools enabled' },
  { label: 'Custom', value: 'custom', desc: 'Per-agent allow/deny overrides' },
];

function getActiveProfile(agent: { profile: string | null; allow: string[] | null; deny: string[] | null }): ToolProfile {
  // If agent has explicit allow/deny lists → custom
  if (agent.allow || agent.deny) return 'custom';
  // If agent has a profile set → that profile
  if (agent.profile && ['minimal', 'coding', 'messaging', 'full'].includes(agent.profile)) {
    return agent.profile as ToolProfile;
  }
  // No override → inherit
  return 'inherit';
}

function getToolsForProfile(profile: ToolProfile, globalProfile: string | null): Set<string> {
  if (profile === 'inherit') {
    const gp = globalProfile ?? 'coding';
    return PRESET_TOOLS[gp] ?? PRESET_TOOLS.coding;
  }
  if (profile === 'custom') return PRESET_TOOLS.full; // custom starts with all enabled
  return PRESET_TOOLS[profile] ?? PRESET_TOOLS.coding;
}

export function AgentToolAccess({ agentId, agentName }: AgentToolAccessProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [globalProfile, setGlobalProfile] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<ToolProfile>('inherit');
  const [customAllow, setCustomAllow] = useState<Set<string>>(new Set());
  const [customDeny, setCustomDeny] = useState<Set<string>>(new Set());

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ToolAccessResponse>(`/managed-agents/${agentId}/tool-access`);
      setGlobalProfile(res.data.global.profile);
      const profile = getActiveProfile(res.data.agent);
      setActiveProfile(profile);
      if (profile === 'custom') {
        setCustomAllow(new Set(res.data.agent.allow ?? []));
        setCustomDeny(new Set(res.data.agent.deny ?? []));
      }
      setDirty(false);
    } catch {
      toast.error('Failed to load tool access config');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleProfileSelect = (profile: ToolProfile) => {
    setActiveProfile(profile);
    if (profile !== 'custom') {
      setCustomAllow(new Set());
      setCustomDeny(new Set());
    }
    setDirty(true);
  };

  const isToolEnabled = (tool: string): boolean => {
    if (activeProfile === 'custom') {
      if (customDeny.has(tool)) return false;
      if (customAllow.has(tool)) return true;
      return false; // custom: explicit only
    }
    const profileTools = getToolsForProfile(activeProfile, globalProfile);
    return profileTools.has(tool);
  };

  const handleToolToggle = (tool: string) => {
    if (activeProfile !== 'custom') {
      // Switch to custom, starting from current profile's tools
      const currentTools = getToolsForProfile(activeProfile, globalProfile);
      const newAllow = new Set(currentTools);
      const newDeny = new Set<string>();
      if (currentTools.has(tool)) {
        newAllow.delete(tool);
        newDeny.add(tool);
      } else {
        newAllow.add(tool);
      }
      setCustomAllow(newAllow);
      setCustomDeny(newDeny);
      setActiveProfile('custom');
    } else {
      const newAllow = new Set(customAllow);
      const newDeny = new Set(customDeny);
      if (isToolEnabled(tool)) {
        newAllow.delete(tool);
        newDeny.add(tool);
      } else {
        newDeny.delete(tool);
        newAllow.add(tool);
      }
      setCustomAllow(newAllow);
      setCustomDeny(newDeny);
    }
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeProfile === 'inherit') {
        // Remove per-agent override: set profile to null, clear allow/deny
        await api.patch(`/managed-agents/${agentId}/tool-access`, {
          scope: 'agent', profile: null, allow: null, deny: null,
        });
      } else if (activeProfile === 'custom') {
        await api.patch(`/managed-agents/${agentId}/tool-access`, {
          scope: 'agent',
          profile: null,
          allow: [...customAllow],
          deny: [...customDeny],
        });
      } else {
        // Standard profile (minimal, coding, messaging, full)
        await api.patch(`/managed-agents/${agentId}/tool-access`, {
          scope: 'agent', profile: activeProfile, allow: null, deny: null,
        });
      }
      toast.success('Tool access updated');
      setDirty(false);
    } catch {
      toast.error('Failed to update tool access');
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = ALL_TOOLS.filter(t => isToolEnabled(t)).length;

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--text-dim)', fontSize: '0.8125rem' }}>Loading tool access...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            Tool Access
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {enabledCount}/{ALL_TOOLS.length} enabled
            {dirty && <span style={{ color: 'var(--warning)', marginLeft: 8 }}>unsaved</span>}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {dirty && (
            <button
              onClick={() => fetchConfig()}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', fontSize: '0.75rem', fontWeight: 500,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              <RotateCcw size={12} /> Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600,
              background: dirty ? 'var(--error)' : 'var(--surface)',
              border: '1px solid transparent',
              borderRadius: 'var(--radius-sm)',
              color: dirty ? '#fff' : 'var(--text-muted)',
              cursor: dirty ? 'pointer' : 'default',
              opacity: saving ? 0.7 : 1,
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Save size={12} /> Save
          </button>
        </div>
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => handleProfileSelect(p.value)}
            title={p.desc}
            style={{
              padding: '4px 10px', fontSize: '0.6875rem', fontWeight: 500,
              background: activeProfile === p.value ? 'var(--surface-hover)' : 'transparent',
              border: activeProfile === p.value ? '1px solid var(--amber)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              color: activeProfile === p.value ? 'var(--amber)' : 'var(--text-dim)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Profile info */}
      {activeProfile === 'inherit' && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          Using global defaults ({globalProfile ?? 'coding'} profile). Configure in Settings &rarr; Tool Access Defaults.
        </div>
      )}
      {activeProfile === 'custom' && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          Custom per-agent configuration. Toggle individual tools below.
        </div>
      )}

      {/* Tool groups — only show toggles for custom or when viewing a preset */}
      {TOOL_GROUPS.map(group => (
        <div key={group.label}>
          <h4 style={{
            fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)',
            margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {group.label}
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 6,
          }}>
            {group.tools.map(tool => {
              const enabled = isToolEnabled(tool.name);
              const isCustomMode = activeProfile === 'custom';
              return (
                <div
                  key={tool.name}
                  onClick={() => handleToolToggle(tool.name)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: isCustomMode || activeProfile !== 'inherit' ? 'pointer' : 'pointer',
                    transition: 'var(--transition-fast)',
                    opacity: activeProfile === 'inherit' ? 0.6 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>
                      {tool.name}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      {tool.desc}
                    </div>
                  </div>
                  <div style={{
                    width: 32, height: 18, borderRadius: 9,
                    background: enabled ? 'var(--success, #22c55e)' : 'var(--text-muted)',
                    position: 'relative', flexShrink: 0, marginLeft: 8,
                    transition: 'background 0.2s',
                  }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: '#fff', position: 'absolute', top: 2,
                      left: enabled ? 16 : 2, transition: 'left 0.2s',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
