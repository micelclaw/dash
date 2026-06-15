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

import { useEffect } from 'react';
import { Heart } from 'lucide-react';
import { MediaGrid } from '@/components/media';
import { EmptyState } from '@/components/shared/EmptyState';
import { useMusicStore } from '@/stores/music.store';
import { TrackList } from '../components/TrackList';
import { AlbumCard } from '../components/AlbumCard';

export function FavoritesView() {
  const starred = useMusicStore((s) => s.starred);
  const loading = useMusicStore((s) => s.loadingStarred);

  // Always refresh on mount — stars toggle elsewhere in the module.
  useEffect(() => {
    void useMusicStore.getState().loadStarred();
  }, []);

  if (!starred) {
    return loading ? (
      <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading…</div>
    ) : null;
  }

  if (starred.tracks.length === 0 && starred.albums.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="No favorites yet"
        description="Star tracks and albums to find them here."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }}>
      {starred.tracks.length > 0 && (
        <section>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            Tracks
          </h3>
          <TrackList tracks={starred.tracks} />
        </section>
      )}
      {starred.albums.length > 0 && (
        <section>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            Albums
          </h3>
          <MediaGrid>
            {starred.albums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </MediaGrid>
        </section>
      )}
    </div>
  );
}
