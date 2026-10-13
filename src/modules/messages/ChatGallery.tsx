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

import { useEffect, useMemo, useState } from 'react';
import { Loader2, FileText, Download, Link as LinkIcon } from 'lucide-react';
import { api } from '@/services/api';
import { listChannelMedia, type Message } from '@/services/messages.service';

type Kind = 'media' | 'files' | 'voice' | 'links';
const TABS: { key: Kind; label: string }[] = [
  { key: 'media', label: 'Media' },
  { key: 'files', label: 'Files' },
  { key: 'voice', label: 'Voice' },
  { key: 'links', label: 'Links' },
];

const URL_RE = /https?:\/\/[^\s<>()]+/g;

export function ChatGallery({ channelId }: { channelId: string }) {
  const [tab, setTab] = useState<Kind>('media');
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listChannelMedia({ channel_id: channelId, kind: tab, limit: 100 })
      .then((m) => { if (!cancelled) setMessages(m); })
      .catch(() => { if (!cancelled) setMessages([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [channelId, tab]);

  const links = useMemo(() => {
    if (tab !== 'links') return [];
    const out: { url: string; from: string }[] = [];
    for (const m of messages) {
      const found = (m.content ?? '').match(URL_RE) ?? [];
      for (const url of found) out.push({ url, from: m.sender_name ?? '' });
    }
    return out;
  }, [messages, tab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '4px 12px', fontSize: '0.75rem', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t.key ? 'var(--amber)' : 'var(--surface)',
              color: tab === t.key ? '#000' : 'var(--text-dim)',
              fontFamily: 'var(--font-sans)', fontWeight: 500,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : tab === 'links' ? (
          links.length === 0 ? <Empty label="No links" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {links.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                  style={rowStyle}>
                  <LinkIcon size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{l.url}</span>
                </a>
              ))}
            </div>
          )
        ) : tab === 'media' ? (
          <MediaGrid messages={messages} />
        ) : tab === 'voice' ? (
          <VoiceList messages={messages} />
        ) : (
          <FileList messages={messages} />
        )}
      </div>
    </div>
  );
}

function attsOf(m: Message) { return m.attachments ?? []; }

function MediaGrid({ messages }: { messages: Message[] }) {
  const items = messages.flatMap(attsOf).filter((a) => a.kind === 'image' || a.kind === 'video');
  if (items.length === 0) return <Empty label="No media" />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
      {items.map((a) => (
        <a key={a.id} href={api.mediaUrl(a.url)} target="_blank" rel="noopener noreferrer"
          style={{ aspectRatio: '1', overflow: 'hidden', borderRadius: 6, background: 'var(--surface)' }}>
          {a.kind === 'video' && !a.thumbnail_url ? (
            <video src={api.mediaUrl(a.url)} aria-label={a.name ?? 'Vídeo'} muted playsInline preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <img src={api.mediaUrl(a.thumbnail_url ?? a.url)} alt={a.name ?? ''} loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
        </a>
      ))}
    </div>
  );
}

function VoiceList({ messages }: { messages: Message[] }) {
  const items = messages.flatMap(attsOf).filter((a) => a.kind === 'audio');
  if (items.length === 0) return <Empty label="No voice messages" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((a) => (
        <audio key={a.id} src={api.mediaUrl(a.url)} controls preload="none" style={{ width: '100%' }} />
      ))}
    </div>
  );
}

function FileList({ messages }: { messages: Message[] }) {
  const items = messages.flatMap(attsOf).filter((a) => a.kind === 'file');
  if (items.length === 0) return <Empty label="No files" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((a) => (
        <a key={a.id} href={api.mediaUrl(a.url)} target="_blank" rel="noopener noreferrer" style={rowStyle}>
          <FileText size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
            {a.name ?? a.mime_type ?? 'file'}
          </span>
          <Download size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </a>
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{label}</div>;
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
  textDecoration: 'none', color: 'var(--text)',
};
