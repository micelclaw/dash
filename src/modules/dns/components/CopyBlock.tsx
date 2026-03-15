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

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyBlockProps {
  code: string;
  label?: string;
}

export function CopyBlock({ code, label }: CopyBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ position: 'relative' }}>
      {label && (
        <div style={{
          fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)',
          marginBottom: 4,
        }}>
          {label}
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', overflow: 'hidden',
      }}>
        <code style={{
          flex: 1, padding: '10px 14px',
          fontSize: '0.8125rem', fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          lineHeight: 1.5,
        }}>
          {code}
        </code>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, flexShrink: 0,
            background: 'none', border: 'none', borderLeft: '1px solid var(--border)',
            cursor: 'pointer', color: copied ? '#22c55e' : 'var(--text-muted)',
            transition: 'color 0.15s',
          }}
          title="Copiar"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}
