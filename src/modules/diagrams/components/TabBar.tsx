import { useState, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { useDiagramsStore } from '@/stores/diagrams.store';

export function TabBar() {
  const pages = useDiagramsStore((s) => s.pages);
  const activePageId = useDiagramsStore((s) => s.activePageId);
  const addPage = useDiagramsStore((s) => s.addPage);
  const removePage = useDiagramsStore((s) => s.removePage);
  const renamePage = useDiagramsStore((s) => s.renamePage);
  const switchPage = useDiagramsStore((s) => s.switchPage);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleDoubleClick = useCallback((pageId: string, name: string) => {
    setEditingId(pageId);
    setEditValue(name);
  }, []);

  const confirmRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      renamePage(editingId, editValue.trim());
    }
    setEditingId(null);
  }, [editingId, editValue, renamePage]);

  if (pages.length <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        height: 30,
        background: 'var(--surface, #1a1a1a)',
        borderBottom: '1px solid var(--border, #333)',
        padding: '0 4px',
        flexShrink: 0,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {pages.map((page) => {
        const isActive = page.id === activePageId;
        const isEditing = editingId === page.id;

        return (
          <div
            key={page.id}
            onClick={() => switchPage(page.id)}
            onDoubleClick={() => handleDoubleClick(page.id, page.name)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 8px',
              height: 26,
              fontSize: 11,
              fontFamily: 'var(--font-sans)',
              color: isActive ? 'var(--text, #e2e8f0)' : 'var(--text-dim, #64748b)',
              background: isActive ? 'var(--background, #111)' : 'transparent',
              borderRadius: '4px 4px 0 0',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              borderBottom: isActive ? '2px solid var(--amber, #d4a017)' : '2px solid transparent',
              transition: 'background 0.15s, color 0.15s',
              flexShrink: 0,
            }}
          >
            {isEditing ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={confirmRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmRename();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: Math.max(40, editValue.length * 7),
                  fontSize: 11,
                  fontFamily: 'var(--font-sans)',
                  background: 'var(--surface, #1a1a1a)',
                  border: '1px solid var(--amber, #d4a017)',
                  borderRadius: 3,
                  color: 'var(--text, #e2e8f0)',
                  padding: '1px 4px',
                  outline: 'none',
                }}
              />
            ) : (
              <span>{page.name}</span>
            )}

            {pages.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removePage(page.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim, #64748b)',
                  cursor: 'pointer',
                  opacity: 0.5,
                  transition: 'opacity 0.15s',
                  padding: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
              >
                <X size={10} />
              </button>
            )}
          </div>
        );
      })}

      {/* Add page button */}
      <button
        onClick={() => addPage()}
        title="Add page"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: 4,
          background: 'none',
          border: 'none',
          color: 'var(--text-dim, #64748b)',
          cursor: 'pointer',
          transition: 'color 0.15s',
          flexShrink: 0,
          padding: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--amber, #d4a017)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim, #64748b)'; }}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
