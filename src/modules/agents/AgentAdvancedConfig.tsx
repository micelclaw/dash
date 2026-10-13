/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, ChevronDown, ChevronRight, Info, Check } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { AgentSelect } from './AgentSelect';

interface AdvancedConfigResponse {
  data: {
    thinking: {
      thinking_default: string;
      reasoning_default: string;
      verbose_default: string;
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
  { value: 'off', label: 'Off', desc: 'No muestra la salida de las herramientas' },
  { value: 'on', label: 'On (minimal)', desc: 'Salida resumida de cada tool' },
  { value: 'full', label: 'Full', desc: 'Salida completa de todas las tools' },
];

const PRUNING_MODES = [
  { value: 'off', label: 'Off', desc: 'Conserva todo el contexto (más tokens)' },
  { value: 'cache-ttl', label: 'Cache TTL', desc: 'Poda resultados de tools antiguos pasado el TTL' },
];

const COMPACTION_MODES = [
  { value: 'default', label: 'Default', desc: 'Compactación estándar al llenarse el contexto' },
  { value: 'safeguard', label: 'Safeguard', desc: 'Recomendada: preserva el inicio de la tarea' },
];

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', color: 'var(--text)', minWidth: 120 }}>
      {label}
      {hint && (
        <span title={hint} style={{ display: 'inline-flex', color: 'var(--text-muted)', cursor: 'help' }}>
          <Info size={12} />
        </span>
      )}
    </span>
  );
}

function SelectField({ label, value, options, onChange, hint }: {
  label: string;
  value: string;
  options: { value: string; label: string; desc?: string }[];
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <FieldLabel label={label} hint={hint} />
      <AgentSelect value={value} options={options} onChange={onChange} minWidth={170} />
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
  const [justSaved, setJustSaved] = useState(false);

  const [thinkingLevel, setThinkingLevel] = useState('adaptive');
  const [verbose, setVerbose] = useState('off');

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
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update advanced config');
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
            background: justSaved ? 'var(--success)' : dirty ? 'var(--error)' : 'var(--surface)',
            border: '1px solid transparent',
            borderRadius: 'var(--radius-sm)',
            color: justSaved || dirty ? '#fff' : 'var(--text-muted)',
            cursor: dirty ? 'pointer' : 'default',
            opacity: saving ? 0.7 : 1,
            fontFamily: 'var(--font-sans)',
            transition: 'background 0.2s',
          }}
        >
          {justSaved ? <><Check size={12} /> Guardado</> : <><Save size={12} /> {dirty ? 'Save' : 'Saved'}</>}
        </button>
      </div>

      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        Global defaults for all agents. Execution policy and sandbox live in
        Security; thinking, context and subagents remain defaults-only here.
      </span>

      {/* Thinking */}
      <Section title="Thinking & Reasoning" expanded={expandedSections.thinking!} onToggle={() => toggleSection('thinking')}>
        <SelectField label="Thinking level" value={thinkingLevel} options={THINKING_LEVELS} onChange={markDirty(setThinkingLevel)}
          hint="Cuánto razona el modelo antes de responder. 'Adaptive' deja que el modelo decida según la complejidad." />
        <SelectField label="Verbose mode" value={verbose} options={VERBOSE_OPTIONS} onChange={markDirty(setVerbose)}
          hint="Cuánta salida de las herramientas se muestra en el chat." />
      </Section>

      {/* Context */}
      <Section title="Context Management" expanded={expandedSections.context!} onToggle={() => toggleSection('context')}>
        <SelectField label="Pruning mode" value={pruningMode} options={PRUNING_MODES} onChange={markDirty(setPruningMode)}
          hint="Poda automática de resultados de tools antiguos para ahorrar tokens del contexto." />
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
        <SelectField label="Compaction mode" value={compactionMode} options={COMPACTION_MODES} onChange={markDirty(setCompactionMode)}
          hint="Cómo se compacta el historial al llenarse el contexto. 'Safeguard' preserva el inicio de la tarea." />
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
