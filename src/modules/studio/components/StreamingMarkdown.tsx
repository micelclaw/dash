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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface Props {
  text: string;
  /** When false, render immediately without debouncing. */
  streaming: boolean;
}

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
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {renderedText}
      </ReactMarkdown>
    </div>
  );
}
