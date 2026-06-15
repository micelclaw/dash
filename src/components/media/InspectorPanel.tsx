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

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface InspectorPanelProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Chrome for the right-side inspector slot of MediaShell: header with title
 * + close button, scrollable body.
 */
export function InspectorPanel({ title, onClose, children }: InspectorPanelProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        <button
          onClick={onClose}
          title="Close"
          style={{
            display: 'flex',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>{children}</div>
    </div>
  );
}
