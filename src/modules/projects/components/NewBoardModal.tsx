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
import { X } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import { EmojiAvatarPicker } from '@/components/shared/EmojiAvatarPicker';
import { TagInput } from '@/components/shared/TagInput';
import { BOARD_COLOR_PRESETS, BOARD_VIEW_OPTIONS } from '../utils/board-options';
import type { Board } from '../types';

interface NewBoardModalProps {
  onClose: () => void;
  onCreated: (board: Board) => void;
}

export function NewBoardModal({ onClose, onCreated }: NewBoardModalProps) {
  const createBoard = useProjectsStore((s) => s.createBoard);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [defaultView, setDefaultView] = useState('board');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    const board = await createBoard({
      title: title.trim(),
      description: description.trim() || undefined,
      color: color ?? undefined,
      icon: icon ?? undefined,
      tags: tags.length ? tags : undefined,
      default_view: defaultView !== 'board' ? defaultView : undefined,
    });
    setSubmitting(false);
    if (board) onCreated(board);
  }, [title, description, color, icon, tags, defaultView, submitting, createBoard, onCreated]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(25px)' }} onClick={onClose} />
      <div
        style={{
          position: 'relative',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 440,
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>New Board</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') onClose();
              }}
              placeholder="Board name..."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this board for?"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <label style={labelStyle}>Icon</label>
              <EmojiAvatarPicker
                value={icon}
                onChange={setIcon}
                size={32}
                fallback="📋"
                title="Choose board icon"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Color</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {BOARD_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(color === c ? null : c)}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', background: c,
                      border: color === c ? '2px solid var(--text)' : '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={color ?? '#3b82f6'}
                  onChange={(e) => setColor(e.target.value)}
                  title="Custom color"
                  style={{ width: 26, height: 26, padding: 0, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Tags</label>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          <div>
            <label style={labelStyle}>Default view</label>
            <select
              value={defaultView}
              onChange={(e) => setDefaultView(e.target.value)}
              style={{ ...inputStyle, width: 180 }}
            >
              {BOARD_VIEW_OPTIONS.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              onClick={onClose}
              style={{
                padding: '6px 12px', background: 'none', color: 'var(--text-dim)',
                border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
                fontSize: 13, fontFamily: 'var(--font-sans)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim() || submitting}
              style={{
                padding: '6px 14px', background: 'var(--amber)', color: '#06060a',
                border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500,
                fontFamily: 'var(--font-sans)',
                cursor: !title.trim() || submitting ? 'not-allowed' : 'pointer',
                opacity: !title.trim() || submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Creating...' : 'Create board'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--text-dim)',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
  fontFamily: 'var(--font-sans)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '6px 10px',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
};
