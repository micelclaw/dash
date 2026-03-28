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

import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface CustomFieldsEditorProps {
  entityType: string;
  entityId: string;
  initialFields?: Record<string, unknown>;
}

export function CustomFieldsEditor({ entityType, entityId, initialFields }: CustomFieldsEditorProps) {
  const [fields, setFields] = useState<Array<{ key: string; value: string }>>([]);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (initialFields && typeof initialFields === 'object') {
      const entries = Object.entries(initialFields)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => ({ key: k, value: typeof v === 'string' ? v : JSON.stringify(v) }));
      setFields(entries);
    }
  }, [initialFields]);

  const handleAdd = () => {
    setFields(prev => [...prev, { key: '', value: '' }]);
    setDirty(true);
    setExpanded(true);
  };

  const handleRemove = (index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const handleChange = (index: number, field: 'key' | 'value', val: string) => {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, [field]: val } : f));
    setDirty(true);
  };

  const handleSave = async () => {
    const custom: Record<string, string> = {};
    for (const f of fields) {
      if (f.key.trim()) custom[f.key.trim()] = f.value;
    }
    setSaving(true);
    try {
      await api.patch(`/${entityType}/${entityId}/custom`, custom);
      toast.success('Custom fields saved');
      setDirty(false);
    } catch {
      toast.error('Failed to save custom fields');
    }
    setSaving(false);
  };

  return (
    <div className="mt-3 border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Custom Fields
        {fields.length > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-[var(--accent)]/10 text-[var(--accent)]">
            {fields.length}
          </span>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {fields.map((field, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={field.key}
                onChange={e => handleChange(i, 'key', e.target.value)}
                placeholder="Key"
                className="w-1/3 px-2 py-1 text-xs rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none"
              />
              <input
                value={field.value}
                onChange={e => handleChange(i, 'value', e.target.value)}
                placeholder="Value"
                className="flex-1 px-2 py-1 text-xs rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none"
              />
              <button onClick={() => handleRemove(i)} className="p-1 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded text-[var(--accent)] hover:bg-[var(--accent)]/10"
            >
              <Plus size={10} /> Add Field
            </button>
            {dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
              >
                <Save size={10} /> {saving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
