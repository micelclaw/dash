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

import { useEffect, useState } from 'react';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  thinking: string;
  /** True while the parent message is still streaming this thinking. */
  isStreaming?: boolean;
}

/**
 * Collapsible chip that surfaces the model's reasoning under an assistant
 * message. Auto-expands while the stream is live so the user can watch
 * the thinking arrive; collapses to a discrete chip when streaming ends.
 */
export function ReasoningChip({ thinking, isStreaming }: Props) {
  const [open, setOpen] = useState(!!isStreaming);

  useEffect(() => {
    if (isStreaming) setOpen(true);
    else setOpen(false);
  }, [isStreaming]);

  if (!thinking?.trim()) return null;

  return (
    <div style={{ marginTop: 6, marginBottom: 4 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          fontSize: '0.6875rem',
          color: 'var(--text-dim)',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <Brain size={11} />
        <span>Razonamiento</span>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      {open && (
        <div
          style={{
            marginTop: 4,
            padding: '6px 10px',
            fontSize: '0.75rem',
            fontStyle: 'italic',
            lineHeight: 1.5,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono, monospace)',
            borderLeft: '2px solid var(--border)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: 'color-mix(in srgb, var(--text-muted) 4%, transparent)',
            borderRadius: '0 4px 4px 0',
          }}
        >
          {thinking}
        </div>
      )}
    </div>
  );
}
