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

import { useEffect, useState } from 'react';
import {
  Heart, ListEnd, ListPlus, ListStart, MoreVertical, Music, Play,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePlayerStore } from '@/stores/player.store';
import { useMusicStore } from '@/stores/music.store';
import type { Track } from '@/services/music.service';
import { addTrackToQueue, playTrackNext, playTracks } from '../lib/playback';
import { formatTrackDuration } from '../lib/format';

interface TrackListProps {
  tracks: Track[];
  /** When set (playlist detail), adds a "Remove from playlist" menu item. */
  onRemoveFromPlaylist?: (index: number) => void;
}

/**
 * Track table: index / title / artist / duration rows with hover play,
 * optimistic star toggle and a per-row context menu (play, queue ops,
 * add-to-playlist submenu, star).
 */
export function TrackList({ tracks, onRemoveFromPlaylist }: TrackListProps) {
  const toggleTrackStar = useMusicStore((s) => s.toggleTrackStar);
  const playlists = useMusicStore((s) => s.playlists);
  const addTracksToPlaylist = useMusicStore((s) => s.addTracksToPlaylist);
  const currentItem = usePlayerStore((s) => s.currentItem);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Playlists feed the "Add to playlist" submenu — make sure they exist.
  useEffect(() => {
    if (playlists === null) void useMusicStore.getState().loadPlaylists();
  }, [playlists]);

  if (tracks.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
        No tracks
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {tracks.map((track, index) => {
        const isCurrent = currentItem?.source === 'navidrome' && currentItem.sourceId === track.id;
        const hovered = hoveredId === track.id;
        return (
          <div
            key={`${track.id}-${index}`}
            onMouseEnter={() => setHoveredId(track.id)}
            onMouseLeave={() => setHoveredId((h) => (h === track.id ? null : h))}
            onDoubleClick={() => playTracks(tracks, index)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: hovered ? 'var(--card)' : 'transparent',
              transition: 'background var(--transition-fast)',
              cursor: 'default',
            }}
          >
            {/* Index / play-on-hover */}
            <div style={{ width: 28, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
              {hovered ? (
                <button
                  onClick={() => playTracks(tracks, index)}
                  title="Play"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: 'var(--amber)', display: 'flex',
                  }}
                >
                  <Play size={16} fill="currentColor" />
                </button>
              ) : (
                <span style={{
                  fontSize: '0.8125rem',
                  color: isCurrent ? 'var(--amber)' : 'var(--text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {track.track ?? index + 1}
                </span>
              )}
            </div>

            {/* Title + artist */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '0.875rem',
                color: isCurrent ? 'var(--amber)' : 'var(--text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {track.title}
              </div>
              <div style={{
                fontSize: '0.75rem', color: 'var(--text-dim)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {track.artist}
              </div>
            </div>

            {/* Star toggle (optimistic) */}
            <button
              onClick={() => void toggleTrackStar(track)}
              title={track.starred ? 'Unstar' : 'Star'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: track.starred ? 'var(--amber)' : hovered ? 'var(--text-dim)' : 'transparent',
                display: 'flex', flexShrink: 0,
                transition: 'color var(--transition-fast)',
              }}
            >
              <Heart size={15} fill={track.starred ? 'currentColor' : 'none'} />
            </button>

            {/* Duration */}
            <span style={{
              fontSize: '0.8125rem', color: 'var(--text-muted)',
              fontVariantNumeric: 'tabular-nums', flexShrink: 0, width: 44, textAlign: 'right',
            }}>
              {formatTrackDuration(track.duration)}
            </span>

            {/* Row menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  title="More"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    color: hovered ? 'var(--text-dim)' : 'transparent',
                    display: 'flex', flexShrink: 0,
                    transition: 'color var(--transition-fast)',
                  }}
                >
                  <MoreVertical size={15} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => playTracks(tracks, index)}>
                  <Play size={14} /> Play
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => playTrackNext(track)}>
                  <ListStart size={14} /> Play next
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addTrackToQueue(track)}>
                  <ListEnd size={14} /> Add to queue
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ListPlus size={14} /> Add to playlist
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {(playlists ?? []).length === 0 ? (
                      <DropdownMenuItem disabled>
                        <Music size={14} /> No playlists
                      </DropdownMenuItem>
                    ) : (
                      (playlists ?? []).map((pl) => (
                        <DropdownMenuItem
                          key={pl.id}
                          onClick={() => void addTracksToPlaylist(pl.id, [track.id])}
                        >
                          {pl.name}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={() => void toggleTrackStar(track)}>
                  <Heart size={14} /> {track.starred ? 'Unstar' : 'Star'}
                </DropdownMenuItem>
                {onRemoveFromPlaylist && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onRemoveFromPlaylist(index)}
                      style={{ color: 'var(--error)' }}
                    >
                      Remove from playlist
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}
