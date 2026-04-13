/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// Dark theme with amber accents matching Micelclaw Dash design system
export const clawEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--surface)',
    color: 'var(--text)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
  },
  '.cm-content': {
    caretColor: 'var(--amber)',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--amber)',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(212, 160, 23, 0.15) !important',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(212, 160, 23, 0.04)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--card)',
    color: 'var(--text-muted)',
    borderRight: '1px solid var(--border)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(212, 160, 23, 0.08)',
    color: 'var(--text-dim)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': {
      backgroundColor: 'rgba(212, 160, 23, 0.12)',
    },
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(212, 160, 23, 0.25)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(212, 160, 23, 0.4)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
}, { dark: true });

// Syntax highlighting colors
export const clawHighlightStyle = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.keyword, color: '#c678dd' },
  { tag: tags.operator, color: '#56b6c2' },
  { tag: tags.special(tags.variableName), color: '#e06c75' },
  { tag: tags.typeName, color: '#e5c07b' },
  { tag: tags.atom, color: '#d19a66' },
  { tag: tags.number, color: '#d19a66' },
  { tag: tags.definition(tags.variableName), color: '#e06c75' },
  { tag: tags.string, color: '#98c379' },
  { tag: tags.special(tags.string), color: '#98c379' },
  { tag: tags.comment, color: '#5c6370', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#e06c75' },
  { tag: tags.tagName, color: '#e06c75' },
  { tag: tags.bracket, color: '#abb2bf' },
  { tag: tags.meta, color: '#61afef' },
  { tag: tags.attributeName, color: '#d19a66' },
  { tag: tags.attributeValue, color: '#98c379' },
  { tag: tags.propertyName, color: '#61afef' },
  { tag: tags.bool, color: '#d19a66' },
  { tag: tags.null, color: '#d19a66' },
  { tag: tags.function(tags.variableName), color: '#61afef' },
  { tag: tags.url, color: '#56b6c2', textDecoration: 'underline' },
  { tag: tags.heading, color: 'var(--amber)', fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.link, color: '#56b6c2' },
]));
