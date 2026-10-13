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

import { useRef, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Loader2, AlertCircle, SlidersHorizontal, Images, X } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { ComposeBar } from './ComposeBar';
import { ChatGallery } from './ChatGallery';
import { ChannelSyncStatus } from './ChannelSyncStatus';
import { useInfiniteScroll } from './hooks/use-infinite-scroll';
import { platformMeta } from '@/config/messaging-platforms';
import { PlatformIcon } from '@/components/shared/platform-icons';
import type { Message, PlatformCapability } from '@/services/messages.service';

interface MessageThreadProps {
  channelId: string;
  channelName: string | null;
  platform: string;
  capability?: PlatformCapability;
  messages: Message[];
  loading: boolean;
  loadingOlder: boolean;
  hasMore: boolean;
  error: string | null;
  onLoadOlder: () => void;
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
  channelId, channelName, platform, capability, messages, loading, loadingOlder,
  hasMore, error, onLoadOlder, onSend, sending,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const lastMsgIdRef = useRef<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const meta = platformMeta(platform);

  // Cerrar la galería al cambiar de chat.
  useEffect(() => { setGalleryOpen(false); }, [channelId]);

  useInfiniteScroll({
    scrollRef,
    sentinelRef,
    hasMore,
    loading: loadingOlder,
    onLoadOlder,
    itemCount: messages.length,
  });

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

  // Auto-scroll to bottom when a NEW newest message arrives (not on prepend).
  useEffect(() => {
    const lastId = messages.length > 0 ? messages[messages.length - 1]!.id : null;
    if (lastId && lastId !== lastMsgIdRef.current) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    lastMsgIdRef.current = lastId;
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && messages.length > 0) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <PlatformIcon platform={platform} size={22} />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{channelName ?? 'Unknown'}</span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{meta.label}</span>
        <button
          onClick={() => setGalleryOpen((v) => !v)}
          title={galleryOpen ? 'Volver al chat' : 'Media, ficheros, enlaces y voz de este chat'}
          aria-label="Galería del chat"
          aria-pressed={galleryOpen}
          style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: '0.6875rem',
            color: galleryOpen ? '#000' : 'var(--text-muted)',
            background: galleryOpen ? 'var(--amber)' : 'transparent',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          }}
        >
          {galleryOpen ? <X size={12} /> : <Images size={12} />} {galleryOpen ? 'Chat' : 'Gallery'}
        </button>
        <Link
          to={`/settings/observers?configure=${platform}`}
          title="Manage which chats sync for this channel"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: '0.6875rem', color: 'var(--text-muted)', textDecoration: 'none',
            padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          }}
        >
          <SlidersHorizontal size={12} /> Manage chats
        </Link>
      </div>

      <ChannelSyncStatus capability={capability} />

      {galleryOpen ? (
        <ChatGallery channelId={channelId} />
      ) : (
      <>
      {/* Messages area */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${channelName ?? 'channel'} on ${meta.label}`}
        style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}
      >
        {loading && messages.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : error && messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 32, color: 'var(--text-muted)' }}>
            <AlertCircle size={20} />
            <span style={{ fontSize: '0.8125rem' }}>Couldn't load messages.</span>
          </div>
        ) : (
          <>
            {/* Top sentinel for infinite scroll + accessible fallback button */}
            <div ref={sentinelRef} style={{ height: 1 }} />
            {hasMore && (
              <div style={{ textAlign: 'center', padding: 8 }}>
                {loadingOlder ? (
                  <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                ) : (
                  <button
                    onClick={onLoadOlder}
                    style={{
                      padding: '4px 12px', fontSize: '0.6875rem',
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Load older messages
                  </button>
                )}
              </div>
            )}
            <div role="list">
              {grouped.map((group) => (
                <div key={group.date}>
                  <div role="separator" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px 4px' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {formatDate(new Date(group.date))}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                  {group.messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                </div>
              ))}
            </div>
            {messages.length === 0 && !loading && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                No messages in this channel
              </div>
            )}
          </>
        )}
      </div>

      <ComposeBar platform={platform} capability={capability} onSend={onSend} sending={sending} />
      </>
      )}
    </div>
  );
}
