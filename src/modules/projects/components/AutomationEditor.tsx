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

import { useState, useCallback } from 'react';
import { Plus, Trash2, Zap } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import type { Automation } from '../types';

const TRIGGER_TYPES = [
  { value: 'card_moved', label: 'Card moved' },
  { value: 'card_created', label: 'Card created' },
  { value: 'card_updated', label: 'Card updated' },
  { value: 'due_date_reached', label: 'Due date reached' },
];

const CONDITION_TYPES = [
  { value: 'none', label: 'No condition' },
  { value: 'column_is', label: 'Column is' },
  { value: 'priority_is', label: 'Priority is' },
  { value: 'tag_contains', label: 'Tag contains' },
  { value: 'assignee_is', label: 'Assignee is' },
];

const ACTION_TYPES = [
  { value: 'set_priority', label: 'Set priority' },
  { value: 'add_tag', label: 'Add tag' },
  { value: 'remove_tag', label: 'Remove tag' },
  { value: 'move_to_column', label: 'Move to column' },
  { value: 'set_assignee', label: 'Set assignee' },
];

interface AutomationFormState {
  name: string;
  trigger_type: string;
  condition_type: string;
  condition_value: string;
  action_type: string;
  action_value: string;
}

const emptyForm: AutomationFormState = {
  name: '',
  trigger_type: 'card_moved',
  condition_type: 'none',
  condition_value: '',
  action_type: 'set_priority',
  action_value: '',
};

export function AutomationEditor({ boardId }: { boardId: string }) {
  const automations = useProjectsStore((s) => s.automations);
  const createAutomation = useProjectsStore((s) => s.createAutomation);
  const updateAutomation = useProjectsStore((s) => s.updateAutomation);
  const deleteAutomation = useProjectsStore((s) => s.deleteAutomation);
  const columns = useProjectsStore((s) => s.columns);

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<AutomationFormState>({ ...emptyForm });

  const handleCreate = useCallback(async () => {
    if (!form.name.trim()) return;
    await createAutomation(boardId, {
      name: form.name.trim(),
      trigger_type: form.trigger_type,
      trigger_config: {
        condition_type: form.condition_type,
        condition_value: form.condition_value || undefined,
      },
      action_type: form.action_type,
      action_config: { value: form.action_value },
    });
    setForm({ ...emptyForm });
    setShowNew(false);
  }, [form, boardId, createAutomation]);

  const handleToggle = useCallback(
    (auto: Automation) => {
      updateAutomation(boardId, auto.id, { enabled: !auto.enabled });
    },
    [boardId, updateAutomation],
  );

  const handleDelete = useCallback(
    (autoId: string) => {
      if (confirm('Delete this automation?')) {
        deleteAutomation(boardId, autoId);
      }
    },
    [boardId, deleteAutomation],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {automations.length === 0 && !showNew && (
        <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: 20 }}>
          No automations yet.
        </div>
      )}

      {automations.map((auto) => (
        <div
          key={auto.id}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 12,
            opacity: auto.enabled ? 1 : 0.5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={12} style={{ color: auto.enabled ? 'var(--amber)' : 'var(--text-muted)' }} />
              <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>{auto.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => handleToggle(auto)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: auto.enabled ? 'var(--success)' : 'var(--surface-hover)',
                  color: auto.enabled ? '#fff' : 'var(--text-dim)',
                  fontSize: 10,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {auto.enabled ? 'On' : 'Off'}
              </button>
              <button
                onClick={() => handleDelete(auto.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
            When <strong>{auto.trigger_type}</strong>
            {' → '}
            <strong>{auto.action_type}</strong>
            {auto.execution_count > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>
                ({auto.execution_count} runs)
              </span>
            )}
          </div>
        </div>
      ))}

      {showNew ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Automation name..."
            style={inputStyle}
          />

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>When</span>
            <select
              value={form.trigger_type}
              onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
              style={selectStyle}
            >
              {TRIGGER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>If</span>
            <select
              value={form.condition_type}
              onChange={(e) => setForm({ ...form, condition_type: e.target.value })}
              style={selectStyle}
            >
              {CONDITION_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {form.condition_type !== 'none' && (
              form.condition_type === 'column_is' ? (
                <select
                  value={form.condition_value}
                  onChange={(e) => setForm({ ...form, condition_value: e.target.value })}
                  style={selectStyle}
                >
                  <option value="">Select column</option>
                  {Object.values(columns).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              ) : form.condition_type === 'priority_is' ? (
                <select
                  value={form.condition_value}
                  onChange={(e) => setForm({ ...form, condition_value: e.target.value })}
                  style={selectStyle}
                >
                  <option value="">Select priority</option>
                  {['urgent', 'high', 'medium', 'low', 'none'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <input
                  value={form.condition_value}
                  onChange={(e) => setForm({ ...form, condition_value: e.target.value })}
                  placeholder="Value..."
                  style={{ ...inputStyle, width: 120 }}
                />
              )
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Then</span>
            <select
              value={form.action_type}
              onChange={(e) => setForm({ ...form, action_type: e.target.value })}
              style={selectStyle}
            >
              {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            {form.action_type === 'move_to_column' ? (
              <select
                value={form.action_value}
                onChange={(e) => setForm({ ...form, action_value: e.target.value })}
                style={selectStyle}
              >
                <option value="">Select column</option>
                {Object.values(columns).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            ) : form.action_type === 'set_priority' ? (
              <select
                value={form.action_value}
                onChange={(e) => setForm({ ...form, action_value: e.target.value })}
                style={selectStyle}
              >
                <option value="">Select priority</option>
                {['urgent', 'high', 'medium', 'low', 'none'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <input
                value={form.action_value}
                onChange={(e) => setForm({ ...form, action_value: e.target.value })}
                placeholder="Value..."
                style={{ ...inputStyle, width: 120 }}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setShowNew(false); setForm({ ...emptyForm }); }}
              style={{ padding: '4px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              style={{ padding: '4px 10px', background: 'var(--amber)', border: 'none', borderRadius: 4, color: '#06060a', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              Create
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNew(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            background: 'none',
            border: '1px dashed var(--border)',
            borderRadius: 6,
            color: 'var(--text-muted)',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Plus size={12} /> New Automation
        </button>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '4px 8px',
  color: 'var(--text)',
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '3px 6px',
  color: 'var(--text)',
  fontSize: 11,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
};
