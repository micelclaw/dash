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

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { PLATFORMS } from './types';

interface ComposeBarProps {
  platform: string;
  onSend: (content: string) => Promise<void>;
  sending: boolean;
}

export function ComposeBar({ platform, onSend, sending }: ComposeBarProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = PLATFORMS[platform]?.canSend ?? false;
  const platformLabel = PLATFORMS[platform]?.label ?? platform;
  const platformColor = PLATFORMS[platform]?.color ?? 'var(--amber)';

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, [text]);

  async function handleSend() {
    const content = text.trim();
    if (!content || sending) return;
    setText('');
    await onSend(content);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!canSend) {
    return (
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        Sending not available for {platformLabel} yet
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 8,
      padding: '8px 12px',
      borderTop: '1px solid var(--border)',
    }}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`Send via ${platformLabel}...`}
        rows={1}
        disabled={sending}
        style={{
          flex: 1,
          padding: '8px 12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.8125rem',
          outline: 'none',
          resize: 'none',
          lineHeight: 1.5,
          maxHeight: 120,
          boxSizing: 'border-box',
        }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || sending}
        style={{
          padding: '8px 12px',
          background: text.trim() ? platformColor : 'var(--surface)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: text.trim() ? '#fff' : 'var(--text-muted)',
          cursor: text.trim() && !sending ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-sans)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          opacity: sending ? 0.6 : 1,
          transition: 'all var(--transition-fast)',
          flexShrink: 0,
        }}
      >
        <Send size={14} />
      </button>
    </div>
  );
}
