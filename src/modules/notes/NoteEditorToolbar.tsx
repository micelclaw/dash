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
  Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, ListChecks,
  Quote, Minus, Code2,
  Link2, Table, Image as ImageIcon, Highlighter,
  Subscript as SubIcon, Superscript as SupIcon,
  ChevronsDownUp, AlignLeft, AlignCenter, AlignRight,
  Palette, Youtube as YoutubeIcon, ListTree,
  Rows3, Columns3, Trash2,
} from 'lucide-react';

type NoteFormat = 'markdown' | 'html' | 'plain';

interface NoteEditorToolbarProps {
  editor: Editor | null;
  /** Formato de la nota: los botones cuyo nodo/mark NO sobrevive a la
   *  serialización markdown se ocultan fuera de HTML (hiddenFor). */
  format?: NoteFormat;
  tocOpen?: boolean;
  onToggleToc?: () => void;
}

interface ToolbarButton {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  action: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
  separator?: boolean;
  /** Ocultar en estos formatos (p.ej. align/color no existen en markdown). */
  hiddenFor?: NoteFormat[];
  /** Solo visible cuando el cursor está dentro de una tabla. */
  tableContext?: boolean;
}

const BUTTONS: ToolbarButton[] = [
  // Text formatting
  { icon: Bold, label: 'Bold', action: e => e.chain().focus().toggleBold().run(), isActive: e => e.isActive('bold') },
  { icon: Italic, label: 'Italic', action: e => e.chain().focus().toggleItalic().run(), isActive: e => e.isActive('italic') },
  { icon: Underline, label: 'Underline', action: e => e.chain().focus().toggleUnderline().run(), isActive: e => e.isActive('underline') },
  { icon: Strikethrough, label: 'Strikethrough', action: e => e.chain().focus().toggleStrike().run(), isActive: e => e.isActive('strike') },
  { icon: Highlighter, label: 'Highlight', action: e => e.chain().focus().toggleHighlight().run(), isActive: e => e.isActive('highlight') },
  { icon: SubIcon, label: 'Subscript', action: e => e.chain().focus().toggleSubscript().run(), isActive: e => e.isActive('subscript') },
  { icon: SupIcon, label: 'Superscript', action: e => e.chain().focus().toggleSuperscript().run(), isActive: e => e.isActive('superscript') },
  { icon: Bold, label: '', action: () => {}, separator: true },
  // Headings
  { icon: Heading1, label: 'Heading 1', action: e => e.chain().focus().toggleHeading({ level: 1 }).run(), isActive: e => e.isActive('heading', { level: 1 }) },
  { icon: Heading2, label: 'Heading 2', action: e => e.chain().focus().toggleHeading({ level: 2 }).run(), isActive: e => e.isActive('heading', { level: 2 }) },
  { icon: Heading3, label: 'Heading 3', action: e => e.chain().focus().toggleHeading({ level: 3 }).run(), isActive: e => e.isActive('heading', { level: 3 }) },
  { icon: Heading4, label: 'Heading 4', action: e => e.chain().focus().toggleHeading({ level: 4 }).run(), isActive: e => e.isActive('heading', { level: 4 }) },
  { icon: Bold, label: '', action: () => {}, separator: true },
  // Lists
  { icon: List, label: 'Bullet list', action: e => e.chain().focus().toggleBulletList().run(), isActive: e => e.isActive('bulletList') },
  { icon: ListOrdered, label: 'Ordered list', action: e => e.chain().focus().toggleOrderedList().run(), isActive: e => e.isActive('orderedList') },
  { icon: ListChecks, label: 'Task list', action: e => e.chain().focus().toggleTaskList().run(), isActive: e => e.isActive('taskList') },
  { icon: Bold, label: '', action: () => {}, separator: true },
  // Blocks
  { icon: Quote, label: 'Blockquote', action: e => e.chain().focus().toggleBlockquote().run(), isActive: e => e.isActive('blockquote') },
  { icon: Minus, label: 'Horizontal rule', action: e => e.chain().focus().setHorizontalRule().run() },
  { icon: Code2, label: 'Code block', action: e => e.chain().focus().toggleCodeBlock().run(), isActive: e => e.isActive('codeBlock') },
  {
    icon: ChevronsDownUp, label: 'Details (collapsible)', hiddenFor: ['markdown', 'plain'],
    action: e => e.chain().focus().setDetails().run(),
    isActive: e => e.isActive('details'),
  },
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
  {
    icon: ImageIcon, label: 'Image (URL)',
    action: e => {
      const url = window.prompt('URL de la imagen:');
      if (url) e.chain().focus().setImage({ src: url }).run();
    },
  },
  { icon: Table, label: 'Insert table', action: e => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  {
    icon: YoutubeIcon, label: 'YouTube', hiddenFor: ['markdown', 'plain'],
    action: e => {
      const url = window.prompt('URL de YouTube:');
      if (url) e.chain().focus().setYoutubeVideo({ src: url }).run();
    },
  },
  // Alignment (solo HTML — markdown no serializa alineación)
  { icon: Bold, label: '', action: () => {}, separator: true, hiddenFor: ['markdown', 'plain'] },
  { icon: AlignLeft, label: 'Align left', hiddenFor: ['markdown', 'plain'], action: e => e.chain().focus().toggleTextAlign('left').run(), isActive: e => e.isActive({ textAlign: 'left' }) },
  { icon: AlignCenter, label: 'Align center', hiddenFor: ['markdown', 'plain'], action: e => e.chain().focus().toggleTextAlign('center').run(), isActive: e => e.isActive({ textAlign: 'center' }) },
  { icon: AlignRight, label: 'Align right', hiddenFor: ['markdown', 'plain'], action: e => e.chain().focus().toggleTextAlign('right').run(), isActive: e => e.isActive({ textAlign: 'right' }) },
  {
    icon: Palette, label: 'Text color', hiddenFor: ['markdown', 'plain'],
    action: e => {
      // Paleta mínima rotativa: amber → azul → verde → rojo → reset.
      const colors = ['var(--amber)', '#3b82f6', '#22c55e', '#f43f5e'];
      const current = e.getAttributes('textStyle').color as string | undefined;
      const idx = current ? colors.indexOf(current) : -1;
      const next = colors[idx + 1];
      if (next) e.chain().focus().setColor(next).run();
      else e.chain().focus().unsetColor().run();
    },
    isActive: e => !!e.getAttributes('textStyle').color,
  },
  // Operaciones de tabla — solo con el cursor dentro de una tabla
  { icon: Bold, label: '', action: () => {}, separator: true, tableContext: true },
  { icon: Rows3, label: 'Add row below', tableContext: true, action: e => e.chain().focus().addRowAfter().run() },
  { icon: Columns3, label: 'Add column after', tableContext: true, action: e => e.chain().focus().addColumnAfter().run() },
  { icon: Trash2, label: 'Delete row', tableContext: true, action: e => e.chain().focus().deleteRow().run() },
  { icon: Trash2, label: 'Delete table', tableContext: true, action: e => e.chain().focus().deleteTable().run() },
];

export function NoteEditorToolbar({ editor, format = 'html', tocOpen, onToggleToc }: NoteEditorToolbarProps) {
  if (!editor) return null;
  const inTable = editor.isActive('table');

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
        if (btn.hiddenFor?.includes(format)) return null;
        if (btn.tableContext && !inTable) return null;
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
            key={`${btn.label}-${i}`}
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

      {/* TOC toggle al final */}
      {onToggleToc && (
        <button
          onClick={onToggleToc}
          title="Tabla de contenidos"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, marginLeft: 'auto',
            background: tocOpen ? 'var(--amber-dim)' : 'transparent',
            color: tocOpen ? 'var(--amber)' : 'var(--text-dim)',
            border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          }}
        >
          <ListTree size={15} />
        </button>
      )}
    </div>
  );
}
