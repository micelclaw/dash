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

import { useMemo, useState } from 'react';
import {
  StickyNote, Calendar, Mail, Users, BookOpen,
  FolderOpen, ImageIcon, MessageSquare, MessagesSquare,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { HeatBadge } from '@/components/shared/HeatBadge';
import { useSearchStore } from '@/stores/search.store';
import { ProvenanceBreakdown } from './ProvenanceBreakdown';
import { getPreviewUrl } from '@/lib/file-utils';
import type { SearchResult } from '@/types/search';
import type { LucideIcon } from 'lucide-react';

const DOMAIN_META: Record<string, { icon: LucideIcon; color: string; route: string; label: string }> = {
  note:         { icon: StickyNote,    color: 'var(--mod-notes)',    route: '/notes',    label: 'Note' },
  event:        { icon: Calendar,      color: 'var(--mod-calendar)', route: '/calendar', label: 'Event' },
  email:        { icon: Mail,          color: 'var(--mod-mail)',     route: '/mail',     label: 'Email' },
  contact:      { icon: Users,         color: 'var(--mod-contacts)', route: '/contacts', label: 'Contact' },
  diary:        { icon: BookOpen,      color: 'var(--mod-diary)',    route: '/diary',    label: 'Diary' },
  file:         { icon: FolderOpen,    color: 'var(--mod-drive)',    route: '/drive',    label: 'File' },
  photo:        { icon: ImageIcon,    color: 'var(--mod-photos)',   route: '/photos',   label: 'Photo' },
  conversation: { icon: MessageSquare, color: 'var(--mod-chat)',     route: '/chat',     label: 'Chat' },
  message:      { icon: MessagesSquare, color: 'var(--mod-observers)', route: '/settings/observers', label: 'Message' },
};

/** Build the deep-link URL for a search result */
function buildDeepLink(r: SearchResult, meta: typeof DOMAIN_META[string] | undefined): string | null {
  const rec = r.record as Record<string, unknown> | null;

  // VFS files → file explorer at parent folder
  if (rec?.source === 'vfs' && rec?.filepath) {
    const fp = rec.filepath as string;
    const parentPath = fp.substring(0, fp.lastIndexOf('/') + 1) || '/';
    return `/explorer?path=${encodeURIComponent(parentPath)}`;
  }

  // Photos → photos page
  if (r.domain === 'photo') {
    return `/photos?id=${r.record_id}`;
  }

  // Regular files → drive at parent folder
  if (r.domain === 'file' && rec) {
    const folder = (rec.parent_folder as string) || '/';
    return `/drive?path=${encodeURIComponent(folder)}`;
  }

  // Events → calendar at event date + open detail
  if (r.domain === 'event' && rec) {
    const dateStr = (rec.start_at as string) || (rec.start_date as string) || (rec.starts_at as string) || (rec.created_at as string);
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const iso = d.toISOString().split('T')[0]; // YYYY-MM-DD
        return `/calendar?id=${r.record_id}&date=${iso}&view=day`;
      }
    }
    return `/calendar?id=${r.record_id}`;
  }

  // Diary → diary at entry date
  if (r.domain === 'diary' && rec) {
    const dateStr = (rec.entry_date as string) || (rec.date as string) || (rec.created_at as string);
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const iso = d.toISOString().split('T')[0];
        return `/diary?date=${iso}`;
      }
    }
  }

  // Default: module?id=record_id
  if (meta?.route) return `${meta.route}?id=${r.record_id}`;
  return null;
}

function getTitle(r: SearchResult): string {
  const rec = r.record as Record<string, unknown> | null;
  if (!rec) return r.snippet.slice(0, 60);

  // Photo results: prefer AI description over filename
  if (r.domain === 'photo') {
    const meta = rec.metadata as Record<string, unknown> | undefined;
    const desc = meta?.ai_description as string;
    return desc ? desc.slice(0, 80) : (rec.filename as string) || r.snippet.slice(0, 60);
  }

  // Message results: "Platform #channel: content_preview"
  if (r.domain === 'message') {
    const platform = (rec.platform as string) ?? '';
    const channel = (rec.channel_name as string) ?? '';
    const content = (rec.content as string) ?? r.snippet;
    const prefix = [platform, channel ? `#${channel}` : ''].filter(Boolean).join(' ');
    const preview = content.slice(0, 60);
    return prefix ? `${prefix}: ${preview}` : preview;
  }

  const title = (
    (rec.title as string) ||
    (rec.subject as string) ||
    (rec.display_name as string) ||
    (rec.filename as string) ||
    r.snippet.slice(0, 60)
  );

  // For VFS files, show parent folder path for context
  if (rec.source === 'vfs' && rec.parent_folder) {
    const folder = (rec.parent_folder as string).replace(/^\/vfs/, '');
    return `${title}  ·  ${folder}`;
  }

  return title;
}

function PhotoThumb({ recordId }: { recordId: string }) {
  const [err, setErr] = useState(false);
  if (err) return <ImageIcon size={16} style={{ color: 'var(--mod-photos)', flexShrink: 0 }} />;
  return (
    <img
      src={getPreviewUrl(recordId, 64)}
      alt=""
      onError={() => setErr(true)}
      style={{
        width: 32, height: 32, objectFit: 'cover',
        borderRadius: 'var(--radius-sm)', flexShrink: 0,
      }}
    />
  );
}

export function SearchResultsList() {
  const navigate = useNavigate();
  const rawResults = useSearchStore(s => s.results);
  const sortBy = useSearchStore(s => s.sortBy);
  const selectedResult = useSearchStore(s => s.selectedResult);

  const results = useMemo(() => {
    if (sortBy === 'relevance' || !rawResults.length) return rawResults;

    // Sort by last modified date
    if (sortBy === 'recent') {
      return [...rawResults].sort((a, b) => {
        const recA = a.record as Record<string, unknown> | null;
        const recB = b.record as Record<string, unknown> | null;
        const dateA = (recA?.updated_at as string) || (recA?.created_at as string) || '';
        const dateB = (recB?.updated_at as string) || (recB?.created_at as string) || '';
        return dateB.localeCompare(dateA);
      });
    }

    // Sort by signal score
    const keyMap: Record<string, string> = {
      fulltext: 'fulltext_score',
      heat: 'heat_score',
      semantic: 'vector_score',
      graph: 'graph_score',
    };
    const scoreKey = keyMap[sortBy];
    if (!scoreKey) return rawResults;
    return [...rawResults].sort((a, b) =>
      ((b.provenance as any)?.[scoreKey] ?? 0) - ((a.provenance as any)?.[scoreKey] ?? 0)
    );
  }, [rawResults, sortBy]);
  const setSelectedResult = useSearchStore(s => s.setSelectedResult);
  const loading = useSearchStore(s => s.loading);
  const total = useSearchStore(s => s.total);
  const queryTimeMs = useSearchStore(s => s.queryTimeMs);
  const searchType = useSearchStore(s => s.searchType);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            height: 48, background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
            animation: 'pulse 1.5s ease infinite',
          }} />
        ))}
      </div>
    );
  }

  if (results.length === 0) return null;

  return (
    <div>
      {/* Meta row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.6875rem', color: 'var(--text-muted)',
        fontFamily: 'var(--font-sans)', padding: '4px 0 8px',
      }}>
        <span>{total} result{total !== 1 ? 's' : ''}</span>
        {queryTimeMs != null && <span>in {queryTimeMs}ms</span>}
        {searchType && <span style={{ fontFamily: 'var(--font-mono)' }}>({searchType})</span>}
      </div>

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {results.map((r, i) => {
          const meta = DOMAIN_META[r.domain];
          const Icon = meta?.icon ?? StickyNote;
          const isSelected = selectedResult?.record_id === r.record_id && selectedResult?.domain === r.domain;
          const heatScore = r.provenance?.heat_score ?? (r.record as Record<string, unknown> | null)?.heat_score as number ?? 0;

          return (
            <div key={`${r.domain}-${r.record_id}-${i}`}>
              <button
                onClick={() => setSelectedResult(isSelected ? null : r)}
                onDoubleClick={() => {
                  const link = buildDeepLink(r, meta);
                  if (link) navigate(link);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 10px',
                  background: isSelected ? 'var(--surface-hover)' : 'transparent',
                  border: isSelected ? '1px solid var(--amber)' : '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                {r.domain === 'photo'
                  ? <PhotoThumb recordId={r.record_id} />
                  : <Icon size={16} style={{ color: meta?.color ?? 'var(--text-muted)', flexShrink: 0 }} />
                }
                <span style={{
                  flex: 1, fontSize: '0.8125rem', color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {getTitle(r)}
                </span>
                <HeatBadge score={heatScore} />
                <span style={{
                  fontSize: '0.625rem', fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)', flexShrink: 0,
                }}>
                  {r.score.toFixed(4)}
                </span>
              </button>

              {/* Provenance breakdown when selected */}
              {isSelected && (
                <div style={{
                  padding: '8px 10px 12px 34px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {/* Photo preview + snippet side by side */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                    {r.domain === 'photo' && (
                      <img
                        src={getPreviewUrl(r.record_id, 160)}
                        alt=""
                        style={{
                          width: 80, height: 80, objectFit: 'cover',
                          borderRadius: 'var(--radius-sm)', flexShrink: 0,
                        }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div style={{
                      fontSize: '0.75rem', color: 'var(--text-dim)',
                      lineHeight: 1.4, flex: 1,
                    }}>
                      {r.snippet}
                    </div>
                  </div>
                  <ProvenanceBreakdown result={r} />
                  <button
                    onClick={() => {
                      const link = buildDeepLink(r, meta);
                      if (link) navigate(link);
                    }}
                    style={{
                      marginTop: 8,
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--amber)',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-sans)',
                      cursor: 'pointer',
                    }}
                  >
                    Open {meta?.label ?? r.domain}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
