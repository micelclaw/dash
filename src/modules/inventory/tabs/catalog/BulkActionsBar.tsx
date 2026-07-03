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
import { Tag as TagIcon, Trash2 } from 'lucide-react';
import { SYSTEM_STATUS_LABELS, type InventoryLocation } from '@/modules/inventory/types';
import { btnSecondary, inputStyle, selectStyle } from '@/modules/inventory/ui';

interface BulkActionsBarProps {
  selectedCount: number;
  busy: boolean;
  locations: InventoryLocation[];
  systemStatuses: string[];
  onMove: (locationId: string | null) => void;
  onStatus: (status: string) => void;
  onAddTag: (tag: string) => void;
  onShowLabels: () => void;
  onDelete: () => void;
  onClear: () => void;
}

/** Barra de acciones masivas — aparece al seleccionar filas del catálogo. */
export function BulkActionsBar({
  selectedCount,
  busy,
  locations,
  systemStatuses,
  onMove,
  onStatus,
  onAddTag,
  onShowLabels,
  onDelete,
  onClear,
}: BulkActionsBarProps) {
  const [tagDraft, setTagDraft] = useState('');

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 3,
        background: 'color-mix(in srgb, var(--mod-inventory) 12%, var(--card))',
        borderBottom: '1px solid var(--mod-inventory)',
        padding: '8px 16px',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
        {selectedCount} selected
      </span>

      {/* Mover a ubicación */}
      <select
        style={selectStyle}
        value=""
        disabled={busy}
        onChange={e => { const v = e.target.value; if (v) onMove(v === '__none__' ? null : v); e.currentTarget.value = ''; }}
        aria-label="Move to location"
      >
        <option value="">Move to…</option>
        <option value="__none__">No location</option>
        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>

      {/* Cambiar estado */}
      <select
        style={selectStyle}
        value=""
        disabled={busy}
        onChange={e => { const v = e.target.value; if (v) onStatus(v); e.currentTarget.value = ''; }}
        aria-label="Set status"
      >
        <option value="">Set status…</option>
        {systemStatuses.map(s => <option key={s} value={s}>{SYSTEM_STATUS_LABELS[s] ?? s}</option>)}
      </select>

      {/* Añadir tag */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <TagIcon size={13} style={{ position: 'absolute', left: 8, color: 'var(--text-dim)', pointerEvents: 'none' }} />
        <input
          style={{ ...inputStyle, width: 150, padding: '5px 8px 5px 26px' }}
          placeholder="Add tag + Enter"
          value={tagDraft}
          disabled={busy}
          onChange={e => setTagDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && tagDraft.trim()) { onAddTag(tagDraft); setTagDraft(''); } }}
        />
      </div>

      {/* Etiquetas QR */}
      <button
        style={{ ...btnSecondary, display: 'inline-flex', alignItems: 'center', gap: 5 }}
        disabled={busy}
        onClick={onShowLabels}
        title="Print QR labels for the selected items"
      >
        🏷 Labels
      </button>

      {/* Borrar en lote */}
      <button
        style={{ ...btnSecondary, color: 'var(--error)', borderColor: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: 5 }}
        disabled={busy}
        onClick={onDelete}
      >
        <Trash2 size={13} /> Delete
      </button>

      <button style={{ ...btnSecondary, marginLeft: 'auto' }} disabled={busy} onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
