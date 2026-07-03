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
import { useSearchParams } from 'react-router';
import { MediaShell, MediaToolbar } from '@/components/media';
import { useVideoStore, type VideoTab } from '@/stores/video.store';
import { PlayerView } from './PlayerView';
import { HomeView } from './views/HomeView';
import { MoviesView } from './views/MoviesView';
import { SeriesView } from './views/SeriesView';
import { RequestsView } from './views/RequestsView';
import { SearchResults } from './views/SearchResults';
import { ItemDetailView } from './views/ItemDetailView';
import { UnavailableState } from './components/UnavailableState';

const TABS: { id: VideoTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'movies', label: 'Movies' },
  { id: 'series', label: 'Series' },
  { id: 'requests', label: 'Requests' },
];

/**
 * Video module — Jellyfin-backed movies & series browser (Home rails, poster
 * grids, series→seasons→episodes drill-down) with Jellyseerr media requests,
 * on the shared media UI kit. Playback opens the fullscreen PlayerView.
 */
export function VideoPage() {
  const activeTab = useVideoStore((s) => s.activeTab);
  const search = useVideoStore((s) => s.search);
  const aiSearch = useVideoStore((s) => s.aiSearch);
  const unavailable = useVideoStore((s) => s.unavailable);
  const selectedItem = useVideoStore((s) => s.selectedItem);
  const playingItem = useVideoStore((s) => s.playingItem);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    void useVideoStore.getState().checkStatus();
  }, []);

  // Deep-link desde el search global: ?item=<jellyfinItemId>.
  useEffect(() => {
    const item = searchParams.get('item');
    if (!item) return;
    void useVideoStore.getState().openItem(item);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  let content: React.ReactNode;
  if (unavailable) {
    content = <UnavailableState />;
  } else if (search.trim()) {
    content = <SearchResults />;
  } else if (selectedItem) {
    content = <ItemDetailView />;
  } else {
    switch (activeTab) {
      case 'movies': content = <MoviesView />; break;
      case 'series': content = <SeriesView />; break;
      case 'requests': content = <RequestsView />; break;
      default: content = <HomeView />;
    }
  }

  return (
    <>
      <MediaShell
        moduleVar="--mod-video"
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(id) => useVideoStore.getState().setActiveTab(id as VideoTab)}
        toolbar={
          <MediaToolbar
            search={search}
            onSearchChange={(q) => useVideoStore.getState().setSearch(q)}
            searchPlaceholder="Search movies & series…"
            aiSlot
            aiActive={aiSearch}
            onAiToggle={() => useVideoStore.getState().toggleAiSearch()}
            aiPlaceholder="Describe a movie or series…"
          />
        }
      >
        {content}
      </MediaShell>

      {playingItem && (
        <PlayerView
          item={playingItem}
          onClose={() => useVideoStore.getState().closePlayer()}
        />
      )}
    </>
  );
}

// Router lazy() contract
export function Component() {
  return <VideoPage />;
}
