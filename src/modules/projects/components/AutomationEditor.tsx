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
import { useI18n } from '@/i18n';

const TRIGGER_TYPES = [
  { value: 'card_moved', labelKey: 'projects.automationEditor.trigger.cardMoved' },
  { value: 'card_created', labelKey: 'projects.automationEditor.trigger.cardCreated' },
  { value: 'card_updated', labelKey: 'projects.automationEditor.trigger.cardUpdated' },
  { value: 'due_date_reached', labelKey: 'projects.automationEditor.trigger.dueDateReached' },
];

const CONDITION_TYPES = [
  { value: 'none', labelKey: 'projects.automationEditor.condition.none' },
  { value: 'column_is', labelKey: 'projects.automationEditor.condition.columnIs' },
  { value: 'priority_is', labelKey: 'projects.automationEditor.condition.priorityIs' },
  { value: 'tag_contains', labelKey: 'projects.automationEditor.condition.tagContains' },
  { value: 'assignee_is', labelKey: 'projects.automationEditor.condition.assigneeIs' },
];

const ACTION_TYPES = [
  { value: 'set_priority', labelKey: 'projects.automationEditor.action.setPriority' },
  { value: 'add_tag', labelKey: 'projects.automationEditor.action.addTag' },
  { value: 'remove_tag', labelKey: 'projects.automationEditor.action.removeTag' },
  { value: 'move_to_column', labelKey: 'projects.automationEditor.action.moveToColumn' },
  { value: 'set_assignee', labelKey: 'projects.automationEditor.action.setAssignee' },
];

const PRIORITY_LABEL_KEYS: Record<string, string> = {
  urgent: 'projects.automationEditor.priority.urgent',
  high: 'projects.automationEditor.priority.high',
  medium: 'projects.automationEditor.priority.medium',
  low: 'projects.automationEditor.priority.low',
  none: 'projects.automationEditor.priority.none',
};
const TRIGGER_LABEL_KEYS = Object.fromEntries(TRIGGER_TYPES.map(({ value, labelKey }) => [value, labelKey]));
const ACTION_LABEL_KEYS = Object.fromEntries(ACTION_TYPES.map(({ value, labelKey }) => [value, labelKey]));

function knownLabel(t: (key: string) => string, keys: Record<string, string>, value: string): string {
  const key = keys[value];
  return key ? t(key) : value;
}

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
  const { t } = useI18n();
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
      if (confirm(t('projects.automationEditor.deleteConfirm'))) {
        deleteAutomation(boardId, autoId);
      }
    },
    [boardId, deleteAutomation, t],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {automations.length === 0 && !showNew && (
        <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: 20 }}>
          {t('projects.automationEditor.empty')}
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
                aria-pressed={auto.enabled}
                aria-label={t(auto.enabled ? 'projects.automationEditor.disable' : 'projects.automationEditor.enable', { name: auto.name })}
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
                {t(auto.enabled ? 'projects.automationEditor.enabled' : 'projects.automationEditor.disabled')}
              </button>
              <button
                onClick={() => handleDelete(auto.id)}
                aria-label={t('projects.automationEditor.delete', { name: auto.name })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
            {t('projects.automationEditor.when')} <strong>{knownLabel(t, TRIGGER_LABEL_KEYS, auto.trigger_type)}</strong>
            {' → '}
            <strong>{knownLabel(t, ACTION_LABEL_KEYS, auto.action_type)}</strong>
            {auto.execution_count > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>
                ({t(auto.execution_count === 1 ? 'projects.automationEditor.runs.one' : 'projects.automationEditor.runs.many', { count: auto.execution_count })})
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
            placeholder={t('projects.automationEditor.name.placeholder')}
            aria-label={t('projects.automationEditor.name.label')}
            style={inputStyle}
          />

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('projects.automationEditor.when')}</span>
            <select
              value={form.trigger_type}
              onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
              style={selectStyle}
              aria-label={t('projects.automationEditor.when')}
            >
              {TRIGGER_TYPES.map((trigger) => <option key={trigger.value} value={trigger.value}>{t(trigger.labelKey)}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('projects.automationEditor.if')}</span>
            <select
              value={form.condition_type}
              onChange={(e) => setForm({ ...form, condition_type: e.target.value })}
              style={selectStyle}
              aria-label={t('projects.automationEditor.if')}
            >
              {CONDITION_TYPES.map((condition) => <option key={condition.value} value={condition.value}>{t(condition.labelKey)}</option>)}
            </select>
            {form.condition_type !== 'none' && (
              form.condition_type === 'column_is' ? (
                <select
                  value={form.condition_value}
                  onChange={(e) => setForm({ ...form, condition_value: e.target.value })}
                  style={selectStyle}
                  aria-label={t('projects.automationEditor.column.label')}
                >
                  <option value="">{t('projects.automationEditor.column.placeholder')}</option>
                  {Object.values(columns).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              ) : form.condition_type === 'priority_is' ? (
                <select
                  value={form.condition_value}
                  onChange={(e) => setForm({ ...form, condition_value: e.target.value })}
                  style={selectStyle}
                  aria-label={t('projects.automationEditor.priority.label')}
                >
                  <option value="">{t('projects.automationEditor.priority.placeholder')}</option>
                  {['urgent', 'high', 'medium', 'low', 'none'].map((priority) => <option key={priority} value={priority}>{knownLabel(t, PRIORITY_LABEL_KEYS, priority)}</option>)}
                </select>
              ) : (
                <input
                  value={form.condition_value}
                  onChange={(e) => setForm({ ...form, condition_value: e.target.value })}
                  placeholder={t('projects.automationEditor.value.placeholder')}
                  aria-label={t('projects.automationEditor.value.placeholder')}
                  style={{ ...inputStyle, width: 120 }}
                />
              )
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('projects.automationEditor.then')}</span>
            <select
              value={form.action_type}
              onChange={(e) => setForm({ ...form, action_type: e.target.value })}
              style={selectStyle}
              aria-label={t('projects.automationEditor.then')}
            >
              {ACTION_TYPES.map((action) => <option key={action.value} value={action.value}>{t(action.labelKey)}</option>)}
            </select>
            {form.action_type === 'move_to_column' ? (
              <select
                value={form.action_value}
                onChange={(e) => setForm({ ...form, action_value: e.target.value })}
                style={selectStyle}
                aria-label={t('projects.automationEditor.column.label')}
              >
                <option value="">{t('projects.automationEditor.column.placeholder')}</option>
                {Object.values(columns).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            ) : form.action_type === 'set_priority' ? (
              <select
                value={form.action_value}
                onChange={(e) => setForm({ ...form, action_value: e.target.value })}
                style={selectStyle}
                aria-label={t('projects.automationEditor.priority.label')}
              >
                <option value="">{t('projects.automationEditor.priority.placeholder')}</option>
                {['urgent', 'high', 'medium', 'low', 'none'].map((priority) => <option key={priority} value={priority}>{knownLabel(t, PRIORITY_LABEL_KEYS, priority)}</option>)}
              </select>
            ) : (
              <input
                value={form.action_value}
                onChange={(e) => setForm({ ...form, action_value: e.target.value })}
                placeholder={t('projects.automationEditor.value.placeholder')}
                aria-label={t('projects.automationEditor.value.placeholder')}
                style={{ ...inputStyle, width: 120 }}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setShowNew(false); setForm({ ...emptyForm }); }}
              style={{ padding: '4px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              {t('projects.automationEditor.cancel')}
            </button>
            <button
              onClick={handleCreate}
              style={{ padding: '4px 10px', background: 'var(--amber)', border: 'none', borderRadius: 4, color: '#06060a', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              {t('projects.automationEditor.create')}
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
          <Plus size={12} /> {t('projects.automationEditor.new')}
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
