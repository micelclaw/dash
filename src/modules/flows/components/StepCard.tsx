/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useEffect, useState } from 'react';
import {
  X, GripVertical, ChevronDown, ChevronUp, ArrowUp, ArrowDown,
  Mail, StickyNote, Calendar, Users, Brain, Bell, Home, ShieldCheck,
  Search, BookOpen, Bot, Activity, Sparkles, Tag, Send, PenLine,
  Wand2, Clock, Image, FolderOpen, Rss, Kanban, Zap,
} from 'lucide-react';
import type { FlowStep } from '@/stores/flows.store';
import { useFlowsStore } from '@/stores/flows.store';
import { loadSourceOptions, type Option } from '../lib/source-options';

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
  /** Steps preceding this one — used to label the inputRef + condition
   * dropdowns with the real step id and label, not "Step N". */
  previousSteps: FlowStep[];
  /** Optional drag handle attributes (from @dnd-kit's useSortable). When
   * provided the GripVertical icon becomes a real drag handle. */
  dragHandleProps?: {
    attributes: Record<string, unknown>;
    listeners: Record<string, unknown>;
  };
  /** When the card itself is being dragged we lower the Z + outline. */
  isDragging?: boolean;
  onUpdate: (updates: Partial<FlowStep>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function StepCard({
  step, index, totalSteps, previousSteps, dragHandleProps, isDragging,
  onUpdate, onRemove, onMoveUp, onMoveDown,
}: StepCardProps) {
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
        background: 'var(--surface)', border: `1px solid ${isDragging ? 'var(--mod-flows)' : 'var(--border)'}`,
        borderLeft: `3px solid ${borderColor}`, borderRadius: 8, overflow: 'hidden',
        boxShadow: isDragging ? '0 8px 16px rgba(0,0,0,0.25)' : undefined,
        opacity: isDragging ? 0.95 : 1,
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
        <span
          {...(dragHandleProps?.attributes ?? {})}
          {...(dragHandleProps?.listeners ?? {})}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)',
            cursor: dragHandleProps ? 'grab' : 'default',
            flexShrink: 0, padding: 2,
            touchAction: 'none',
          }}
          title={dragHandleProps ? 'Drag to reorder' : undefined}
        >
          <GripVertical size={12} />
        </span>
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
          {/* Step description */}
          {stepDef.description && (
            <p style={{ margin: '8px 0 4px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {stepDef.description}
            </p>
          )}

          {/* Step label inline-edit (defaults to step type label) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={fieldLabelStyle}>Step name</label>
            <input
              value={step.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder={stepDef.label}
              style={inputStyle}
            />
          </div>

          {stepDef.params.map((param) => (
            <ParamField
              key={param.id}
              param={param}
              value={step.config[param.id]}
              onChange={(val) => onUpdate({ config: { ...step.config, [param.id]: val } })}
            />
          ))}

          {/* Input ref selector — shows the real step id + label so the
              user knows what each option means. */}
          {stepDef.input_type && previousSteps.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={fieldLabelStyle}>Data from previous step</label>
              <select
                value={step.inputRef ?? ''}
                onChange={(e) => onUpdate({ inputRef: e.target.value || undefined })}
                style={selectStyle}
              >
                <option value="">None</option>
                {previousSteps.map((s, i) => (
                  <option key={s.id} value={`$${s.id}`}>
                    {i + 1}. {s.label || s.type} — {s.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Conditional execution — runs only if the expression is truthy */}
          {previousSteps.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={fieldLabelStyle}>
                Run only if <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                value={step.condition ?? ''}
                onChange={(e) => onUpdate({ condition: e.target.value || undefined })}
                placeholder="$s2.approved"
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
              />
              <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Reference an earlier step's output, e.g. <code>$s2.approved</code> or <code>$s1.count {'>'} 0</code>.
              </p>
            </div>
          )}

          {/* Output indicator */}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            Output: <span style={{ background: `${borderColor}20`, color: borderColor, padding: '1px 6px', borderRadius: 3, fontWeight: 500 }}>
              {stepDef.output_type}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ParamField ────────────────────────────────────────────────────
// Renders a single param input. For params with `source` (e.g.
// 'agents', 'calendars'), fetches live options from the backend so
// the dropdown is populated with the user's actual records.

interface ParamDef {
  id: string;
  label: string;
  type: string;
  options?: Array<{ value: string; label: string }>;
  source?: string;
  default?: unknown;
  required?: boolean;
  placeholder?: string;
}

function ParamField({ param, value, onChange }: {
  param: ParamDef;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const [dynamicOptions, setDynamicOptions] = useState<Option[] | null>(null);

  useEffect(() => {
    if (!param.source) return;
    let cancelled = false;
    loadSourceOptions(param.source).then((opts) => {
      if (!cancelled) setDynamicOptions(opts);
    });
    return () => { cancelled = true; };
  }, [param.source]);

  if (param.type === 'toggle') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)' }}>
        <input
          type="checkbox"
          checked={Boolean(value ?? param.default)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {param.label}
      </label>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={fieldLabelStyle}>
        {param.label} {param.required && <span style={{ color: 'var(--error)' }}>*</span>}
      </label>
      {param.source && dynamicOptions !== null && dynamicOptions.length > 0 ? (
        <select
          value={(value as string) ?? (param.default as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          style={selectStyle}
        >
          <option value="">— pick one —</option>
          {dynamicOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : param.type === 'select' ? (
        <select
          value={(value as string) ?? (param.default as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          style={selectStyle}
        >
          {param.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : param.type === 'number' ? (
        <input
          type="number"
          value={(value as number) ?? (param.default as number) ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
          style={inputStyle}
        />
      ) : param.type === 'tag_input' ? (
        <input
          value={Array.isArray(value) ? (value as string[]).join(', ') : (value as string) ?? ''}
          onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          placeholder="Tag 1, Tag 2, ..."
          style={inputStyle}
        />
      ) : (
        <input
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder ?? (param.source ? 'Type or paste id…' : '')}
          style={inputStyle}
        />
      )}
      {param.source && dynamicOptions !== null && dynamicOptions.length === 0 && (
        <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>
          No <code>{param.source}</code> available — type the id manually.
        </p>
      )}
    </div>
  );
}

const tinyBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-muted)', padding: 2, display: 'flex',
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-dim)', fontWeight: 500,
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
