import { useState, useCallback } from 'react';
import { X, Plus, Trash2, Edit2, Check, Type, Hash, Calendar, CheckSquare, List, ExternalLink } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import type { CustomFieldType } from '../types';

const FIELD_TYPES: { value: CustomFieldType; label: string; icon: typeof Type }[] = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { value: 'select', label: 'Select', icon: List },
  { value: 'url', label: 'URL', icon: ExternalLink },
];

interface Props {
  boardId: string;
  open: boolean;
  onClose: () => void;
}

export function CustomFieldManager({ boardId, open, onClose }: Props) {
  const fieldDefs = useProjectsStore(s => s.customFieldDefs);
  const createFieldDef = useProjectsStore(s => s.createFieldDef);
  const updateFieldDef = useProjectsStore(s => s.updateFieldDef);
  const deleteFieldDef = useProjectsStore(s => s.deleteFieldDef);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(false);
  const [showOnCard, setShowOnCard] = useState(true);

  const resetForm = useCallback(() => {
    setName('');
    setType('text');
    setOptions('');
    setRequired(false);
    setShowOnCard(true);
    setAdding(false);
    setEditingId(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    const input: Record<string, unknown> = {
      name: name.trim(),
      type,
      required,
      show_on_card: showOnCard,
    };
    if (type === 'select' && options.trim()) {
      input.options = options.split(',').map(o => o.trim()).filter(Boolean);
    }

    if (editingId) {
      await updateFieldDef(boardId, editingId, input as any);
    } else {
      await createFieldDef(boardId, input as any);
    }
    resetForm();
  }, [name, type, options, required, showOnCard, editingId, boardId, createFieldDef, updateFieldDef, resetForm]);

  const handleEdit = useCallback((id: string) => {
    const fd = fieldDefs[id];
    if (!fd) return;
    setEditingId(id);
    setName(fd.name);
    setType(fd.type);
    setOptions(Array.isArray(fd.options) ? (fd.options as string[]).join(', ') : '');
    setRequired(fd.required);
    setShowOnCard(fd.show_on_card);
    setAdding(true);
  }, [fieldDefs]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this field? Values on existing cards will be lost.')) return;
    await deleteFieldDef(boardId, id);
  }, [boardId, deleteFieldDef]);

  if (!open) return null;

  const defs = Object.values(fieldDefs).sort((a, b) => a.position - b.position);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(25px)' }} onClick={onClose} />
      <div style={{
        position: 'relative', background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '70vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
            Custom Fields
          </span>
          <button onClick={onClose} style={closeBtnStyle}><X size={16} /></button>
        </div>

        {/* Field list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
          {defs.length === 0 && !adding && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '16px 0', textAlign: 'center' }}>
              No custom fields yet. Add one to get started.
            </div>
          )}

          {defs.map(fd => {
            const TypeIcon = FIELD_TYPES.find(ft => ft.value === fd.type)?.icon ?? Type;
            return (
              <div key={fd.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 6px',
                borderBottom: '1px solid var(--border-dim)',
              }}>
                <TypeIcon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                  {fd.name}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>
                  {fd.type}
                </span>
                {fd.show_on_card && (
                  <span style={{
                    fontSize: 9, padding: '1px 4px', borderRadius: 3,
                    background: 'var(--success-dim)', color: 'var(--success)',
                  }}>
                    card
                  </span>
                )}
                <button onClick={() => handleEdit(fd.id)} style={iconBtnStyle}>
                  <Edit2 size={12} />
                </button>
                <button onClick={() => handleDelete(fd.id)} style={{ ...iconBtnStyle, color: 'var(--error)' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}

          {/* Add/Edit form */}
          {adding && (
            <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                autoFocus
                placeholder="Field name"
                value={name}
                onChange={e => setName(e.target.value)}
                style={inputStyle}
              />
              <select value={type} onChange={e => setType(e.target.value as CustomFieldType)} style={inputStyle}>
                {FIELD_TYPES.map(ft => (
                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                ))}
              </select>
              {type === 'select' && (
                <input
                  placeholder="Options (comma-separated)"
                  value={options}
                  onChange={e => setOptions(e.target.value)}
                  style={inputStyle}
                />
              )}
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} />
                  Required
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showOnCard} onChange={e => setShowOnCard(e.target.checked)} />
                  Show on card
                </label>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleSave} style={{
                  ...saveBtnStyle,
                  opacity: name.trim() ? 1 : 0.5,
                  pointerEvents: name.trim() ? 'auto' : 'none',
                }}>
                  <Check size={12} /> {editingId ? 'Update' : 'Add'}
                </button>
                <button onClick={resetForm} style={cancelBtnStyle}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!adding && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)' }}>
            <button onClick={() => { resetForm(); setAdding(true); }} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font-sans)',
              padding: '4px 0',
            }}>
              <Plus size={14} /> Add field
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-dim)', padding: 4, display: 'flex',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-muted)', padding: 2, display: 'flex',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '6px 10px', color: 'var(--text)',
  fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none',
  width: '100%',
};

const saveBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', borderRadius: 4, border: 'none',
  background: 'var(--amber-dim)', color: 'var(--amber)',
  fontSize: 12, fontFamily: 'var(--font-sans)', cursor: 'pointer',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 4,
  border: '1px solid var(--border)', background: 'none',
  color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
};
