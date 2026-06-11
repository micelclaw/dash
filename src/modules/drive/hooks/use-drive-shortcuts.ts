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

import { useEffect, useRef } from 'react';

export interface DriveShortcutHandlers {
  /**
   * Hard guard from the view: set true while any modal/dialog of the view is
   * open so shortcuts never fire underneath it.
   */
  disabled?: boolean;
  /** Ctrl/Cmd+C */
  onCopy?: () => void;
  /** Ctrl/Cmd+X */
  onCut?: () => void;
  /** Ctrl/Cmd+V */
  onPaste?: () => void;
  /** Ctrl/Cmd+A */
  onSelectAll?: () => void;
  /** Delete (in Trash views, wire this to delete-forever-with-confirm) */
  onDelete?: () => void;
  /** F2 — rename the single selected item */
  onRename?: () => void;
  /** Enter — open the selected item */
  onOpen?: () => void;
  /** Escape — clear selection / close preview */
  onEscape?: () => void;
}

/** Non-text input types — focus on these must NOT swallow the shortcuts
 *  (e.g. clicking a row checkbox leaves it focused). */
const NON_TEXT_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'file', 'color']);

/** True when the keystroke happened inside an editable element. */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  if (tag === 'INPUT') return !NON_TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  if (typeof el.closest === 'function' && el.closest('[contenteditable="true"]')) return true;
  return false;
}

/** True when some dialog is open (shadcn/radix portals use role="dialog"). */
function hasOpenDialog(): boolean {
  return !!document.querySelector('[role="dialog"], [data-state="open"][data-radix-portal]');
}

/**
 * Drive keyboard shortcuts (D4): Ctrl+C/X/V, Ctrl+A, Delete, F2, Enter, Esc.
 *
 * Guards: never fires while typing in an input/textarea/[contenteditable],
 * while the view reports a modal open (`disabled`), or while a Radix dialog
 * is mounted. Ctrl+C also yields to a real text selection so copying text
 * from the page keeps working.
 *
 * The handlers are kept in a ref so the window listener binds once.
 */
export function useDriveShortcuts(handlers: DriveShortcutHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const h = ref.current;
      if (h.disabled) return;
      if (isEditableTarget(e.target)) return;
      if (hasOpenDialog()) return;

      const mod = e.ctrlKey || e.metaKey;

      if (mod && !e.shiftKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'c' && h.onCopy) {
          // Let native copy win when the user selected text on the page.
          const sel = window.getSelection()?.toString();
          if (sel) return;
          e.preventDefault();
          h.onCopy();
          return;
        }
        if (key === 'x' && h.onCut) {
          e.preventDefault();
          h.onCut();
          return;
        }
        if (key === 'v' && h.onPaste) {
          e.preventDefault();
          h.onPaste();
          return;
        }
        if (key === 'a' && h.onSelectAll) {
          e.preventDefault();
          h.onSelectAll();
          return;
        }
        return;
      }

      if (mod || e.altKey) return;

      switch (e.key) {
        case 'Delete':
          if (h.onDelete) { e.preventDefault(); h.onDelete(); }
          break;
        case 'F2':
          if (h.onRename) { e.preventDefault(); h.onRename(); }
          break;
        case 'Enter':
          if (h.onOpen) { e.preventDefault(); h.onOpen(); }
          break;
        case 'Escape':
          if (h.onEscape) h.onEscape();
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
