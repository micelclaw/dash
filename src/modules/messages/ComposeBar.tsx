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
import { Link } from 'react-router';
import { Send, Settings2 } from 'lucide-react';
import { platformMeta } from '@/config/messaging-platforms';
import type { PlatformCapability } from '@/services/messages.service';

interface ComposeBarProps {
  platform: string;
  capability?: PlatformCapability;
  onSend: (content: string) => Promise<void>;
  sending: boolean;
}

const SEND_REASON_COPY: Record<string, string> = {
  not_configured: 'Configure this channel to send from here.',
  reauth_required: 'Re-authorize this channel to send.',
  plugin_not_installed: 'This channel needs its plugin installed.',
  gateway_unreachable: 'The gateway is unavailable right now.',
  unsupported: 'Sending is not available for this channel.',
};

export function ComposeBar({ platform, capability, onSend, sending }: ComposeBarProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const meta = platformMeta(platform);
  const canSend = capability?.can_send ?? false;

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

  // Not sendable: show why + a CTA to configure the channel (unless unsupported by design).
  if (!canSend) {
    const reason = capability?.send_reason ?? (capability ? 'not_configured' : undefined);
    const copy = reason ? SEND_REASON_COPY[reason] ?? SEND_REASON_COPY.unsupported : `Sending isn't available for ${meta.label} yet.`;
    const showCta = capability && reason !== 'unsupported';

    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '10px 16px',
          borderTop: '1px solid var(--border)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        <span>{copy}</span>
        {showCta && (
          <Link
            to={`/settings/observers?connect=${platform}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 10px',
              background: meta.color,
              color: '#fff',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.75rem', fontWeight: 600,
              textDecoration: 'none', flexShrink: 0,
            }}
          >
            <Settings2 size={13} /> Configure channel
          </Link>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`Send via ${meta.label}...`}
        aria-label={`Write a message via ${meta.label}`}
        rows={1}
        disabled={sending}
        style={{
          flex: 1, padding: '8px 12px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', color: 'var(--text)',
          fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
          outline: 'none', resize: 'none', lineHeight: 1.5, maxHeight: 120, boxSizing: 'border-box',
        }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || sending}
        aria-label="Send message"
        style={{
          padding: '8px 12px',
          background: text.trim() ? meta.color : 'var(--surface)',
          border: 'none', borderRadius: 'var(--radius-md)',
          color: text.trim() ? '#fff' : 'var(--text-muted)',
          cursor: text.trim() && !sending ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 600,
          opacity: sending ? 0.6 : 1, transition: 'all var(--transition-fast)', flexShrink: 0,
        }}
      >
        <Send size={14} />
      </button>
    </div>
  );
}
