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

import { Clapperboard, Play, RotateCcw, Star } from 'lucide-react';
import { MediaHero } from '@/components/media';
import { BackButton, HeroActionButton } from '@/modules/music/components/detail-chrome';
import { formatTotalDuration, formatTrackDuration } from '@/modules/music/lib/format';
import { imageUrl } from '@/services/video.service';
import { useVideoStore } from '@/stores/video.store';
import { SeasonList } from '../components/SeasonList';

/**
 * Detail view for a Movie / Series / Episode: backdrop banner, poster hero
 * with Play / Resume actions, overview, genres and cast. Series additionally
 * render their seasons with lazily-loaded episode rows.
 */
export function ItemDetailView() {
  const item = useVideoStore((s) => s.selectedItem);
  const seasons = useVideoStore((s) => s.seasons);
  const loading = useVideoStore((s) => s.loadingDetail);

  if (!item) {
    return loading ? (
      <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading…</div>
    ) : null;
  }

  const backdrop = item.backdrop_image_tag
    ? imageUrl(item.id, { type: 'Backdrop', maxWidth: 1280, tag: item.backdrop_image_tag })
    : null;
  const poster = imageUrl(item.id, {
    type: 'Primary',
    maxWidth: 400,
    tag: item.primary_image_tag,
  });

  const positionSeconds = item.user_data.position_seconds;
  const playable = item.type === 'Movie' || item.type === 'Episode';

  const playFrom = (position: number) =>
    useVideoStore.getState().play({
      id: item.id,
      name: item.name,
      seriesName: item.series_name,
      positionSeconds: position,
    });

  const subtitleParts: string[] = [];
  if (item.year !== undefined) subtitleParts.push(String(item.year));
  if (item.runtime_seconds) subtitleParts.push(formatTotalDuration(item.runtime_seconds));
  if (item.official_rating) subtitleParts.push(item.official_rating);

  const kicker =
    item.type === 'Episode' && item.series_name
      ? `${item.series_name}${item.season_name ? ` · ${item.season_name}` : ''}`
      : item.type;

  const cast = (item.people ?? []).filter((p) => p.type === 'Actor').slice(0, 8);

  return (
    <div style={{ position: 'relative', minHeight: '100%', fontFamily: 'var(--font-sans)' }}>
      {/* Backdrop banner */}
      {backdrop && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 280,
            overflow: 'hidden',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        >
          <img
            src={backdrop}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3, display: 'block' }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, transparent 20%, var(--bg) 100%)',
            }}
          />
        </div>
      )}

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: 16,
        }}
      >
        <BackButton onClick={() => useVideoStore.getState().closeDetail()} />

        <MediaHero
          image={poster}
          fallbackIcon={Clapperboard}
          kicker={kicker}
          title={item.name}
          subtitle={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {subtitleParts.join(' · ')}
              {item.community_rating !== undefined && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Star size={13} fill="currentColor" style={{ color: '#f59e0b' }} />
                  {item.community_rating.toFixed(1)}
                </span>
              )}
            </span>
          }
          meta={item.genres && item.genres.length > 0 ? item.genres.join(' · ') : undefined}
          actions={
            playable ? (
              positionSeconds > 0 ? (
                <>
                  <HeroActionButton
                    icon={Play}
                    label={`Resume from ${formatTrackDuration(positionSeconds)}`}
                    onClick={() => playFrom(positionSeconds)}
                    primary
                  />
                  <HeroActionButton
                    icon={RotateCcw}
                    label="Play from start"
                    onClick={() => playFrom(0)}
                  />
                </>
              ) : (
                <HeroActionButton icon={Play} label="Play" onClick={() => playFrom(0)} primary />
              )
            ) : undefined
          }
        />

        {item.overview && (
          <p
            style={{
              maxWidth: 760,
              margin: 0,
              padding: '0 16px',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              color: 'var(--text-dim)',
            }}
          >
            {item.overview}
          </p>
        )}

        {cast.length > 0 && (
          <div style={{ padding: '0 16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-dim)' }}>Cast: </span>
            {cast.map((p) => (p.role ? `${p.name} (${p.role})` : p.name)).join(', ')}
          </div>
        )}

        {item.type === 'Series' && (
          <div style={{ padding: '0 8px' }}>
            <SeasonList seasons={seasons ?? []} />
          </div>
        )}
      </div>
    </div>
  );
}
