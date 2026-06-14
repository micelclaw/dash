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
import { Plus } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';

const COLUMN_COLOR_PRESETS = [
  '#94a3b8', '#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444',
] as const;

export function NewColumnInput({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [wipLimit, setWipLimit] = useState('');
  const createColumn = useProjectsStore((s) => s.createColumn);

  const reset = useCallback(() => {
    setOpen(false);
    setTitle('');
    setColor(null);
    setWipLimit('');
  }, []);

  const handleCreate = useCallback(() => {
    if (!title.trim()) return;
    const wip = parseInt(wipLimit, 10);
    createColumn(boardId, {
      title: title.trim(),
      color: color ?? undefined,
      wip_limit: Number.isFinite(wip) && wip > 0 ? wip : undefined,
    });
    reset();
  }, [title, color, wipLimit, boardId, createColumn, reset]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: 280,
          minWidth: 280,
          padding: '10px 14px',
          background: 'color-mix(in srgb, var(--surface) 40%, transparent)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          border: '1px dashed var(--border)',
          borderRadius: 8,
          color: 'var(--text-muted)',
          fontSize: 13,
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Plus size={14} /> Add column
      </button>
    );
  }

  return (
    <div
      style={{
        width: 280,
        minWidth: 280,
        padding: 12,
        background: 'color-mix(in srgb, var(--surface) 40%, transparent)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreate();
          if (e.key === 'Escape') reset();
        }}
        placeholder="Column title..."
        style={{
          width: '100%',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '6px 8px',
          color: 'var(--text)',
          fontSize: 13,
          fontFamily: 'var(--font-sans)',
          outline: 'none',
        }}
      />

      {/* Color swatches (optional) */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {COLUMN_COLOR_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(color === c ? null : c)}
            title={c}
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: c,
              border: color === c ? '2px solid var(--text)' : '1px solid var(--border)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
        ))}
        <input
          type="number"
          min={1}
          value={wipLimit}
          onChange={(e) => setWipLimit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          placeholder="WIP"
          title="WIP limit (optional)"
          style={{
            width: 52,
            marginLeft: 'auto',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '3px 6px',
            color: 'var(--text)',
            fontSize: 12,
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handleCreate}
          disabled={!title.trim()}
          style={{
            padding: '4px 12px',
            background: 'var(--amber)',
            color: '#06060a',
            border: 'none',
            borderRadius: 6,
            cursor: title.trim() ? 'pointer' : 'not-allowed',
            opacity: title.trim() ? 1 : 0.6,
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Add
        </button>
        <button
          onClick={reset}
          style={{
            padding: '4px 10px',
            background: 'none',
            color: 'var(--text-dim)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
