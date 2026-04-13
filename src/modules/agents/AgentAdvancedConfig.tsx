/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface AdvancedConfigResponse {
  data: {
    thinking: {
      thinking_default: string;
      reasoning_default: string;
      verbose_default: string;
      elevated_default: string;
    };
    context: {
      context_pruning: { mode: string; ttl: string };
      compaction: { mode: string };
      context_tokens: number | null;
    };
    subagents: {
      max_concurrent: number;
      max_spawn_depth: number;
      max_children_per_agent: number;
      model?: string;
      thinking?: string;
      run_timeout_seconds?: number;
    };
  };
}

const THINKING_LEVELS = [
  { value: 'off', label: 'Off', desc: 'No thinking' },
  { value: 'minimal', label: 'Minimal', desc: 'Brief thinking' },
  { value: 'low', label: 'Low', desc: 'Moderate thinking' },
  { value: 'medium', label: 'Medium', desc: 'Substantial thinking' },
  { value: 'high', label: 'High', desc: 'Deep thinking' },
  { value: 'xhigh', label: 'X-High', desc: 'Maximum thinking' },
  { value: 'adaptive', label: 'Adaptive', desc: 'Model decides based on complexity' },
];

const VERBOSE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On (minimal)' },
  { value: 'full', label: 'Full (all tool output)' },
];

const PRUNING_MODES = [
  { value: 'off', label: 'Off' },
  { value: 'cache-ttl', label: 'Cache TTL (auto-prune old tool results)' },
];

const COMPACTION_MODES = [
  { value: 'default', label: 'Default' },
  { value: 'safeguard', label: 'Safeguard (recommended)' },
];

function SelectField({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string; desc?: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text)', minWidth: 120 }}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '4px 8px', fontSize: '0.75rem',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text)',
          fontFamily: 'var(--font-sans)', cursor: 'pointer',
          minWidth: 160,
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text)', minWidth: 120 }}>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(parseInt(e.target.value, 10) || min)}
        style={{
          padding: '4px 8px', fontSize: '0.75rem', width: 70,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text)',
          fontFamily: 'var(--font-mono, var(--font-sans))', textAlign: 'right',
        }}
      />
    </div>
  );
}

function Section({ title, expanded, onToggle, children }: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          padding: '10px 12px', background: 'var(--surface)', border: 'none',
          cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
          color: 'var(--text)', fontFamily: 'var(--font-sans)', textAlign: 'left',
        }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {expanded && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function AgentAdvancedConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [thinkingLevel, setThinkingLevel] = useState('adaptive');
  const [verbose, setVerbose] = useState('off');
  const [elevated, setElevated] = useState('off');

  const [pruningMode, setPruningMode] = useState('cache-ttl');
  const [pruningTtl, setPruningTtl] = useState('1h');
  const [compactionMode, setCompactionMode] = useState('safeguard');

  const [maxConcurrent, setMaxConcurrent] = useState(8);
  const [maxDepth, setMaxDepth] = useState(1);
  const [maxChildren, setMaxChildren] = useState(5);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    thinking: true, context: false, subagents: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AdvancedConfigResponse>('/managed-agents/advanced-config');
      const d = res.data;
      setThinkingLevel(d.thinking.thinking_default);
      setVerbose(d.thinking.verbose_default);
      setElevated(d.thinking.elevated_default);
      setPruningMode(d.context.context_pruning?.mode ?? 'cache-ttl');
      setPruningTtl(d.context.context_pruning?.ttl ?? '1h');
      setCompactionMode(d.context.compaction?.mode ?? 'safeguard');
      setMaxConcurrent(d.subagents.max_concurrent ?? 8);
      setMaxDepth(d.subagents.max_spawn_depth ?? 1);
      setMaxChildren(d.subagents.max_children_per_agent ?? 5);
      setDirty(false);
    } catch {
      toast.error('Failed to load advanced config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/managed-agents/advanced-config', {
        thinking: {
          thinkingDefault: thinkingLevel,
          verboseDefault: verbose,
          elevatedDefault: elevated,
        },
        context: {
          contextPruning: { mode: pruningMode, ttl: pruningTtl },
          compaction: { mode: compactionMode },
        },
        subagents: {
          maxConcurrent,
          maxSpawnDepth: maxDepth,
          maxChildrenPerAgent: maxChildren,
        },
      });
      toast.success('Advanced config updated');
      setDirty(false);
    } catch {
      toast.error('Failed to update advanced config');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--text-dim)', fontSize: '0.8125rem' }}>Loading config...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
          Advanced Configuration
        </h3>
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
          <Save size={12} /> {dirty ? 'Save' : 'Saved'}
        </button>
      </div>

      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        Global defaults for all agents. Per-agent overrides coming soon.
      </span>

      {/* Thinking */}
      <Section title="Thinking & Reasoning" expanded={expandedSections.thinking!} onToggle={() => toggleSection('thinking')}>
        <SelectField label="Thinking level" value={thinkingLevel} options={THINKING_LEVELS} onChange={markDirty(setThinkingLevel)} />
        <SelectField label="Verbose mode" value={verbose} options={VERBOSE_OPTIONS} onChange={markDirty(setVerbose)} />
        <SelectField
          label="Elevated mode"
          value={elevated}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
            { value: 'ask', label: 'Ask (confirm each time)' },
            { value: 'full', label: 'Full (skip exec approvals)' },
          ]}
          onChange={markDirty(setElevated)}
        />
      </Section>

      {/* Context */}
      <Section title="Context Management" expanded={expandedSections.context!} onToggle={() => toggleSection('context')}>
        <SelectField label="Pruning mode" value={pruningMode} options={PRUNING_MODES} onChange={markDirty(setPruningMode)} />
        {pruningMode === 'cache-ttl' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text)', minWidth: 120 }}>Cache TTL</span>
            <input
              type="text"
              value={pruningTtl}
              onChange={e => { setPruningTtl(e.target.value); setDirty(true); }}
              placeholder="1h"
              style={{
                padding: '4px 8px', fontSize: '0.75rem', width: 80,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                fontFamily: 'var(--font-mono, var(--font-sans))', textAlign: 'right',
              }}
            />
          </div>
        )}
        <SelectField label="Compaction mode" value={compactionMode} options={COMPACTION_MODES} onChange={markDirty(setCompactionMode)} />
      </Section>

      {/* Subagents */}
      <Section title="Subagent Policies" expanded={expandedSections.subagents!} onToggle={() => toggleSection('subagents')}>
        <NumberField label="Max concurrent" value={maxConcurrent} min={1} max={20} onChange={markDirty(setMaxConcurrent)} />
        <NumberField label="Max spawn depth" value={maxDepth} min={1} max={5} onChange={markDirty(setMaxDepth)} />
        <NumberField label="Max children/agent" value={maxChildren} min={1} max={20} onChange={markDirty(setMaxChildren)} />
      </Section>
    </div>
  );
}
