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

import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks,
  Quote, Minus, Code2,
  Link2,
} from 'lucide-react';

interface NoteEditorToolbarProps {
  editor: Editor | null;
}

interface ToolbarButton {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  action: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
  separator?: boolean;
}

const BUTTONS: ToolbarButton[] = [
  // Text formatting
  { icon: Bold, label: 'Bold', action: e => e.chain().focus().toggleBold().run(), isActive: e => e.isActive('bold') },
  { icon: Italic, label: 'Italic', action: e => e.chain().focus().toggleItalic().run(), isActive: e => e.isActive('italic') },
  { icon: Underline, label: 'Underline', action: e => e.chain().focus().toggleUnderline().run(), isActive: e => e.isActive('underline') },
  { icon: Strikethrough, label: 'Strikethrough', action: e => e.chain().focus().toggleStrike().run(), isActive: e => e.isActive('strike') },
  // Separator
  { icon: Bold, label: '', action: () => {}, separator: true },
  // Headings
  { icon: Heading1, label: 'Heading 1', action: e => e.chain().focus().toggleHeading({ level: 1 }).run(), isActive: e => e.isActive('heading', { level: 1 }) },
  { icon: Heading2, label: 'Heading 2', action: e => e.chain().focus().toggleHeading({ level: 2 }).run(), isActive: e => e.isActive('heading', { level: 2 }) },
  { icon: Heading3, label: 'Heading 3', action: e => e.chain().focus().toggleHeading({ level: 3 }).run(), isActive: e => e.isActive('heading', { level: 3 }) },
  // Separator
  { icon: Bold, label: '', action: () => {}, separator: true },
  // Lists
  { icon: List, label: 'Bullet list', action: e => e.chain().focus().toggleBulletList().run(), isActive: e => e.isActive('bulletList') },
  { icon: ListOrdered, label: 'Ordered list', action: e => e.chain().focus().toggleOrderedList().run(), isActive: e => e.isActive('orderedList') },
  { icon: ListChecks, label: 'Task list', action: e => e.chain().focus().toggleTaskList().run(), isActive: e => e.isActive('taskList') },
  // Separator
  { icon: Bold, label: '', action: () => {}, separator: true },
  // Blocks
  { icon: Quote, label: 'Blockquote', action: e => e.chain().focus().toggleBlockquote().run(), isActive: e => e.isActive('blockquote') },
  { icon: Minus, label: 'Horizontal rule', action: e => e.chain().focus().setHorizontalRule().run() },
  { icon: Code2, label: 'Code block', action: e => e.chain().focus().toggleCodeBlock().run(), isActive: e => e.isActive('codeBlock') },
  // Separator
  { icon: Bold, label: '', action: () => {}, separator: true },
  // Insert
  {
    icon: Link2, label: 'Link',
    action: e => {
      const url = window.prompt('URL:');
      if (url) e.chain().focus().setLink({ href: url }).run();
    },
    isActive: e => e.isActive('link'),
  },
];

export function NoteEditorToolbar({ editor }: NoteEditorToolbarProps) {
  if (!editor) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      padding: '4px 0',
      marginBottom: 8,
      borderBottom: '1px solid var(--border)',
      flexWrap: 'wrap',
    }}>
      {BUTTONS.map((btn, i) => {
        if (btn.separator) {
          return (
            <div
              key={`sep-${i}`}
              style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }}
            />
          );
        }

        const Icon = btn.icon;
        const active = btn.isActive?.(editor) ?? false;

        return (
          <button
            key={btn.label}
            onClick={() => btn.action(editor)}
            title={btn.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              background: active ? 'var(--amber-dim)' : 'transparent',
              color: active ? 'var(--amber)' : 'var(--text-dim)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={e => {
              if (!active) e.currentTarget.style.background = 'var(--surface-hover)';
            }}
            onMouseLeave={e => {
              if (!active) e.currentTarget.style.background = 'transparent';
            }}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}
