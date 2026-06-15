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
import { Music } from 'lucide-react';
import { MediaRail } from '@/components/media';
import { EmptyState } from '@/components/shared/EmptyState';
import { useMusicStore } from '@/stores/music.store';
import { AlbumCard } from '../components/AlbumCard';
import type { AlbumSummary } from '@/services/music.service';

const CARD_WIDTH = 160;

function Rail({ title, albums, onSeeAll }: { title: string; albums: AlbumSummary[]; onSeeAll?: () => void }) {
  if (albums.length === 0) return null;
  return (
    <MediaRail title={title} onSeeAll={onSeeAll}>
      {albums.map((album) => (
        <AlbumCard key={album.id} album={album} width={CARD_WIDTH} />
      ))}
    </MediaRail>
  );
}

export function HomeView() {
  const homeRails = useMusicStore((s) => s.homeRails);
  const loading = useMusicStore((s) => s.loadingHome);

  useEffect(() => {
    if (!homeRails) void useMusicStore.getState().loadHome();
  }, [homeRails]);

  if (!homeRails) {
    return loading ? (
      <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading…</div>
    ) : null;
  }

  const empty =
    homeRails.recent.length === 0 &&
    homeRails.frequent.length === 0 &&
    homeRails.newest.length === 0;

  if (empty) {
    return (
      <EmptyState
        icon={Music}
        title="Your library is empty"
        description="Add music to your Navidrome library to see it here."
      />
    );
  }

  const seeAll = (type: 'recent' | 'frequent' | 'newest') => () => {
    const store = useMusicStore.getState();
    store.setActiveTab('albums');
    store.setAlbumsType(type);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }}>
      <Rail title="Recently played" albums={homeRails.recent} onSeeAll={seeAll('recent')} />
      <Rail title="Most played" albums={homeRails.frequent} onSeeAll={seeAll('frequent')} />
      <Rail title="Recently added" albums={homeRails.newest} onSeeAll={seeAll('newest')} />
    </div>
  );
}
