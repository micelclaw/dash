import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TaskCollectionSchema } from '@/services/sync.service';

type Mapping = Record<string, string | undefined>;
interface Props {
  provider: 'monday' | 'jira' | 'trello';
  schemas: TaskCollectionSchema[];
  initialMappings?: Record<string, Mapping>;
  busy?: boolean;
  onBack: () => void;
  onStart: (mappings: Record<string, Mapping>) => void;
}
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 9px', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.8125rem',
};
const DEFINITIONS = {
  monday: [
    ['status_column', 'Estado', ['status', 'dropdown'], false], ['start_column', 'Inicio', ['date', 'timeline'], true],
    ['due_column', 'Vencimiento', ['date', 'timeline'], true], ['priority_column', 'Prioridad', ['status', 'dropdown'], true],
    ['tags_column', 'Etiquetas', ['tags', 'dropdown'], true], ['people_column', 'Personas', ['people'], true],
    ['files_column', 'Archivos', ['file'], true], ['description_column', 'Descripción', ['long_text', 'text'], true],
  ],
  jira: [
    ['start_field', 'Inicio', ['date', 'datetime'], true], ['due_field', 'Vencimiento', ['date', 'datetime'], true],
    ['priority_field', 'Prioridad', ['priority', 'option'], true], ['labels_field', 'Etiquetas', ['array'], true],
    ['assignee_field', 'Responsable', ['user'], true],
  ],
  trello: [['priority_field', 'Prioridad (campo personalizado)', ['custom_list', 'custom_number', 'custom_text'], true]],
} as const;

export function TaskMappingStep({ provider, schemas, initialMappings, busy, onBack, onStart }: Props) {
  const [mappings, setMappings] = useState<Record<string, Mapping>>(() => Object.fromEntries(
    schemas.map((schema) => [schema.id, { ...schema.suggested_mapping, ...(initialMappings?.[schema.id] ?? {}) }]),
  ));
  const valid = useMemo(() => provider !== 'monday' || schemas.every((schema) => {
    const mapping = mappings[schema.id];
    return (Boolean(mapping?.status_column) || (schema.groups?.length ?? 0) > 0)
      && (!mapping?.priority_column || mapping.priority_column !== mapping.status_column);
  }), [mappings, provider, schemas]);
  const patch = (id: string, key: string, value: string) => setMappings((current) => ({
    ...current, [id]: { ...current[id], [key]: value || undefined },
  }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Confirma cómo se traducen los campos</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.5 }}>
          Solo se sincronizarán los campos con una columna equivalente. Los demás se conservan en cada aplicación, sin copiarse ni borrarse.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 380, overflowY: 'auto' }}>
        {schemas.map((schema) => (
          <div key={schema.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 10 }}>
            <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: 9 }}>{schema.name ?? schema.id}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {DEFINITIONS[provider].map(([key, label, types, optional]) => {
                const options = schema.properties.filter((property) => (types as readonly string[]).includes(property.type));
                return <label key={key} style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                  {label}{optional ? '' : ' *'}
                  <select style={{ ...selectStyle, marginTop: 4 }} value={mappings[schema.id]?.[key] ?? ''} onChange={(event) => patch(schema.id, key, event.target.value)}>
                    <option value="">{optional ? 'No sincronizar' : provider === 'monday' && schema.groups?.length ? 'Usar grupos' : 'Elige un campo'}</option>
                    {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                </label>;
              })}
            </div>
            {provider === 'monday' && mappings[schema.id]?.priority_column && mappings[schema.id]?.priority_column === mappings[schema.id]?.status_column && (
              <div role="alert" style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--warning, #f59e0b)' }}>
                Estado y prioridad no pueden usar la misma columna. Elige una columna de prioridad distinta o «No sincronizar».
              </div>
            )}
            <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: 'var(--surface)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>Vista previa · hasta 3 tareas reales</div>
              {(schema.preview ?? []).length === 0 && <div>La colección está vacía.</div>}
              {(schema.preview ?? []).map((item) => {
                const key = provider === 'monday' ? mappings[schema.id]?.status_column : provider === 'jira' ? 'status' : 'idList';
                const raw = key ? item.values[key] : null;
                const value = raw && typeof raw === 'object' && 'name' in raw ? String((raw as { name?: unknown }).name ?? '') : String(raw ?? 'Sin estado');
                const option = schema.properties.flatMap((property) => property.options ?? []).find((entry) => entry.id === value);
                return <div key={item.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title} <span style={{ opacity: 0.7 }}>→ {option?.name ?? value}</span>
                </div>;
              })}
              <div style={{ marginTop: 5, opacity: 0.75 }}>Un campo sin asignar no se copiará entre aplicaciones; sus valores existentes se conservan.</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onBack} disabled={busy}>Atrás</Button>
        <Button onClick={() => onStart(mappings)} disabled={busy || !valid}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Empezando…</> : 'Confirmar y empezar'}
        </Button>
      </div>
    </div>
  );
}
