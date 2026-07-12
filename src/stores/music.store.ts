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

import { create } from 'zustand';
import { toast } from 'sonner';
import { ApiError } from '@/services/api';
import {
  musicService,
  type AlbumListType,
  type AlbumSummary,
  type ArtistSummary,
  type MusicSearchResults,
  type Playlist,
  type Track,
} from '@/services/music.service';
import { usePlayerStore } from '@/stores/player.store';

export type MusicTab = 'home' | 'albums' | 'artists' | 'playlists' | 'favorites';

const ALBUMS_PAGE_SIZE = 36;

interface MusicState {
  activeTab: MusicTab;
  search: string;
  /** Búsqueda en lenguaje natural (Fase 5 Slice A): toggle del sparkle. */
  aiSearch: boolean;
  /** Navidrome not usable right now (not installed OR not running). */
  unavailable: boolean;
  /** Navidrome container is installed (may still be stopped). */
  installed: boolean;
  /** On-demand start in progress. */
  starting: boolean;
  /** Last start error (timeout / RAM budget / etc.), null while OK. */
  startError: string | null;

  // Home rails
  homeRails: { recent: AlbumSummary[]; frequent: AlbumSummary[]; newest: AlbumSummary[] } | null;
  loadingHome: boolean;

  // Albums tab (type filter + offset paging)
  albums: AlbumSummary[];
  albumsType: AlbumListType;
  albumsOffset: number;
  albumsHasMore: boolean;
  loadingAlbums: boolean;

  // Artists tab
  artists: ArtistSummary[] | null;
  loadingArtists: boolean;

  // Playlists tab
  playlists: Playlist[] | null;
  loadingPlaylists: boolean;

  // Favorites tab
  starred: MusicSearchResults | null;
  loadingStarred: boolean;

  // Search overlay
  searchResults: MusicSearchResults | null;
  loadingSearch: boolean;

  // Detail state (one at a time)
  selectedAlbum: { album: AlbumSummary; tracks: Track[] } | null;
  selectedArtist: { artist: ArtistSummary; albums: AlbumSummary[] } | null;
  selectedPlaylist: { playlist: Playlist; tracks: Track[] } | null;
  loadingDetail: boolean;

  // Actions
  setActiveTab: (tab: MusicTab) => void;
  setSearch: (q: string) => void;
  toggleAiSearch: () => void;
  checkStatus: () => Promise<void>;
  /** Check status and, if installed-but-stopped, auto-start + poll to running. */
  ensureRunning: () => Promise<void>;
  /** Start the container on-demand and poll /status until running (fast transition). */
  startAndWait: () => Promise<void>;
  loadHome: () => Promise<void>;
  loadAlbums: (opts?: { reset?: boolean }) => Promise<void>;
  loadMoreAlbums: () => Promise<void>;
  setAlbumsType: (type: AlbumListType) => void;
  loadArtists: () => Promise<void>;
  loadPlaylists: () => Promise<void>;
  loadStarred: () => Promise<void>;
  runSearch: (q: string) => Promise<void>;
  openAlbum: (id: string) => Promise<void>;
  openArtist: (id: string) => Promise<void>;
  openPlaylist: (id: string) => Promise<void>;
  closeDetail: () => void;
  createPlaylist: (name: string) => Promise<void>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  removePlaylist: (id: string) => Promise<void>;
  addTracksToPlaylist: (playlistId: string, songIds: string[]) => Promise<void>;
  removeTrackFromSelectedPlaylist: (index: number) => Promise<void>;
  toggleTrackStar: (track: Track) => Promise<void>;
}

/** Map an error to either the unavailable flag or a toast. */
function isUnavailableError(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'NAVIDROME_UNAVAILABLE' || err.status === 503);
}

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Poll cadence + cap while a container boots (fast so the UI flips ASAP). */
const START_POLL_MS = 1000;
const START_TIMEOUT_MS = 90_000;

/** Apply a starred flag to every cached copy of a track. */
function patchTrackStar(tracks: Track[] | undefined, trackId: string, starred: boolean): Track[] | undefined {
  if (!tracks) return tracks;
  let touched = false;
  const next = tracks.map((t) => {
    if (t.id !== trackId) return t;
    touched = true;
    return { ...t, starred };
  });
  return touched ? next : tracks;
}

export const useMusicStore = create<MusicState>()((set, get) => {
  const handleError = (err: unknown, fallback: string) => {
    if (isUnavailableError(err)) {
      set({ unavailable: true });
      return;
    }
    toast.error(errMessage(err, fallback));
  };

  return {
    activeTab: 'home',
    search: '',
    aiSearch: false,
    unavailable: false,
    installed: true,
    starting: false,
    startError: null,

    homeRails: null,
    loadingHome: false,

    albums: [],
    albumsType: 'newest',
    albumsOffset: 0,
    albumsHasMore: false,
    loadingAlbums: false,

    artists: null,
    loadingArtists: false,

    playlists: null,
    loadingPlaylists: false,

    starred: null,
    loadingStarred: false,

    searchResults: null,
    loadingSearch: false,

    selectedAlbum: null,
    selectedArtist: null,
    selectedPlaylist: null,
    loadingDetail: false,

    // ─── Navigation ────────────────────────────────────

    setActiveTab: (tab) => {
      set({
        activeTab: tab,
        selectedAlbum: null,
        selectedArtist: null,
        selectedPlaylist: null,
      });
    },

    setSearch: (q) => {
      set({ search: q });
      if (q.trim()) {
        void get().runSearch(q.trim());
      } else {
        set({ searchResults: null, loadingSearch: false });
      }
    },

    toggleAiSearch: () => {
      const next = !get().aiSearch;
      set({ aiSearch: next });
      const q = get().search.trim();
      if (q) void get().runSearch(q); // re-run with the new mode
    },

    // ─── Loads ─────────────────────────────────────────

    checkStatus: async () => {
      try {
        const status = await musicService.getStatus();
        set({ installed: status.installed, unavailable: !status.running });
      } catch (err) {
        handleError(err, 'Could not check music service status');
      }
    },

    ensureRunning: async () => {
      await get().checkStatus();
      const { installed, unavailable, starting } = get();
      // Installed but stopped → start it on-demand (no admin/Servarr detour).
      // When it flips to running, the active view (HomeView/…) self-loads.
      if (installed && unavailable && !starting) {
        await get().startAndWait();
      }
    },

    startAndWait: async () => {
      if (get().starting) return;
      set({ starting: true, startError: null });
      try {
        let status = await musicService.start();
        set({ installed: status.installed });
        const deadline = Date.now() + START_TIMEOUT_MS;
        while (!status.running && Date.now() < deadline) {
          await sleep(START_POLL_MS);
          status = await musicService.getStatus();
        }
        if (status.running) {
          // Flip to running → MusicPage re-renders the active view, which self-loads.
          set({ starting: false, unavailable: false, installed: true });
        } else {
          set({ starting: false, startError: 'Navidrome tardó demasiado en arrancar' });
        }
      } catch (err) {
        const code = err instanceof ApiError ? err.code : undefined;
        set({
          starting: false,
          installed: code === 'NOT_INSTALLED' ? false : get().installed,
          startError: code === 'NOT_INSTALLED' ? null : errMessage(err, 'No se pudo arrancar Navidrome'),
        });
      }
    },

    loadHome: async () => {
      if (get().loadingHome) return;
      set({ loadingHome: true });
      try {
        const [recent, frequent, newest] = await Promise.all([
          musicService.getAlbums({ type: 'recent', size: 20 }),
          musicService.getAlbums({ type: 'frequent', size: 20 }),
          musicService.getAlbums({ type: 'newest', size: 20 }),
        ]);
        set({ homeRails: { recent, frequent, newest }, unavailable: false });
      } catch (err) {
        handleError(err, 'Could not load music home');
      } finally {
        set({ loadingHome: false });
      }
    },

    loadAlbums: async (opts) => {
      const { albumsType, albums, albumsOffset, loadingAlbums } = get();
      if (loadingAlbums) return;
      const reset = opts?.reset ?? false;
      const offset = reset ? 0 : albumsOffset;
      set({ loadingAlbums: true });
      try {
        const batch = await musicService.getAlbums({
          type: albumsType,
          size: ALBUMS_PAGE_SIZE,
          offset,
        });
        set({
          albums: reset ? batch : [...albums, ...batch],
          albumsOffset: offset + batch.length,
          albumsHasMore: batch.length === ALBUMS_PAGE_SIZE,
          unavailable: false,
        });
      } catch (err) {
        handleError(err, 'Could not load albums');
      } finally {
        set({ loadingAlbums: false });
      }
    },

    loadMoreAlbums: async () => {
      if (!get().albumsHasMore) return;
      await get().loadAlbums();
    },

    setAlbumsType: (type) => {
      if (type === get().albumsType) return;
      set({ albumsType: type, albums: [], albumsOffset: 0, albumsHasMore: false });
      void get().loadAlbums({ reset: true });
    },

    loadArtists: async () => {
      if (get().loadingArtists) return;
      set({ loadingArtists: true });
      try {
        const artists = await musicService.getArtists();
        set({ artists, unavailable: false });
      } catch (err) {
        handleError(err, 'Could not load artists');
      } finally {
        set({ loadingArtists: false });
      }
    },

    loadPlaylists: async () => {
      if (get().loadingPlaylists) return;
      set({ loadingPlaylists: true });
      try {
        const playlists = await musicService.getPlaylists();
        set({ playlists, unavailable: false });
      } catch (err) {
        handleError(err, 'Could not load playlists');
      } finally {
        set({ loadingPlaylists: false });
      }
    },

    loadStarred: async () => {
      if (get().loadingStarred) return;
      set({ loadingStarred: true });
      try {
        const starred = await musicService.getStarred();
        set({ starred, unavailable: false });
      } catch (err) {
        handleError(err, 'Could not load favorites');
      } finally {
        set({ loadingStarred: false });
      }
    },

    runSearch: async (q) => {
      set({ loadingSearch: true });
      try {
        const results = await musicService.search(q, undefined, get().aiSearch);
        // Ignore stale responses (the query moved on while we were fetching).
        if (get().search.trim() === q) {
          set({ searchResults: results, unavailable: false });
        }
      } catch (err) {
        handleError(err, 'Search failed');
      } finally {
        set({ loadingSearch: false });
      }
    },

    // ─── Detail ────────────────────────────────────────

    openAlbum: async (id) => {
      set({ loadingDetail: true });
      try {
        const album = await musicService.getAlbum(id);
        const { tracks, ...summary } = album;
        set({
          selectedAlbum: { album: summary, tracks },
          selectedArtist: null,
          selectedPlaylist: null,
        });
      } catch (err) {
        handleError(err, 'Could not load album');
      } finally {
        set({ loadingDetail: false });
      }
    },

    openArtist: async (id) => {
      set({ loadingDetail: true });
      try {
        const { artist, albums } = await musicService.getArtist(id);
        set({
          selectedArtist: { artist, albums },
          selectedAlbum: null,
          selectedPlaylist: null,
        });
      } catch (err) {
        handleError(err, 'Could not load artist');
      } finally {
        set({ loadingDetail: false });
      }
    },

    openPlaylist: async (id) => {
      set({ loadingDetail: true });
      try {
        const { playlist, tracks } = await musicService.getPlaylist(id);
        set({
          selectedPlaylist: { playlist, tracks },
          selectedAlbum: null,
          selectedArtist: null,
        });
      } catch (err) {
        handleError(err, 'Could not load playlist');
      } finally {
        set({ loadingDetail: false });
      }
    },

    closeDetail: () => {
      set({ selectedAlbum: null, selectedArtist: null, selectedPlaylist: null });
    },

    // ─── Playlist mutations ────────────────────────────

    createPlaylist: async (name) => {
      try {
        await musicService.createPlaylist(name);
        toast.success('Playlist created');
        await get().loadPlaylists();
      } catch (err) {
        handleError(err, 'Could not create playlist');
      }
    },

    renamePlaylist: async (id, name) => {
      try {
        await musicService.updatePlaylist(id, { name });
        toast.success('Playlist renamed');
        const { selectedPlaylist } = get();
        if (selectedPlaylist?.playlist.id === id) {
          set({ selectedPlaylist: { ...selectedPlaylist, playlist: { ...selectedPlaylist.playlist, name } } });
        }
        await get().loadPlaylists();
      } catch (err) {
        handleError(err, 'Could not rename playlist');
      }
    },

    removePlaylist: async (id) => {
      try {
        await musicService.deletePlaylist(id);
        toast.success('Playlist deleted');
        if (get().selectedPlaylist?.playlist.id === id) {
          set({ selectedPlaylist: null });
        }
        await get().loadPlaylists();
      } catch (err) {
        handleError(err, 'Could not delete playlist');
      }
    },

    addTracksToPlaylist: async (playlistId, songIds) => {
      try {
        await musicService.updatePlaylist(playlistId, { add_song_ids: songIds });
        toast.success('Added to playlist');
        // Refresh the open playlist if it is the one we touched.
        if (get().selectedPlaylist?.playlist.id === playlistId) {
          await get().openPlaylist(playlistId);
        }
      } catch (err) {
        handleError(err, 'Could not add to playlist');
      }
    },

    removeTrackFromSelectedPlaylist: async (index) => {
      const { selectedPlaylist } = get();
      if (!selectedPlaylist) return;
      const prevTracks = selectedPlaylist.tracks;
      // Optimistic remove
      set({
        selectedPlaylist: {
          ...selectedPlaylist,
          tracks: prevTracks.filter((_, i) => i !== index),
        },
      });
      try {
        await musicService.updatePlaylist(selectedPlaylist.playlist.id, { remove_indexes: [index] });
      } catch (err) {
        // Revert
        const current = get().selectedPlaylist;
        if (current?.playlist.id === selectedPlaylist.playlist.id) {
          set({ selectedPlaylist: { ...current, tracks: prevTracks } });
        }
        handleError(err, 'Could not remove track from playlist');
      }
    },

    // ─── Star toggle (optimistic) ──────────────────────

    toggleTrackStar: async (track) => {
      const next = !track.starred;
      const apply = (starred: boolean) => {
        const s = get();
        set({
          selectedAlbum: s.selectedAlbum
            ? { ...s.selectedAlbum, tracks: patchTrackStar(s.selectedAlbum.tracks, track.id, starred) ?? [] }
            : null,
          selectedPlaylist: s.selectedPlaylist
            ? { ...s.selectedPlaylist, tracks: patchTrackStar(s.selectedPlaylist.tracks, track.id, starred) ?? [] }
            : null,
          searchResults: s.searchResults
            ? { ...s.searchResults, tracks: patchTrackStar(s.searchResults.tracks, track.id, starred) ?? [] }
            : null,
          starred: s.starred
            ? { ...s.starred, tracks: patchTrackStar(s.starred.tracks, track.id, starred) ?? [] }
            : null,
        });
      };
      apply(next);
      try {
        if (next) await musicService.star(track.id, 'song');
        else await musicService.unstar(track.id, 'song');
      } catch (err) {
        apply(!next); // revert
        handleError(err, 'Could not update favorite');
      }
    },
  };
});

// ─── Scrobble watcher ────────────────────────────────────
//
// Module-level subscription on the player store. Initialized once from
// MusicPage. Sends "now playing" (submission:false) when a Navidrome track
// starts, and the real scrobble (submission:true) once playback passes
// min(50% of duration, 4 minutes). Never scrobbles twice per playback and
// ignores non-navidrome items.

const SCROBBLE_CAP_SECONDS = 240;

let scrobbleWatcherStarted = false;

export function initScrobbleWatcher(): void {
  if (scrobbleWatcherStarted) return;
  scrobbleWatcherStarted = true;

  let watchedId: string | null = null;
  let scrobbled = true;

  usePlayerStore.subscribe((state, prev) => {
    const item = state.currentItem;

    // Track change — emit "now playing" and arm the scrobble.
    if (item !== prev.currentItem) {
      if (item && item.source === 'navidrome' && item.sourceId) {
        watchedId = item.sourceId;
        scrobbled = false;
        musicService.scrobble(item.sourceId, false).catch(() => { /* best-effort */ });
      } else {
        watchedId = null;
        scrobbled = true;
      }
      return;
    }

    if (scrobbled || !watchedId) return;
    if (state.currentTime === prev.currentTime) return;

    const { duration, currentTime } = state;
    if (duration > 0 && currentTime >= Math.min(duration * 0.5, SCROBBLE_CAP_SECONDS)) {
      scrobbled = true;
      musicService.scrobble(watchedId, true).catch(() => { /* best-effort */ });
    }
  });
}
