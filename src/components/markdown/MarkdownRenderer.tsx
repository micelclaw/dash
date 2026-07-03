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

// ─── Markdown compartido, cargado en diferido ───────────────────────
//
// Envuelve ReactMarkdown + remark-gfm + rehype-highlight SIN importarlos
// estáticamente: este fichero es ligero de importar desde el Shell
// (ChatMessage) y los vendors de markdown (react-markdown, highlight.js…)
// viajan en su propio chunk async (reforzado por manualChunks 'markdown'
// en vite.config.ts). El fallback de Suspense muestra el texto plano, de
// modo que los mensajes en streaming no parpadean en blanco mientras se
// descarga el chunk la primera vez.

import { lazy, Suspense } from 'react';
import type { Components } from 'react-markdown';

export interface MarkdownRendererProps {
  content: string;
  /** Overrides de render por elemento (prop `components` de react-markdown). */
  components?: Components;
  /** Aplica rehype-highlight (clases hljs) a los bloques de código. */
  highlight?: boolean;
}

const LazyMarkdownImpl = lazy(async () => {
  const [{ default: ReactMarkdown }, { default: remarkGfm }, { default: rehypeHighlight }] = await Promise.all([
    import('react-markdown'),
    import('remark-gfm'),
    import('rehype-highlight'),
  ]);

  function MarkdownImpl({ content, components, highlight = true }: MarkdownRendererProps) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={highlight ? [rehypeHighlight] : []}
        components={components}
      >
        {content}
      </ReactMarkdown>
    );
  }

  return { default: MarkdownImpl };
});

export default function MarkdownRenderer({ content, components, highlight = true }: MarkdownRendererProps) {
  return (
    <Suspense fallback={<div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</div>}>
      <LazyMarkdownImpl content={content} components={components} highlight={highlight} />
    </Suspense>
  );
}
