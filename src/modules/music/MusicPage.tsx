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
import { initScrobbleWatcher, useMusicStore, type MusicTab } from '@/stores/music.store';
import { HomeView } from './views/HomeView';
import { AlbumsView } from './views/AlbumsView';
import { ArtistsView } from './views/ArtistsView';
import { PlaylistsView } from './views/PlaylistsView';
import { FavoritesView } from './views/FavoritesView';
import { SearchResults } from './views/SearchResults';
import { AlbumDetailView } from './views/AlbumDetailView';
import { ArtistDetailView } from './views/ArtistDetailView';
import { PlaylistDetailView } from './views/PlaylistDetailView';
import { UnavailableState } from './components/UnavailableState';

const TABS: { id: MusicTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'albums', label: 'Albums' },
  { id: 'artists', label: 'Artists' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'favorites', label: 'Favorites' },
];

/**
 * Music module — Navidrome-backed library browser (Home rails, albums,
 * artists, playlists, favorites) on the shared media UI kit. Playback goes
 * through the global player store; scrobbles are reported by the watcher in
 * music.store.
 */
export function MusicPage() {
  const activeTab = useMusicStore((s) => s.activeTab);
  const search = useMusicStore((s) => s.search);
  const aiSearch = useMusicStore((s) => s.aiSearch);
  const unavailable = useMusicStore((s) => s.unavailable);
  const selectedAlbum = useMusicStore((s) => s.selectedAlbum);
  const selectedArtist = useMusicStore((s) => s.selectedArtist);
  const selectedPlaylist = useMusicStore((s) => s.selectedPlaylist);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    initScrobbleWatcher();
    void useMusicStore.getState().checkStatus();
  }, []);

  // Deep-link desde el search global: ?album=/?artist=/?playlist=<externalId>.
  useEffect(() => {
    const album = searchParams.get('album');
    const artist = searchParams.get('artist');
    const playlist = searchParams.get('playlist');
    if (!album && !artist && !playlist) return;
    const s = useMusicStore.getState();
    if (album) void s.openAlbum(album);
    else if (artist) void s.openArtist(artist);
    else if (playlist) void s.openPlaylist(playlist);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  let content: React.ReactNode;
  if (unavailable) {
    content = <UnavailableState />;
  } else if (search.trim()) {
    content = <SearchResults />;
  } else if (selectedAlbum) {
    content = <AlbumDetailView />;
  } else if (selectedArtist) {
    content = <ArtistDetailView />;
  } else if (selectedPlaylist) {
    content = <PlaylistDetailView />;
  } else {
    switch (activeTab) {
      case 'albums': content = <AlbumsView />; break;
      case 'artists': content = <ArtistsView />; break;
      case 'playlists': content = <PlaylistsView />; break;
      case 'favorites': content = <FavoritesView />; break;
      default: content = <HomeView />;
    }
  }

  return (
    <MediaShell
      moduleVar="--mod-music"
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={(id) => useMusicStore.getState().setActiveTab(id as MusicTab)}
      toolbar={
        <MediaToolbar
          search={search}
          onSearchChange={(q) => useMusicStore.getState().setSearch(q)}
          searchPlaceholder="Search music…"
          aiSlot
          aiActive={aiSearch}
          onAiToggle={() => useMusicStore.getState().toggleAiSearch()}
          aiPlaceholder="Describe what you want to hear…"
        />
      }
    >
      {content}
    </MediaShell>
  );
}

// Router lazy() contract
export function Component() {
  return <MusicPage />;
}
