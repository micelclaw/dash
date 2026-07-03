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

// ─── Editores de filas key/value (nodos table y card) ───

import { AddButton, PanelInput, RemoveButton, Section, inputStyle } from './shared';

export function TableRowsEditor({
  rows,
  onChange,
}: {
  rows: Array<{ key: string; value: string; type?: string }>;
  onChange: (rows: Array<{ key: string; value: string; type?: string }>) => void;
}) {
  const update = (i: number, field: string, val: string) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r));
    onChange(next);
  };
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, { key: '', value: '', type: 'field' }]);

  return (
    <Section title="Columns">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <AddButton onClick={add}>+ Add</AddButton>
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <select
            value={row.type || 'field'}
            onChange={(e) => update(i, 'type', e.target.value)}
            style={{ ...inputStyle, width: 42, padding: '2px 2px', fontSize: 10 }}
          >
            <option value="pk">PK</option>
            <option value="fk">FK</option>
            <option value="field">·</option>
          </select>
          <PanelInput
            type="text"
            value={row.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            placeholder="name"
            style={{ flex: 1, fontSize: 10, padding: '2px 4px' }}
          />
          <PanelInput
            type="text"
            value={row.value}
            onChange={(e) => update(i, 'value', e.target.value)}
            placeholder="type"
            style={{ width: 50, fontSize: 10, padding: '2px 4px' }}
          />
          <RemoveButton onClick={() => remove(i)} />
        </div>
      ))}
    </Section>
  );
}

export function CardPropertiesEditor({
  properties,
  onChange,
}: {
  properties: Array<{ key: string; value: string }>;
  onChange: (props: Array<{ key: string; value: string }>) => void;
}) {
  const update = (i: number, field: string, val: string) => {
    const next = properties.map((p, idx) => (idx === i ? { ...p, [field]: val } : p));
    onChange(next);
  };
  const remove = (i: number) => onChange(properties.filter((_, idx) => idx !== i));
  const add = () => onChange([...properties, { key: '', value: '' }]);

  return (
    <Section title="Properties">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <AddButton onClick={add}>+ Add</AddButton>
      </div>
      {properties.map((prop, i) => (
        <div key={i} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <PanelInput
            type="text"
            value={prop.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            placeholder="key"
            style={{ flex: 1, fontSize: 10, padding: '2px 4px' }}
          />
          <PanelInput
            type="text"
            value={prop.value}
            onChange={(e) => update(i, 'value', e.target.value)}
            placeholder="value"
            style={{ flex: 1, fontSize: 10, padding: '2px 4px' }}
          />
          <RemoveButton onClick={() => remove(i)} />
        </div>
      ))}
    </Section>
  );
}
