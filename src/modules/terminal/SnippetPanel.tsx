/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Copy, Search } from 'lucide-react';
import { useTerminalStore, type SavedSnippet } from '@/stores/terminal.store';

interface SnippetPanelProps {
  open: boolean;
  onClose: () => void;
  onPaste: (command: string) => void;
}

export function SnippetPanel({ open, onClose, onPaste }: SnippetPanelProps) {
  const snippets = useTerminalStore((s) => s.snippets);
  const fetchSnippets = useTerminalStore((s) => s.fetchSnippets);
  const createSnippet = useTerminalStore((s) => s.createSnippet);
  const deleteSnippet = useTerminalStore((s) => s.deleteSnippet);

  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newTags, setNewTags] = useState('');

  useEffect(() => {
    if (open) fetchSnippets();
  }, [open, fetchSnippets]);

  const filtered = snippets.filter((s) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return s.label.toLowerCase().includes(q) ||
      s.command.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q));
  });

  const handleAdd = async () => {
    if (!newLabel.trim() || !newCommand.trim()) return;
    await createSnippet({
      label: newLabel.trim(),
      command: newCommand.trim(),
      tags: newTags ? newTags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    });
    setNewLabel('');
    setNewCommand('');
    setNewTags('');
    setAdding(false);
  };

  if (!open) return null;

  return (
    <div style={{
      width: 280,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid var(--border)',
      background: 'var(--surface)',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px 0 12px',
        borderBottom: '1px solid var(--border)',
        gap: 8,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', flex: 1 }}>Snippets</span>
        <button onClick={() => setAdding(true)} style={iconBtnStyle} title="Add snippet">
          <Plus size={13} />
        </button>
        <button onClick={onClose} style={iconBtnStyle} title="Close">
          <X size={13} />
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '6px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search snippets..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid var(--border)' }}>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label"
            style={fieldStyle}
            autoFocus
          />
          <input
            value={newCommand}
            onChange={(e) => setNewCommand(e.target.value)}
            placeholder="Command"
            style={{ ...fieldStyle, fontFamily: 'var(--font-mono)' }}
          />
          <input
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="Tags (comma-separated)"
            style={fieldStyle}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={handleAdd} style={{ ...smallBtnStyle, background: 'var(--amber)', color: '#06060a', fontWeight: 600, border: 'none' }}>
              Save
            </button>
            <button onClick={() => setAdding(false)} style={smallBtnStyle}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            {snippets.length === 0 ? 'No snippets saved yet' : 'No matches'}
          </div>
        )}
        {filtered.map((snippet) => (
          <SnippetItem
            key={snippet.id}
            snippet={snippet}
            onPaste={() => onPaste(snippet.command)}
            onDelete={() => deleteSnippet(snippet.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SnippetItem({ snippet, onPaste, onDelete }: {
  snippet: SavedSnippet;
  onPaste: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onPaste}
      style={{
        padding: '6px 8px',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        marginBottom: 2,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {snippet.label}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onPaste(); }}
          style={iconBtnStyle}
          title="Paste into terminal"
        >
          <Copy size={11} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={iconBtnStyle}
          title="Delete"
        >
          <Trash2 size={11} />
        </button>
      </div>
      <div style={{
        fontSize: '0.6875rem',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        marginTop: 2,
      }}>
        {snippet.command}
      </div>
      {snippet.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'wrap' }}>
          {snippet.tags.map((tag) => (
            <span key={tag} style={{
              fontSize: '0.5625rem',
              padding: '1px 4px',
              background: 'var(--bg)',
              borderRadius: 2,
              color: 'var(--text-muted)',
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  background: 'transparent',
  border: 'none',
  borderRadius: 2,
  color: 'var(--text-muted)',
  cursor: 'pointer',
  flexShrink: 0,
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: '0.75rem',
  fontFamily: 'var(--font-sans)',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
};

const smallBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '0.6875rem',
  fontFamily: 'var(--font-sans)',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  cursor: 'pointer',
};
