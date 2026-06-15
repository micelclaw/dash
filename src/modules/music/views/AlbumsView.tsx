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
import { Disc3 } from 'lucide-react';
import { MediaGrid } from '@/components/media';
import { EmptyState } from '@/components/shared/EmptyState';
import { useMusicStore } from '@/stores/music.store';
import type { AlbumListType } from '@/services/music.service';
import { AlbumCard } from '../components/AlbumCard';

const TYPE_CHIPS: { id: AlbumListType; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'recent', label: 'Recent' },
  { id: 'frequent', label: 'Frequent' },
  { id: 'random', label: 'Random' },
  { id: 'starred', label: 'Starred' },
  { id: 'alphabeticalByName', label: 'A–Z' },
];

export function AlbumsView() {
  const albums = useMusicStore((s) => s.albums);
  const albumsType = useMusicStore((s) => s.albumsType);
  const hasMore = useMusicStore((s) => s.albumsHasMore);
  const loading = useMusicStore((s) => s.loadingAlbums);
  const setAlbumsType = useMusicStore((s) => s.setAlbumsType);
  const loadMoreAlbums = useMusicStore((s) => s.loadMoreAlbums);

  useEffect(() => {
    if (albums.length === 0) void useMusicStore.getState().loadAlbums({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      {/* Type filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TYPE_CHIPS.map((chip) => {
          const active = chip.id === albumsType;
          return (
            <button
              key={chip.id}
              onClick={() => setAlbumsType(chip.id)}
              style={{
                padding: '4px 12px',
                borderRadius: 999,
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                border: active ? '1px solid var(--amber)' : '1px solid var(--border)',
                background: active ? 'var(--amber)' : 'transparent',
                color: active ? '#06060a' : 'var(--text-dim)',
                fontWeight: active ? 600 : 400,
                transition: 'background var(--transition-fast)',
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {albums.length === 0 && !loading ? (
        <EmptyState icon={Disc3} title="No albums" description="No albums found for this filter." />
      ) : (
        <MediaGrid>
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </MediaGrid>
      )}

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 16 }}>
          <button
            onClick={() => void loadMoreAlbums()}
            disabled={loading}
            style={{
              padding: '8px 24px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              cursor: loading ? 'default' : 'pointer',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-dim)',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
