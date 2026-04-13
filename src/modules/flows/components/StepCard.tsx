/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useState } from 'react';
import {
  X, GripVertical, ChevronDown, ChevronUp, ArrowUp, ArrowDown,
  Mail, StickyNote, Calendar, Users, Brain, Bell, Home, ShieldCheck,
  Search, BookOpen, Bot, Activity, Sparkles, Tag, Send, PenLine,
  Wand2, Clock, Image, FolderOpen, Rss, Kanban, Zap,
} from 'lucide-react';
import type { FlowStep } from '@/stores/flows.store';
import { useFlowsStore } from '@/stores/flows.store';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  Mail, StickyNote, Calendar, Users, Brain, Bell, Home, ShieldCheck,
  Search, BookOpen, Bot, Activity, Sparkles, Tag, Send, PenLine,
  Wand2, Clock, Image, FolderOpen, Rss, Kanban, Zap,
};

const CATEGORY_COLORS: Record<string, string> = {
  email: 'var(--mod-mail)', notes: 'var(--mod-notes)', calendar: 'var(--mod-calendar)',
  contacts: 'var(--mod-contacts)', kanban: 'var(--mod-projects)', photos: 'var(--mod-photos)',
  diary: 'var(--mod-diary)', files: 'var(--mod-drive)', feeds: 'var(--mod-feeds)',
  search: 'var(--mod-search)', ai: '#ec4899', notification: '#f59e0b',
  home: '#06b6d4', system: '#ef4444', control: '#6b7280', agent: 'var(--mod-agents)',
};

interface StepCardProps {
  step: FlowStep;
  index: number;
  totalSteps: number;
  onUpdate: (updates: Partial<FlowStep>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function StepCard({ step, index, totalSteps, onUpdate, onRemove, onMoveUp, onMoveDown }: StepCardProps) {
  const [expanded, setExpanded] = useState(false);
  const stepTypes = useFlowsStore((s) => s.stepTypes);
  const stepDef = stepTypes.find((t) => t.id === step.type);

  const category = step.type.split('.')[0];
  const borderColor = CATEGORY_COLORS[category] ?? 'var(--border)';
  const IconComponent = ICON_MAP[stepDef?.icon ?? 'Zap'] ?? Zap;

  return (
    <div
      style={{
        width: '100%', maxWidth: 520,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderLeft: `3px solid ${borderColor}`, borderRadius: 8, overflow: 'hidden',
      }}
    >
      {/* Header (always visible) */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
          cursor: 'pointer',
        }}
      >
        <GripVertical size={12} style={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }} />
        <IconComponent size={16} style={{ color: borderColor, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {step.label || stepDef?.label || step.type}
        </span>
        {/* Summary when collapsed */}
        {!expanded && stepDef && (
          <span style={{ fontSize: 11, color: 'var(--text-dim)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {Object.values(step.config).filter(Boolean).slice(0, 2).join(', ') || stepDef.description}
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {onMoveUp && (
            <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} style={tinyBtnStyle} title="Move up">
              <ArrowUp size={10} />
            </button>
          )}
          {onMoveDown && (
            <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} style={tinyBtnStyle} title="Move down">
              <ArrowDown size={10} />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={tinyBtnStyle} title="Remove">
            <X size={10} />
          </button>
          {expanded ? <ChevronUp size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </div>

      {/* Expanded config */}
      {expanded && stepDef && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ height: 8 }} />
          {stepDef.params.map((param) => (
            <div key={param.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>
                {param.label} {param.required && <span style={{ color: 'var(--error)' }}>*</span>}
              </label>
              {param.type === 'select' ? (
                <select
                  value={(step.config[param.id] as string) ?? param.default ?? ''}
                  onChange={(e) => onUpdate({ config: { ...step.config, [param.id]: e.target.value } })}
                  style={selectStyle}
                >
                  {param.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : param.type === 'number' ? (
                <input
                  type="number"
                  value={(step.config[param.id] as number) ?? param.default ?? ''}
                  onChange={(e) => onUpdate({ config: { ...step.config, [param.id]: Number(e.target.value) } })}
                  style={inputStyle}
                />
              ) : param.type === 'toggle' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(step.config[param.id] ?? param.default)}
                    onChange={(e) => onUpdate({ config: { ...step.config, [param.id]: e.target.checked } })}
                  />
                  {param.label}
                </label>
              ) : param.type === 'tag_input' ? (
                <input
                  value={Array.isArray(step.config[param.id]) ? (step.config[param.id] as string[]).join(', ') : (step.config[param.id] as string) ?? ''}
                  onChange={(e) => onUpdate({ config: { ...step.config, [param.id]: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } })}
                  placeholder="Tag 1, Tag 2, ..."
                  style={inputStyle}
                />
              ) : (
                <input
                  value={(step.config[param.id] as string) ?? ''}
                  onChange={(e) => onUpdate({ config: { ...step.config, [param.id]: e.target.value } })}
                  placeholder={param.placeholder}
                  style={inputStyle}
                />
              )}
            </div>
          ))}

          {/* Input ref selector */}
          {((stepDef as any).input_type ?? stepDef.inputType) && index > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>Data from previous step</label>
              <select
                value={step.inputRef ?? ''}
                onChange={(e) => onUpdate({ inputRef: e.target.value || undefined })}
                style={selectStyle}
              >
                <option value="">None</option>
                {Array.from({ length: index }, (_, i) => (
                  <option key={i} value={`$s${i + 1}`}>Step {i + 1}</option>
                ))}
              </select>
            </div>
          )}

          {/* Output indicator */}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            Output: <span style={{ background: `${borderColor}20`, color: borderColor, padding: '1px 6px', borderRadius: 3, fontWeight: 500 }}>
              {(stepDef as any).output_type ?? stepDef.outputType}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const tinyBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-muted)', padding: 2, display: 'flex',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4,
  padding: '5px 8px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-sans)',
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4,
  padding: '4px 6px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-sans)',
  outline: 'none',
};
