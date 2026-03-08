import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Archive } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import type { Board } from './types';

function BoardCard({ board, onClick }: { board: Board; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md, 8px)',
        padding: 16,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        borderTop: `3px solid ${board.color || 'var(--mod-projects)'}`,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {board.icon && <span style={{ fontSize: 20 }}>{board.icon}</span>}
        <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>{board.title}</span>
      </div>
      {board.description && (
        <span style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.4 }}>
          {board.description}
        </span>
      )}
      {board.tags && board.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {board.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              style={{
                background: 'var(--surface)',
                color: 'var(--text-dim)',
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function SkeletonCard() {
  return (
    <div
      className="animate-pulse"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md, 8px)',
        padding: 16,
        height: 100,
      }}
    >
      <div style={{ background: 'var(--surface-hover)', height: 14, width: '60%', borderRadius: 4 }} />
      <div style={{ background: 'var(--surface-hover)', height: 10, width: '80%', borderRadius: 4, marginTop: 12 }} />
    </div>
  );
}

export function Component() {
  const boards = useProjectsStore((s) => s.boards);
  const loading = useProjectsStore((s) => s.loading);
  const fetchBoards = useProjectsStore((s) => s.fetchBoards);
  const createBoard = useProjectsStore((s) => s.createBoard);
  const navigate = useNavigate();

  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    const board = await createBoard({ title: newTitle.trim() });
    if (board) {
      setShowNew(false);
      setNewTitle('');
      navigate(`/projects/${board.id}`);
    }
  }, [newTitle, createBoard, navigate]);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
          Projects
        </h1>
        <button
          onClick={() => setShowNew(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'var(--amber)',
            color: '#06060a',
            border: 'none',
            borderRadius: 'var(--radius-md, 8px)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Plus size={14} />
          New Board
        </button>
      </div>

      {showNew && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: 16,
            marginBottom: 16,
            display: 'flex',
            gap: 8,
          }}
        >
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setShowNew(false); setNewTitle(''); }
            }}
            placeholder="Board name..."
            style={{
              flex: 1,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 10px',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleCreate}
            style={{
              padding: '6px 14px',
              background: 'var(--amber)',
              color: '#06060a',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Create
          </button>
          <button
            onClick={() => { setShowNew(false); setNewTitle(''); }}
            style={{
              padding: '6px 10px',
              background: 'none',
              color: 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 60,
            color: 'var(--text-dim)',
            gap: 12,
          }}
        >
          <Archive size={40} strokeWidth={1} />
          <span style={{ fontSize: 14 }}>No boards yet. Create your first board to get started.</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {boards.map((board) => (
            <BoardCard key={board.id} board={board} onClick={() => navigate(`/projects/${board.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
