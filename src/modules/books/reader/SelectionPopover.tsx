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

/**
 * Floating popover anchored to a text selection (create mode: pick one of 4
 * highlight colors, optionally with a note) or to an existing highlight
 * (view mode: read the note, delete). Position is given in reader-overlay
 * coordinates and clamped to the viewport.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { Loader2, StickyNote, Trash2 } from 'lucide-react';
import { HIGHLIGHT_COLORS } from './reader-prefs';
import type { BookAnnotation } from '@/services/books.service';

export type SelectionPopoverState =
  | { kind: 'create'; x: number; y: number; cfi: string; text: string }
  | { kind: 'view'; x: number; y: number; annotation: BookAnnotation };

export interface SelectionPopoverProps {
  state: SelectionPopoverState;
  busy: boolean;
  onHighlight: (color: string, note?: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function SelectionPopover({
  state,
  busy,
  onHighlight,
  onDelete,
  onClose,
}: SelectionPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [color, setColor] = useState<string>(HIGHLIGHT_COLORS[0].value);

  // Clamp to viewport once rendered (and when the anchor/expansion changes).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 8;
    let left = state.x - width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    let top = state.y + 10; // below the anchor…
    if (top + height > window.innerHeight - margin) top = state.y - height - 10; // …or above
    top = Math.max(margin, top);
    setPos({ left, top });
  }, [state.x, state.y, noteOpen]);

  return (
    <>
      {/* Transparent backdrop: any click on the host page dismisses. Clicks
          inside the book iframe are handled by ReaderView's doc listeners. */}
      <div className="absolute inset-0 z-30" onPointerDown={onClose} />
      <div
        ref={ref}
        className="fixed z-40 w-60 rounded-lg border p-2 shadow-lg"
        style={{
          left: pos?.left ?? state.x,
          top: pos?.top ?? state.y,
          visibility: pos ? 'visible' : 'hidden',
          background: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        {state.kind === 'create' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-1">
              <div className="flex gap-1.5">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    title={noteOpen ? `${c.name} (used on save)` : `Highlight ${c.name.toLowerCase()}`}
                    aria-label={`Highlight ${c.name.toLowerCase()}`}
                    disabled={busy}
                    onClick={() => {
                      setColor(c.value);
                      // Without a note open, a color tap saves immediately.
                      if (!noteOpen) onHighlight(c.value);
                    }}
                    className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      background: c.value,
                      borderColor: noteOpen && color === c.value ? 'var(--text)' : 'transparent',
                    }}
                  />
                ))}
              </div>
              <button
                title="Add note"
                aria-label="Add note"
                disabled={busy}
                onClick={() => setNoteOpen((v) => !v)}
                className="rounded-md p-1.5 hover:bg-[var(--surface-hover,rgba(127,127,127,0.12))]"
                style={{ color: noteOpen ? 'var(--accent, var(--text))' : 'var(--text-dim)' }}
              >
                <StickyNote size={15} />
              </button>
            </div>
            {noteOpen ? (
              <>
                <textarea
                  autoFocus
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Write a note…"
                  rows={3}
                  className="w-full resize-none rounded-md border p-2 text-xs outline-none"
                  style={{
                    background: 'var(--bg, transparent)',
                    color: 'var(--text)',
                    borderColor: 'var(--border)',
                  }}
                />
                <button
                  disabled={busy}
                  onClick={() => onHighlight(color, note.trim() || undefined)}
                  className="flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-white"
                  style={{ background: 'var(--accent, #3b82f6)' }}
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                  Save highlight
                </button>
              </>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: state.annotation.color }}
              />
              <p className="truncate text-xs" style={{ color: 'var(--text-dim)' }}>
                {state.annotation.selected_text || 'Highlight'}
              </p>
            </div>
            {state.annotation.note ? (
              <p
                className="max-h-32 overflow-y-auto whitespace-pre-wrap text-xs"
                style={{ color: 'var(--text)' }}
              >
                {state.annotation.note}
              </p>
            ) : (
              <p className="text-xs italic" style={{ color: 'var(--text-dim)' }}>
                No note
              </p>
            )}
            <button
              disabled={busy}
              onClick={onDelete}
              className="flex items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium"
              style={{ color: '#ef4444', borderColor: 'var(--border)' }}
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Delete highlight
            </button>
          </div>
        )}
      </div>
    </>
  );
}
