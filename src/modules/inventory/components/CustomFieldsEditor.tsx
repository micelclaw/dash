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

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

/**
 * Plantillas de campos por categoría (plan §1.2): sugerencias de claves que
 * aparecen como chips de añadido rápido cuando la categoría coincide.
 * El editor sigue siendo libre — cualquier clave/valor es válido.
 */
export const CATEGORY_FIELD_TEMPLATES: Record<string, string[]> = {
  vehicle: ['matricula', 'km', 'itv_until', 'combustible'],
  electronics: ['imei', 'mac_address', 'os'],
  appliance: ['consumo_energetico', 'capacidad'],
  seguro: ['insurer', 'policy_number', 'premium', 'charge_period', 'charge_date', 'renewal_date', 'coverage'],
  tool: ['voltaje', 'bateria'],
  sport: ['talla', 'temporada'],
};

interface CustomFieldsEditorProps {
  /** Objeto actual de custom fields (solo se editan valores primitivos). */
  value: Record<string, unknown>;
  /** Recibe el objeto COMPLETO ya actualizado; el padre persiste. */
  onChange: (next: Record<string, unknown>) => void;
  /** Categoría del item — activa los chips de plantilla. */
  category?: string | null;
  /** Layout compacto (drawer) vs formulario (modal). */
  compact?: boolean;
}

const keyStyle: React.CSSProperties = {
  width: '38%',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '4px 7px',
  fontSize: '0.75rem',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-mono, monospace)',
};

const valStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '4px 7px',
  fontSize: '0.8125rem',
  color: 'var(--text)',
};

/**
 * Editor genérico de custom fields (clave → valor) con sugerencias por
 * categoría. Usado en el modal de creación y en el drawer del item.
 */
export function CustomFieldsEditor({ value, onChange, category, compact }: CustomFieldsEditorProps) {
  const [newKey, setNewKey] = useState('');

  const entries = Object.entries(value).filter(([, v]) => typeof v !== 'object' || v === null);
  const usedKeys = new Set(Object.keys(value));
  const suggestions = (category ? CATEGORY_FIELD_TEMPLATES[category.toLowerCase()] ?? [] : [])
    .filter(k => !usedKeys.has(k));

  const setField = (key: string, v: string) => onChange({ ...value, [key]: v });
  const removeField = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };
  const addKey = (raw: string) => {
    const key = raw.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!key || usedKeys.has(key)) return;
    onChange({ ...value, [key]: '' });
    setNewKey('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map(([key, v]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...keyStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={key}>{key}</span>
          <input
            style={valStyle}
            value={String(v ?? '')}
            onChange={e => setField(key, e.target.value)}
            placeholder="value"
          />
          <button
            type="button"
            onClick={() => removeField(key)}
            aria-label={`Remove ${key}`}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2, display: 'flex' }}
          >
            <X size={13} />
          </button>
        </div>
      ))}

      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
            {category}:
          </span>
          {suggestions.map(k => (
            <button
              key={k}
              type="button"
              onClick={() => addKey(k)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                background: 'var(--surface)',
                border: '1px dashed var(--border)',
                borderRadius: 999,
                padding: '1px 8px',
                fontSize: '0.6875rem',
                color: 'var(--text-dim)',
                cursor: 'pointer',
              }}
            >
              <Plus size={10} /> {k}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          style={{ ...keyStyle, width: compact ? '50%' : '38%' }}
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addKey(newKey);
            }
          }}
          placeholder="+ field name (Enter)"
        />
      </div>
    </div>
  );
}
