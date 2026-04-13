/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, Heart, HeartOff } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as gwService from '@/services/gateway.service';
import { api } from '@/services/api';

const INTERVALS = [
  { value: '0m', label: 'Disabled' },
  { value: '5m', label: 'Every 5 min' },
  { value: '15m', label: 'Every 15 min' },
  { value: '30m', label: 'Every 30 min (default)' },
  { value: '1h', label: 'Every 1 hour' },
  { value: '2h', label: 'Every 2 hours' },
  { value: '4h', label: 'Every 4 hours' },
];

const TARGETS = [
  { value: '', label: 'None (internal only)' },
  { value: 'last', label: 'Last used channel' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'discord', label: 'Discord' },
  { value: 'slack', label: 'Slack' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

const THINKING_LEVELS = [
  { value: '', label: 'Inherit (from agent)' },
  { value: 'off', label: 'Off' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
];

interface AgentSummary {
  id: string;
  name: string;
  display_name: string;
  avatar: string | null;
}

export function HeartbeatTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Global config
  const [every, setEvery] = useState('30m');
  const [target, setTarget] = useState('');
  const [to, setTo] = useState('');
  const [activeStart, setActiveStart] = useState('');
  const [activeEnd, setActiveEnd] = useState('');
  const [timezone, setTimezone] = useState('');
  const [model, setModel] = useState('');
  const [thinking, setThinking] = useState('');
  const [lightContext, setLightContext] = useState(false);
  const [prompt, setPrompt] = useState('');

  // Per-agent toggles
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [agentHeartbeats, setAgentHeartbeats] = useState<Record<string, Record<string, unknown>>>({});
  const [agentIdMap, setAgentIdMap] = useState<Record<string, string>>({});
  const [togglingAgent, setTogglingAgent] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [hbData, agentsRes] = await Promise.all([
        gwService.getHeartbeatConfig(),
        api.get<{ data: AgentSummary[] }>('/managed-agents'),
      ]);
      const g = hbData.global ?? {};
      setEvery((g.every ?? '30m') as string);
      setTarget((g.target ?? '') as string);
      setTo((g.to ?? '') as string);
      const ah = (g.active_hours ?? {}) as Record<string, unknown>;
      setActiveStart((ah.start ?? '') as string);
      setActiveEnd((ah.end ?? '') as string);
      setTimezone((ah.timezone ?? '') as string);
      setModel((g.model ?? '') as string);
      setThinking((g.thinking ?? '') as string);
      setLightContext((g.light_context ?? false) as boolean);
      setPrompt((g.prompt ?? '') as string);
      setAgentHeartbeats(hbData.per_agent ?? {});
      setAgentIdMap((hbData as any).agent_id_map ?? {});
      setAgents(agentsRes.data ?? []);
      setDirty(false);
    } catch { toast.error('Failed to load heartbeat config'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  const d = <T,>(s: (v: T) => void) => (v: T) => { s(v); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await gwService.updateHeartbeatConfig({
        global: {
          every,
          ...(target ? { target } : {}),
          ...(to ? { to } : {}),
          ...(activeStart && activeEnd ? { activeHours: { start: activeStart, end: activeEnd, ...(timezone ? { timezone } : {}) } } : {}),
          ...(model ? { model } : {}),
          ...(thinking ? { thinking } : {}),
          lightContext,
          ...(prompt ? { prompt } : {}),
        },
      });
      toast.success('Heartbeat config updated');
      setDirty(false);
    } catch { toast.error('Failed to update heartbeat config'); }
    finally { setSaving(false); }
  };

  const toggleAgentHeartbeat = async (agentId: string, openclawId: string, currentlyEnabled: boolean) => {
    setTogglingAgent(agentId);
    try {
      await gwService.updateHeartbeatConfig({
        agentId: openclawId,
        agentHeartbeat: currentlyEnabled ? { every: '0m' } : {},  // 0m = disabled, {} = inherit global
      });
      toast.success(currentlyEnabled ? 'Heartbeat disabled for agent' : 'Heartbeat enabled for agent');
      fetchConfig();
    } catch { toast.error('Failed to toggle agent heartbeat'); }
    finally { setTogglingAgent(null); }
  };

  const isAgentHeartbeatEnabled = (openclawId: string): boolean => {
    const override = agentHeartbeats[openclawId];
    if (!override || Object.keys(override).length === 0) return every !== '0m'; // Inherit global
    return (override.every ?? every) !== '0m';
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading heartbeat config...</div>;

  const Sel = ({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) => (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ padding: '4px 8px', fontSize: '0.75rem', minWidth: 180, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const Row = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0' }}>
      <div style={{ flex: 1 }}><div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{label}</div>{desc && <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>}</div>
      {children}
    </div>
  );

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div style={{ padding: 20, maxWidth: 800 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            Global: {every === '0m' ? 'disabled' : `every ${every}`}
            {activeStart && activeEnd ? ` (${activeStart}–${activeEnd})` : ''}
          </span>
          <button onClick={handleSave} disabled={!dirty || saving} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: '0.8125rem', fontWeight: 600, background: dirty ? 'var(--amber)' : 'var(--surface)', border: dirty ? 'none' : '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: dirty ? '#000' : 'var(--text-muted)', cursor: dirty ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>
            <Save size={14} /> {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>

        {/* Global config */}
        <div style={{ marginBottom: 24, padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Global Defaults</h3>
          <Row label="Interval" desc="How often agents wake up to check"><Sel value={every} options={INTERVALS} onChange={d(setEvery)} /></Row>
          <Row label="Delivery target" desc="Channel to send alerts"><Sel value={target} options={TARGETS} onChange={d(setTarget)} /></Row>
          {target && target !== 'last' && <Row label="Target ID" desc="Chat/user ID for delivery"><input type="text" value={to} onChange={e => d(setTo)(e.target.value)} placeholder="e.g. -1001234567890" style={{ padding: '4px 8px', fontSize: '0.75rem', width: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }} /></Row>}
          <Row label="Active hours start" desc="HH:MM (empty = 24/7)"><input type="text" value={activeStart} onChange={e => d(setActiveStart)(e.target.value)} placeholder="09:00" style={{ padding: '4px 8px', fontSize: '0.75rem', width: 70, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', textAlign: 'center' }} /></Row>
          <Row label="Active hours end"><input type="text" value={activeEnd} onChange={e => d(setActiveEnd)(e.target.value)} placeholder="22:00" style={{ padding: '4px 8px', fontSize: '0.75rem', width: 70, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', textAlign: 'center' }} /></Row>
          <Row label="Timezone" desc="IANA timezone (e.g. Europe/Madrid)"><input type="text" value={timezone} onChange={e => d(setTimezone)(e.target.value)} placeholder="Europe/Madrid" style={{ padding: '4px 8px', fontSize: '0.75rem', width: 150, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} /></Row>
          <Row label="Model override" desc="Cheaper model for heartbeats (empty = inherit)"><input type="text" value={model} onChange={e => d(setModel)(e.target.value)} placeholder="anthropic/claude-haiku-4-5" style={{ padding: '4px 8px', fontSize: '0.75rem', width: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }} /></Row>
          <Row label="Thinking override"><Sel value={thinking} options={THINKING_LEVELS} onChange={d(setThinking)} /></Row>
          <Row label="Light context" desc="Minimal bootstrap (only HEARTBEAT.md, cheaper)">
            <div onClick={() => d(setLightContext)(!lightContext)} style={{ width: 36, height: 20, borderRadius: 10, cursor: 'pointer', background: lightContext ? 'var(--success, #22c55e)' : 'var(--text-muted)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: lightContext ? 18 : 2, transition: 'left 0.2s' }} />
            </div>
          </Row>
          <Row label="Custom prompt" desc="Additional instructions (besides HEARTBEAT.md)">
            <textarea value={prompt} onChange={e => d(setPrompt)(e.target.value)} placeholder="Check inbox for urgent emails..." rows={2} style={{ padding: '4px 8px', fontSize: '0.75rem', width: 300, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)', resize: 'vertical' }} />
          </Row>
        </div>

        {/* Per-agent toggles */}
        <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Per-Agent Heartbeat</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {agents.map(agent => {
            // Use agentIdMap from backend (correct per-user ID)
            const openclawId = agentIdMap[agent.name] ?? Object.keys(agentHeartbeats).find(k => k.includes(`--${agent.name}`)) ?? `unknown--${agent.name}`;
            const enabled = isAgentHeartbeatEnabled(openclawId);
            const isToggling = togglingAgent === agent.id;
            return (
              <div key={agent.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1rem' }}>{agent.avatar ?? '🤖'}</span>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>{agent.display_name}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                      {enabled ? `Active (${every})` : 'Paused'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleAgentHeartbeat(agent.id, openclawId, enabled)}
                  disabled={isToggling}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                    background: 'transparent', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', cursor: isToggling ? 'wait' : 'pointer',
                    color: enabled ? '#22c55e' : 'var(--text-muted)',
                    fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
                    opacity: isToggling ? 0.5 : 1,
                  }}
                >
                  {enabled ? <Heart size={12} /> : <HeartOff size={12} />}
                  {enabled ? 'On' : 'Off'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
