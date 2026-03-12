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

export function NewCardInput({ boardId, columnId }: { boardId: string; columnId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const createCard = useProjectsStore((s) => s.createCard);

  const handleCreate = useCallback(() => {
    if (!title.trim()) return;
    createCard(boardId, { column_id: columnId, title: title.trim() });
    setTitle('');
    setOpen(false);
  }, [title, boardId, columnId, createCard]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          padding: '6px 12px',
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: 12,
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          borderRadius: '0 0 8px 8px',
        }}
      >
        <Plus size={12} /> Add card
      </button>
    );
  }

  return (
    <div style={{ padding: '4px 8px 8px' }}>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreate();
          if (e.key === 'Escape') { setOpen(false); setTitle(''); }
        }}
        onBlur={() => { if (!title.trim()) setOpen(false); }}
        placeholder="Card title..."
        style={{
          width: '100%',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '6px 8px',
          color: 'var(--text)',
          fontSize: 12,
          fontFamily: 'var(--font-sans)',
          outline: 'none',
        }}
      />
    </div>
  );
}
