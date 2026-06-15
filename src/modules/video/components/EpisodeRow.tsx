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
import { Check, Play } from 'lucide-react';
import { imageUrl, type VideoItem } from '@/services/video.service';
import { useVideoStore } from '@/stores/video.store';
import { formatTotalDuration } from '@/modules/music/lib/format';

/**
 * Episode row inside a season: 16:9 thumbnail with hover play + progress bar,
 * episode number/title, runtime and a green checkmark when played.
 */
export function EpisodeRow({ episode }: { episode: VideoItem }) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  const ud = episode.user_data;
  const progress =
    ud.played_percentage && ud.played_percentage > 0
      ? ud.played_percentage / 100
      : ud.position_seconds > 0 && episode.runtime_seconds
        ? ud.position_seconds / episode.runtime_seconds
        : 0;

  const playEpisode = () =>
    useVideoStore.getState().play({
      id: episode.id,
      name: episode.name,
      seriesName: episode.series_name,
      positionSeconds: ud.position_seconds,
    });

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={playEpisode}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '8px 10px',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        background: hovered ? 'var(--surface)' : 'transparent',
        transition: 'background var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          position: 'relative',
          width: 128,
          aspectRatio: '16 / 9',
          flexShrink: 0,
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          background: 'var(--surface)',
        }}
      >
        {!imgError && (
          <img
            src={imageUrl(episode.id, {
              type: 'Primary',
              maxWidth: 320,
              tag: episode.primary_image_tag,
            })}
            alt=""
            loading="lazy"
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        {hovered && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.45)',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-full)',
                background: 'var(--amber)',
                color: '#06060a',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <Play size={14} fill="currentColor" style={{ marginLeft: 1 }} />
            </span>
          </div>
        )}
        {progress > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            <div
              style={{
                width: `${Math.min(1, progress) * 100}%`,
                height: '100%',
                background: 'var(--amber)',
              }}
            />
          </div>
        )}
      </div>

      {/* Texts */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {episode.index_number !== undefined && (
            <span style={{ color: 'var(--text-dim)', marginRight: 8 }}>
              {episode.index_number}.
            </span>
          )}
          {episode.name}
        </div>
        {episode.overview && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {episode.overview}
          </div>
        )}
      </div>

      {/* Runtime + played check */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        {episode.runtime_seconds !== undefined && episode.runtime_seconds > 0 && (
          <span>{formatTotalDuration(episode.runtime_seconds)}</span>
        )}
        {ud.played && <Check size={16} style={{ color: '#22c55e' }} aria-label="Played" />}
      </div>
    </div>
  );
}
