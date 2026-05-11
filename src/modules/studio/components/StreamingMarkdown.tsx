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

// ─── StreamingMarkdown — debounced markdown renderer ────────────────
//
// ReactMarkdown re-parses on every prop change which is fine for a
// final render but wasteful while tokens are streaming in. We debounce
// to ~50ms while streaming, then render immediately when the stream
// completes (status flips out of 'streaming').

import { useEffect, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  text: string;
  /** When false, render immediately without debouncing. */
  streaming: boolean;
}

// Code blocks need a strict monospace + tight line-height + ligature-free
// font-feature-settings so ASCII wireframes (┌─┐│├┤└┘) render as a
// continuous grid. The default doc line-height (1.65) leaves vertical
// gaps between │ characters that break the box visually.
const PRE_STYLE: React.CSSProperties = {
  margin: '12px 0',
  padding: '12px 14px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  overflowX: 'auto',
  fontFamily: 'ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace',
  fontSize: '0.8125rem',
  lineHeight: 1.2,
  color: 'var(--text)',
  whiteSpace: 'pre',
  fontVariantLigatures: 'none',
  fontFeatureSettings: 'normal',
  tabSize: 2,
  textAlign: 'left',
};

// Inline-code (single backticks) — small chip style.
const INLINE_CODE_STYLE: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace',
  fontSize: '0.85em',
  background: 'var(--surface)',
  padding: '0 4px',
  borderRadius: 3,
  fontVariantLigatures: 'none',
  fontFeatureSettings: 'normal',
};

/**
 * Close a half-open ASCII wireframe by adding the missing right edge.
 *
 * The system prompt asks the model to emit wireframes WITHOUT a right
 * border (impossible to align reliably token-by-token). At render time
 * we synthesise the right edge from the max line width: top borders
 * get a corner `┐`, junctions `┤`, bottoms `┘`, and `│`-prefixed lines
 * get padding + `│`. The result looks like a fully-closed box without
 * the model needing to count characters — and since lengths are
 * computed in code points, box-drawing chars (single-cell) align
 * perfectly.
 *
 * Returns the input unchanged when:
 *  - The block doesn't start with `┌` (not a wireframe).
 *  - The block has fewer than 2 lines.
 *
 * Lines that don't follow the `┌|├|└|│` prefix convention are left as-is
 * so a malformed wireframe degrades gracefully instead of getting
 * corrupted.
 */
function closeHalfOpenWireframe(text: string): string {
  const trimmed = text.replace(/[\s\n]+$/, '');
  const lines = trimmed.split('\n');
  if (lines.length < 2) return text;
  if (!lines[0]?.startsWith('┌')) return text;

  // Code-point length: every box-drawing char is BMP and counts as 1.
  const lengths = lines.map((l) => [...l].length);
  const maxLen = Math.max(...lengths);

  const closed = lines.map((line, i) => {
    const len = lengths[i] ?? 0;
    const fill = Math.max(0, maxLen - len);
    if (line.startsWith('┌')) return line + '─'.repeat(fill) + '┐';
    if (line.startsWith('├')) return line + '─'.repeat(fill) + '┤';
    if (line.startsWith('└')) return line + '─'.repeat(fill) + '┘';
    if (line.startsWith('│')) return line + ' '.repeat(fill) + '│';
    return line;
  }).join('\n');

  // Preserve any trailing newline characters from the original so the
  // pre block's bottom padding stays consistent.
  const tailMatch = text.match(/[\s\n]+$/);
  return closed + (tailMatch ? tailMatch[0] : '');
}

const COMPONENTS: Components = {
  pre: ({ children, ...rest }) => (
    <pre style={PRE_STYLE} {...rest}>{children}</pre>
  ),
  code: ({ children, className, ...rest }) => {
    const isBlock = typeof className === 'string' && className.includes('language-');
    if (isBlock) {
      const isText = className === 'language-text' || className?.includes('language-text');
      // For ASCII wireframes (`language-text`), close the right border
      // we deliberately omit in the prompt so model output stays grid-
      // perfect. Only string children get transformed; if some upstream
      // plugin already produced React elements, fall through unchanged.
      if (isText && typeof children === 'string') {
        return <code className={className} {...rest}>{closeHalfOpenWireframe(children)}</code>;
      }
      return <code className={className} {...rest}>{children}</code>;
    }
    return <code style={INLINE_CODE_STYLE} {...rest}>{children}</code>;
  },
};

export function StreamingMarkdown({ text, streaming }: Props) {
  const [renderedText, setRenderedText] = useState(text);

  useEffect(() => {
    if (!streaming) {
      setRenderedText(text);
      return;
    }
    const t = setTimeout(() => setRenderedText(text), 50);
    return () => clearTimeout(t);
  }, [text, streaming]);

  return (
    <div className="studio-markdown" style={{ fontSize: '0.875rem', lineHeight: 1.65, color: 'var(--text)' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={COMPONENTS}
      >
        {renderedText}
      </ReactMarkdown>
    </div>
  );
}
