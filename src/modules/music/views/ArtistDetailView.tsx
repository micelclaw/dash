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
import { MicVocal } from 'lucide-react';
import { MediaGrid, MediaHero } from '@/components/media';
import { useMusicStore } from '@/stores/music.store';
import { coverUrl } from '@/services/music.service';
import { AlbumCard } from '../components/AlbumCard';
import { BackButton } from '../components/detail-chrome';

export function ArtistDetailView() {
  const detail = useMusicStore((s) => s.selectedArtist);
  const closeDetail = useMusicStore((s) => s.closeDetail);

  if (!detail) return null;
  const { artist, albums } = detail;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <BackButton onClick={closeDetail} />
      <EntitySource entity={artist} domain="music" native detail />
      <MediaHero
        image={artist.cover_art ? coverUrl(artist.cover_art, 600) : null}
        fallbackIcon={MicVocal}
        kicker="Artist"
        title={artist.name}
        meta={`${albums.length} album${albums.length === 1 ? '' : 's'}`}
        rounded="circle"
      />
      <MediaGrid>
        {albums.map((album) => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </MediaGrid>
    </div>
  );
}
