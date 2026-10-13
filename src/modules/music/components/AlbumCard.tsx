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

import { EntitySource } from '@/components/shared/SourceBadge';
import { Disc3 } from 'lucide-react';
import { MediaCard } from '@/components/media';
import { coverUrl, type AlbumSummary } from '@/services/music.service';
import { useMusicStore } from '@/stores/music.store';
import { playAlbumById } from '../lib/playback';

/**
 * Album cover card. `width` pins the card for rail usage (~160px);
 * leave unset inside a MediaGrid.
 */
export function AlbumCard({ album, width }: { album: AlbumSummary; width?: number }) {
  return (
    <div style={width ? { width, flexShrink: 0 } : undefined}>
      <MediaCard
        image={album.cover_art ? coverUrl(album.cover_art) : null}
        fallbackIcon={Disc3}
        title={album.name}
            badge={<EntitySource entity={album} domain="music" native />}
        subtitle={album.artist}
        onClick={() => void useMusicStore.getState().openAlbum(album.id)}
        onPlay={() => void playAlbumById(album.id)}
      />
    </div>
  );
}
