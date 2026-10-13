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

import { FileText, Download, Check, CheckCheck } from 'lucide-react';
import { platformMeta } from '@/config/messaging-platforms';
import { api } from '@/services/api';
import type { Message, MessageAttachment } from '@/services/messages.service';

interface MessageBubbleProps {
  message: Message;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const URL_RE = /https?:\/\/[^\s<>()]+/g;

/**
 * Texto del mensaje con los enlaces CLIQUEABLES: la URL se pinta en gris y más
 * pequeña (una URL de Google de 300 chars no debe dominar la burbuja), truncada
 * visualmente pero con el href completo.
 */
function LinkifiedText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(URL_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(text.slice(last, idx));
    const url = m[0];
    parts.push(
      <a
        key={`u${i++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
        style={{
          color: 'var(--text-muted)',
          fontSize: '0.85em',
          textDecoration: 'underline',
          textDecorationColor: 'var(--border)',
          wordBreak: 'break-all',
        }}
      >
        {url.length > 80 ? `${url.slice(0, 77)}…` : url}
      </a>,
    );
    last = idx + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function Attachment({ att, color }: { att: MessageAttachment; color: string }) {
  // Los bytes se sirven por el proxy de Core (?token= para <img>/<a>, que no
  // mandan el header Bearer). Nunca se expone el mxc interno del homeserver.
  const src = api.mediaUrl(att.url);
  const thumb = api.mediaUrl(att.thumbnail_url ?? att.url);

  if (att.kind === 'image') {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 4 }}>
        <img
          src={thumb}
          alt={att.name ?? 'imagen'}
          loading="lazy"
          style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, display: 'block' }}
        />
      </a>
    );
  }
  if (att.kind === 'video') {
    return (
      <video
        src={src}
        controls
        preload="metadata"
        poster={att.thumbnail_url ? thumb : undefined}
        style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, marginTop: 4, display: 'block' }}
      />
    );
  }
  if (att.kind === 'audio') {
    return <audio src={src} controls preload="none" style={{ marginTop: 4, maxWidth: '100%' }} />;
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
        padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 8, textDecoration: 'none', color: 'var(--text)',
      }}
    >
      <FileText size={16} style={{ color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {att.name ?? att.mime_type ?? 'fichero'}
      </span>
      <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{formatSize(att.size_bytes)}</span>
      <Download size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </a>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isSent = message.direction === 'sent';
  const color = platformMeta(message.platform).color;
  const attachments = message.attachments ?? [];

  return (
    <div
      role="listitem"
      style={{ display: 'flex', justifyContent: isSent ? 'flex-end' : 'flex-start', padding: '2px 16px' }}
    >
      <div
        style={{
          maxWidth: '70%',
          padding: '8px 12px',
          borderRadius: isSent ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          background: isSent ? `${color}22` : 'var(--surface)',
          border: `1px solid ${isSent ? `${color}33` : 'var(--border)'}`,
          opacity: message.pending ? 0.6 : 1,
        }}
      >
        {!isSent && message.sender_name && (
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color, marginBottom: 2 }}>
            {message.sender_name}
          </div>
        )}
        {message.content && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            <LinkifiedText text={message.content} />
          </div>
        )}
        {attachments.map((att) => (
          <Attachment key={att.id} att={att} color={color} />
        ))}
        {!message.content && attachments.length === 0 && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>(no content)</div>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          justifyContent: isSent ? 'flex-end' : 'flex-start',
          fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 4,
        }}>
          <span>{message.pending ? 'sending…' : formatTime(new Date(message.sent_at))}</span>
          {/* Doble check: gris = enviado, azul = leído (solo salientes). En grupos
              el backend no marca read_at → se queda en gris, que es lo honesto. */}
          {isSent && !message.pending && (
            message.read_at
              ? <CheckCheck size={13} style={{ color: '#3b82f6', flexShrink: 0 }} aria-label="Leído" />
              : <Check size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-label="Enviado" />
          )}
        </div>
      </div>
    </div>
  );
}
