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
import { Clapperboard } from 'lucide-react';
import { MediaGrid } from '@/components/media';
import { EmptyState } from '@/components/shared/EmptyState';
import type { VideoSortBy } from '@/services/video.service';
import { useVideoStore } from '@/stores/video.store';
import { PosterCard } from './PosterCard';
import { useI18n } from '@/i18n';

const SORT_CHIPS: { id: VideoSortBy; labelKey: string }[] = [
  { id: 'SortName', labelKey: 'video.sortAlphabetical' },
  { id: 'DateCreated', labelKey: 'video.sortRecentlyAdded' },
  { id: 'CommunityRating', labelKey: 'video.sortTopRated' },
];

/**
 * Shared Movies/Series tab body: sort chips, poster grid with paging and a
 * Load more button (same chrome as the music AlbumsView).
 */
export function LibraryGrid({ kind }: { kind: 'movies' | 'series' }) {
  const { t } = useI18n();
  const listing = useVideoStore((s) => s[kind]);

  useEffect(() => {
    if (listing.items.length === 0) {
      void useVideoStore.getState().loadListing(kind, { reset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      {/* Sort chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SORT_CHIPS.map((chip) => {
          const active = chip.id === listing.sortBy;
          return (
            <button
              key={chip.id}
              onClick={() => useVideoStore.getState().setSort(kind, chip.id)}
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
              {t(chip.labelKey)}
            </button>
          );
        })}
      </div>

      {listing.items.length === 0 && !listing.loading ? (
        <EmptyState
          icon={Clapperboard}
          title={kind === 'movies' ? t('video.noMovies') : t('video.noSeries')}
          description={t('video.nothingInLibrary')}
        />
      ) : (
        <MediaGrid>
          {listing.items.map((item) => (
            <PosterCard key={item.id} item={item} />
          ))}
        </MediaGrid>
      )}

      {listing.hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 16 }}>
          <button
            onClick={() => void useVideoStore.getState().loadMore(kind)}
            disabled={listing.loading}
            style={{
              padding: '8px 24px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              cursor: listing.loading ? 'default' : 'pointer',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-dim)',
              opacity: listing.loading ? 0.6 : 1,
            }}
          >
            {listing.loading ? t('video.loading') : t('video.loadMore')}
          </button>
        </div>
      )}
    </div>
  );
}
