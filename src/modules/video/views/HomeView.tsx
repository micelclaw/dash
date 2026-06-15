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
import { MediaRail } from '@/components/media';
import { EmptyState } from '@/components/shared/EmptyState';
import type { VideoItem } from '@/services/video.service';
import { useVideoStore } from '@/stores/video.store';
import { PosterCard } from '../components/PosterCard';

const CARD_WIDTH = 150;

function Rail({
  title,
  items,
  showProgress = false,
  onSeeAll,
}: {
  title: string;
  items: VideoItem[];
  showProgress?: boolean;
  onSeeAll?: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <MediaRail title={title} onSeeAll={onSeeAll}>
      {items.map((item) => (
        <PosterCard key={item.id} item={item} width={CARD_WIDTH} showProgress={showProgress} />
      ))}
    </MediaRail>
  );
}

/** Home tab — Continue watching / Next up / Recently added rails. */
export function HomeView() {
  const resume = useVideoStore((s) => s.resume);
  const nextUp = useVideoStore((s) => s.nextUp);
  const latestMovies = useVideoStore((s) => s.latestMovies);
  const latestSeries = useVideoStore((s) => s.latestSeries);
  const loading = useVideoStore((s) => s.loadingHome);

  const loaded = resume !== null;

  useEffect(() => {
    if (!loaded) void useVideoStore.getState().loadHome();
  }, [loaded]);

  if (!loaded) {
    return loading ? (
      <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading…</div>
    ) : null;
  }

  const empty =
    (resume?.length ?? 0) === 0 &&
    (nextUp?.length ?? 0) === 0 &&
    (latestMovies?.length ?? 0) === 0 &&
    (latestSeries?.length ?? 0) === 0;

  if (empty) {
    return (
      <EmptyState
        icon={Clapperboard}
        title="Your library is empty"
        description="Add movies and series to your Jellyfin library to see them here."
      />
    );
  }

  const goTo = (tab: 'movies' | 'series') => () => {
    useVideoStore.getState().setActiveTab(tab);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }}>
      <Rail title="Continue watching" items={resume ?? []} showProgress />
      <Rail title="Next up" items={nextUp ?? []} />
      <Rail title="Recently added Movies" items={latestMovies ?? []} onSeeAll={goTo('movies')} />
      <Rail title="Recently added Series" items={latestSeries ?? []} onSeeAll={goTo('series')} />
    </div>
  );
}
