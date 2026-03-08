import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';

export function NewColumnInput({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const createColumn = useProjectsStore((s) => s.createColumn);

  const handleCreate = useCallback(() => {
    if (!title.trim()) return;
    createColumn(boardId, { title: title.trim() });
    setTitle('');
    setOpen(false);
  }, [title, boardId, createColumn]);

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
          background: 'var(--surface)',
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
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        flexShrink: 0,
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreate();
          if (e.key === 'Escape') { setOpen(false); setTitle(''); }
        }}
        onBlur={() => { if (!title.trim()) setOpen(false); }}
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
    </div>
  );
}
