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

import { useMemo } from 'react';
import { Search } from 'lucide-react';
import type { Channel } from './types';
import { PLATFORMS } from './types';

interface ChannelSidebarProps {
  channels: Channel[];
  selectedChannelId: string | null;
  platformFilter: string | null;
  search: string;
  onSelectChannel: (platformChannelId: string, platform: string) => void;
  onPlatformFilter: (platform: string | null) => void;
  onSearchChange: (search: string) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ChannelSidebar({
  channels, selectedChannelId, platformFilter, search,
  onSelectChannel, onPlatformFilter, onSearchChange,
}: ChannelSidebarProps) {
  // Get platforms that have messages
  const platforms = useMemo(() => {
    const set = new Set(channels.map(c => c.platform));
    return [...set].sort();
  }, [channels]);

  // Filter channels
  const filtered = useMemo(() => {
    let list = channels;
    if (platformFilter) list = list.filter(c => c.platform === platformFilter);
    if (search) {
      const lc = search.toLowerCase();
      list = list.filter(c =>
        (c.channel_name ?? '').toLowerCase().includes(lc) ||
        (c.last_message_content ?? '').toLowerCase().includes(lc)
      );
    }
    return list;
  }, [channels, platformFilter, search]);

  // Group by platform
  const grouped = useMemo(() => {
    const groups = new Map<string, Channel[]>();
    for (const ch of filtered) {
      const list = groups.get(ch.platform) ?? [];
      list.push(ch);
      groups.set(ch.platform, list);
    }
    return [...groups.entries()];
  }, [filtered]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      borderRight: '1px solid var(--border)',
    }}>
      {/* Platform pills */}
      <div style={{
        display: 'flex', gap: 4, padding: '10px 12px 6px',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={() => onPlatformFilter(null)}
          style={pillStyle(platformFilter === null)}
        >
          All
        </button>
        {platforms.map(p => (
          <button
            key={p}
            onClick={() => onPlatformFilter(p)}
            style={{
              ...pillStyle(platformFilter === p),
              ...(platformFilter === p ? { background: PLATFORMS[p]?.color ?? 'var(--amber)', color: '#fff' } : {}),
            }}
          >
            {PLATFORMS[p]?.label ?? p}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: '4px 12px 8px', position: 'relative' }}>
        <Search size={13} style={{
          position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
        }} />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search channels..."
          style={{
            width: '100%', padding: '6px 10px 6px 28px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
            fontFamily: 'var(--font-sans)', fontSize: '0.75rem',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Channel list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {grouped.map(([platform, chs]) => (
          <div key={platform}>
            {/* Platform header */}
            {!platformFilter && (
              <div style={{
                padding: '8px 12px 4px',
                fontSize: '0.625rem', fontWeight: 700,
                color: PLATFORMS[platform]?.color ?? 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {PLATFORMS[platform]?.label ?? platform}
              </div>
            )}

            {chs.map(ch => {
              const isActive = ch.platform_channel_id === selectedChannelId;
              return (
                <div
                  key={`${ch.platform}:${ch.platform_channel_id}`}
                  onClick={() => onSelectChannel(ch.platform_channel_id, ch.platform)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderLeft: isActive ? `3px solid ${PLATFORMS[ch.platform]?.color ?? 'var(--amber)'}` : '3px solid transparent',
                    background: isActive ? 'var(--surface)' : 'transparent',
                    transition: 'background var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.8125rem', fontWeight: isActive ? 600 : 400,
                      color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      flex: 1,
                    }}>
                      {ch.channel_name ?? ch.platform_channel_id}
                    </span>
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                      {timeAgo(ch.last_message_at)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '0.6875rem', color: 'var(--text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginTop: 2,
                  }}>
                    {ch.last_message_sender && <span style={{ fontWeight: 500 }}>{ch.last_message_sender}: </span>}
                    {(ch.last_message_content ?? '').substring(0, 40) || '(no content)'}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{
            padding: 24, textAlign: 'center',
            color: 'var(--text-muted)', fontSize: '0.8125rem',
          }}>
            {search ? 'No channels match' : 'No messages yet'}
          </div>
        )}
      </div>
    </div>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '3px 10px',
    fontSize: '0.6875rem',
    fontWeight: 500,
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--amber)' : 'var(--surface)',
    color: active ? '#000' : 'var(--text-dim)',
    fontFamily: 'var(--font-sans)',
    transition: 'all var(--transition-fast)',
  };
}
