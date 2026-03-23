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

import { useRef, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { ComposeBar } from './ComposeBar';
import { PLATFORMS } from './types';
import type { Message } from './types';

interface MessageThreadProps {
  channelName: string | null;
  platform: string;
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSend: (content: string) => Promise<void>;
  sending: boolean;
}

function formatDate(date: Date): string {
  const today = new Date();
  const d = new Date(date);
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function MessageThread({
  channelName, platform, messages, loading, hasMore,
  onLoadMore, onSend, sending,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const platformConfig = PLATFORMS[platform];

  // Group messages by date
  const grouped = useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';
    for (const msg of messages) {
      const d = new Date(msg.sent_at).toDateString();
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, messages: [msg] });
      } else {
        groups[groups.length - 1]!.messages.push(msg);
      }
    }
    return groups;
  }, [messages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const el = scrollRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  // Initial scroll to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el && messages.length > 0) {
      el.scrollTop = el.scrollHeight;
    }
  }, [channelName]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: platformConfig?.color ?? 'var(--amber)',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
          {channelName ?? 'Unknown'}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          {platformConfig?.label ?? platform}
        </span>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {loading && messages.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Loader2 size={20} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <>
            {hasMore && (
              <div style={{ textAlign: 'center', padding: 8 }}>
                <button
                  onClick={onLoadMore}
                  style={{
                    padding: '4px 12px', fontSize: '0.6875rem',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  Load older messages
                </button>
              </div>
            )}
            {grouped.map(group => (
              <div key={group.date}>
                {/* Date separator */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px 4px',
                }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{
                    fontSize: '0.625rem', color: 'var(--text-muted)',
                    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {formatDate(new Date(group.date))}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                {group.messages.map(msg => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </div>
            ))}
            {messages.length === 0 && !loading && (
              <div style={{
                padding: 32, textAlign: 'center',
                color: 'var(--text-muted)', fontSize: '0.8125rem',
              }}>
                No messages in this channel
              </div>
            )}
          </>
        )}
      </div>

      {/* Compose */}
      <ComposeBar platform={platform} onSend={onSend} sending={sending} />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
