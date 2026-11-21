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
import { useEffect } from 'react';
import { MicVocal } from 'lucide-react';
import { MediaGrid, MediaCard } from '@/components/media';
import { EmptyState } from '@/components/shared/EmptyState';
import { useMusicStore } from '@/stores/music.store';
import { coverUrl } from '@/services/music.service';
import { useI18n } from '@/i18n';

export function ArtistsView() {
  const { t } = useI18n();
  const artists = useMusicStore((s) => s.artists);
  const loading = useMusicStore((s) => s.loadingArtists);

  useEffect(() => {
    if (artists === null) void useMusicStore.getState().loadArtists();
  }, [artists]);

  if (artists === null) {
    return loading ? (
      <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: '0.875rem' }}>{t('music.loading')}</div>
    ) : null;
  }

  if (artists.length === 0) {
    return <EmptyState icon={MicVocal} title={t('music.noArtists')} description={t('music.noArtistsLibrary')} />;
  }

  return (
    <div style={{ padding: 16 }}>
      <MediaGrid>
        {artists.map((artist) => (
          <MediaCard
            key={artist.id}
            image={artist.cover_art ? coverUrl(artist.cover_art) : null}
            fallbackIcon={MicVocal}
            title={artist.name}
            badge={<EntitySource entity={artist} domain="music" native />}
            subtitle={
              artist.album_count !== undefined
                ? t(artist.album_count === 1 ? 'music.albumCountOne' : 'music.albumCountMany', { count: artist.album_count })
                : undefined
            }
            rounded="circle"
            onClick={() => void useMusicStore.getState().openArtist(artist.id)}
          />
        ))}
      </MediaGrid>
    </div>
  );
}
