import { CustomFieldsEditor } from './CustomFieldsEditor';
import { descriptorsForCategory } from './category-fields';
import { inputStyle, selectStyle } from '@/modules/inventory/ui';

export function CategoryFieldsForm({ category, value, onChange }: {
  category?: string | null;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const descriptors = descriptorsForCategory(category);
  const setField = (key: string, fieldValue: unknown) => onChange({ ...value, [key]: fieldValue });
  const descriptorKeys = new Set(descriptors.map(field => field.key));
  const advanced = Object.fromEntries(Object.entries(value).filter(([key]) => !descriptorKeys.has(key)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {descriptors.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {descriptors.map(field => (
            <label key={field.key} style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              {field.label}
              {field.type === 'select' ? (
                <select style={{ ...selectStyle, width: '100%', marginTop: 3 }} value={String(value[field.key] ?? '')} onChange={event => setField(field.key, event.target.value)}>
                  <option value="">—</option>
                  {field.options?.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input
                  style={{ ...inputStyle, marginTop: 3 }}
                  type={field.type}
                  step={field.type === 'number' ? 'any' : undefined}
                  value={String(value[field.key] ?? '')}
                  onChange={event => setField(
                    field.key,
                    field.type === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value,
                  )}
                />
              )}
            </label>
          ))}
        </div>
      )}
      <details>
        <summary style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.75rem' }}>Advanced custom fields</summary>
        <div style={{ marginTop: 8 }}>
          <CustomFieldsEditor
            value={advanced}
            onChange={next => {
              const typed = Object.fromEntries(Object.entries(value).filter(([key]) => descriptorKeys.has(key)));
              onChange({ ...typed, ...next });
            }}
            compact
          />
        </div>
      </details>
    </div>
  );
}
