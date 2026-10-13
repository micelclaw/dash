import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NotionCollectionSchema } from '@/services/sync.service';

export interface NotionFieldMapping {
  title_property: string;
  status_property: string;
  status_type: 'status' | 'select';
  description_property?: string;
  start_property?: string;
  due_property?: string;
  priority_property?: string;
  tags_property?: string;
  people_property?: string;
  files_property?: string;
  subtasks_property?: string;
  status_semantics: Record<string, string | null>;
}

interface Props {
  schemas: NotionCollectionSchema[];
  initialMappings?: Record<string, NotionFieldMapping>;
  busy?: boolean;
  onBack: () => void;
  onStart: (mappings: Record<string, NotionFieldMapping>) => void;
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 9px', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.8125rem',
};

function initialMapping(schema: NotionCollectionSchema): NotionFieldMapping {
  const title = schema.suggested_mapping.title_property
    ?? schema.properties.find((p) => p.type === 'title')?.name ?? '';
  const statusProperty = schema.suggested_mapping.status_property
    ?? schema.properties.find((p) => p.type === 'status' || p.type === 'select')?.name ?? '';
  const statusSchema = schema.properties.find((p) => p.name === statusProperty);
  return {
    ...schema.suggested_mapping,
    title_property: title,
    status_property: statusProperty,
    status_type: statusSchema?.type === 'select' ? 'select' : 'status',
    status_semantics: Object.fromEntries((statusSchema?.options ?? []).map((option) => [option.name, null])),
  };
}

export function NotionMappingStep({ schemas, initialMappings, busy, onBack, onStart }: Props) {
  const [mappings, setMappings] = useState<Record<string, NotionFieldMapping>>(
    () => Object.fromEntries(schemas.map((schema) => [schema.id, { ...initialMapping(schema), ...(initialMappings?.[schema.id] ?? {}) }])),
  );
  const valid = useMemo(() => schemas.every((s) => mappings[s.id]?.title_property && mappings[s.id]?.status_property), [schemas, mappings]);

  const patch = (sourceId: string, value: Partial<NotionFieldMapping>) => {
    setMappings((current) => ({ ...current, [sourceId]: { ...current[sourceId]!, ...value } }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>¿Qué significa cada campo?</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.5 }}>
          Título y estado son obligatorios. Los demás se pueden dejar sin sincronizar.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 360, overflowY: 'auto' }}>
        {schemas.map((schema) => {
          const mapping = mappings[schema.id]!;
          const statusSchema = schema.properties.find((p) => p.name === mapping.status_property);
          const choices = (type: string) => schema.properties.filter((p) => p.type === type);
          return (
            <div key={schema.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 10 }}>
              <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: 9 }}>{schema.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Field label="Título *" value={mapping.title_property} options={choices('title')} onChange={(title_property) => patch(schema.id, { title_property })} />
                <Field label="Estado *" value={mapping.status_property} options={schema.properties.filter((p) => p.type === 'status' || p.type === 'select')} onChange={(status_property) => {
                  const selected = schema.properties.find((p) => p.name === status_property);
                  patch(schema.id, {
                    status_property,
                    status_type: selected?.type === 'select' ? 'select' : 'status',
                    status_semantics: Object.fromEntries((selected?.options ?? []).map((o) => [o.name, null])),
                  });
                }} />
                <Field label="Descripción" value={mapping.description_property ?? ''} options={choices('rich_text')} optional onChange={(description_property) => patch(schema.id, { description_property: description_property || undefined })} />
                <Field label="Inicio" value={mapping.start_property ?? ''} options={choices('date')} optional onChange={(start_property) => patch(schema.id, { start_property: start_property || undefined })} />
                <Field label="Vencimiento" value={mapping.due_property ?? ''} options={choices('date')} optional onChange={(due_property) => patch(schema.id, { due_property: due_property || undefined })} />
                <Field label="Prioridad" value={mapping.priority_property ?? ''} options={choices('select')} optional onChange={(priority_property) => patch(schema.id, { priority_property: priority_property || undefined })} />
                <Field label="Etiquetas" value={mapping.tags_property ?? ''} options={choices('multi_select')} optional onChange={(tags_property) => patch(schema.id, { tags_property: tags_property || undefined })} />
                <Field label="Personas" value={mapping.people_property ?? ''} options={choices('people')} optional onChange={(people_property) => patch(schema.id, { people_property: people_property || undefined })} />
                <Field label="Archivos" value={mapping.files_property ?? ''} options={choices('files')} optional onChange={(files_property) => patch(schema.id, { files_property: files_property || undefined })} />
                <Field label="Subtareas" value={mapping.subtasks_property ?? ''} options={choices('relation')} optional onChange={(subtasks_property) => patch(schema.id, { subtasks_property: subtasks_property || undefined })} />
              </div>
              {(statusSchema?.options ?? []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 5 }}>Significado de los estados</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {(statusSchema?.options ?? []).map((option) => (
                      <label key={option.name} style={{ fontSize: '0.75rem', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{option.name}</span>
                        <select
                          style={{ ...selectStyle, width: 130, padding: '5px 6px' }}
                          value={mapping.status_semantics[option.name] ?? ''}
                          onChange={(e) => patch(schema.id, { status_semantics: { ...mapping.status_semantics, [option.name]: e.target.value || null } })}
                        >
                          <option value="">Sin semántica</option>
                          <option value="needs_action">Pendiente</option>
                          <option value="in_progress">En curso</option>
                          <option value="completed">Completada</option>
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: 'var(--surface)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>Vista previa · hasta 3 tareas reales</div>
                {(schema.preview ?? []).length === 0 && <div>La fuente está vacía.</div>}
                {(schema.preview ?? []).map((item) => <div key={item.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(item.values[mapping.title_property] ?? item.title)} <span style={{ opacity: 0.7 }}>→ {String(item.values[mapping.status_property] ?? 'Sin estado')}</span>
                </div>)}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onBack} disabled={busy}>Atrás</Button>
        <Button onClick={() => onStart(mappings)} disabled={busy || !valid}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Empezando…</> : 'Empezar'}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value, options, optional, onChange }: {
  label: string;
  value: string;
  options: Array<{ name: string }>;
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
      {label}
      <select style={{ ...selectStyle, marginTop: 4 }} value={value} onChange={(e) => onChange(e.target.value)}>
        {optional && <option value="">No sincronizar</option>}
        {!optional && !value && <option value="">Elige una propiedad</option>}
        {options.map((option) => <option key={option.name} value={option.name}>{option.name}</option>)}
      </select>
    </label>
  );
}
