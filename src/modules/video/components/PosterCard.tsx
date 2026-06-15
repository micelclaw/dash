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

import { Clapperboard } from 'lucide-react';
import { MediaCard } from '@/components/media';
import { imageUrl, type VideoItem } from '@/services/video.service';
import { useVideoStore } from '@/stores/video.store';

/** Playback progress 0..1 from Jellyfin user data. */
function itemProgress(item: VideoItem): number | undefined {
  const ud = item.user_data;
  if (ud.played_percentage && ud.played_percentage > 0) return ud.played_percentage / 100;
  if (ud.position_seconds > 0 && item.runtime_seconds) {
    return ud.position_seconds / item.runtime_seconds;
  }
  return undefined;
}

/** "S1E4" style code for episodes. */
function episodeCode(item: VideoItem): string {
  const s = item.parent_index_number !== undefined ? `S${item.parent_index_number}` : '';
  const e = item.index_number !== undefined ? `E${item.index_number}` : '';
  return `${s}${e}`;
}

/**
 * Poster (2:3) card for movies / series / episodes. Episodes show the parent
 * series poster with an "S1E4 · Title" subtitle. `width` pins the card for
 * rail usage; leave unset inside a MediaGrid.
 */
export function PosterCard({
  item,
  width,
  showProgress = false,
}: {
  item: VideoItem;
  width?: number;
  showProgress?: boolean;
}) {
  const isEpisode = item.type === 'Episode';
  const playable = item.type === 'Movie' || isEpisode;

  // Episodes carry a 16:9 primary image — prefer the series poster for 2:3.
  const image =
    isEpisode && item.series_id
      ? imageUrl(item.series_id, { type: 'Primary', maxWidth: 400 })
      : imageUrl(item.id, { type: 'Primary', maxWidth: 400, tag: item.primary_image_tag });

  const title = isEpisode ? (item.series_name ?? item.name) : item.name;
  const subtitle = isEpisode
    ? [episodeCode(item), item.name].filter(Boolean).join(' · ')
    : item.year !== undefined
      ? String(item.year)
      : undefined;

  return (
    <div style={width ? { width, flexShrink: 0 } : undefined}>
      <MediaCard
        aspect="poster"
        image={image}
        fallbackIcon={Clapperboard}
        title={title}
        subtitle={subtitle}
        progress={showProgress ? itemProgress(item) : undefined}
        onClick={() => void useVideoStore.getState().openItem(item.id)}
        onPlay={
          playable
            ? () =>
                useVideoStore.getState().play({
                  id: item.id,
                  name: item.name,
                  seriesName: item.series_name,
                  positionSeconds: item.user_data.position_seconds,
                })
            : undefined
        }
      />
    </div>
  );
}
