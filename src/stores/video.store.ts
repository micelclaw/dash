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
  videoService,
  type DiscoverResult,
  type MediaRequest,
  type VideoItem,
  type VideoItemDetail,
  type VideoLibrary,
  type VideoSortBy,
  type VideoSortOrder,
} from '@/services/video.service';

export type VideoTab = 'home' | 'movies' | 'series' | 'requests';

const PAGE_SIZE = 36;
const RAIL_LIMIT = 12;

/** Item handed to the fullscreen PlayerView. */
export interface PlayingItem {
  id: string;
  name: string;
  seriesName?: string;
  positionSeconds?: number;
}

interface ListingState {
  items: VideoItem[];
  total: number;
  offset: number;
  hasMore: boolean;
  sortBy: VideoSortBy;
  sortOrder: VideoSortOrder;
  loading: boolean;
}

const emptyListing = (sortBy: VideoSortBy, sortOrder: VideoSortOrder): ListingState => ({
  items: [],
  total: 0,
  offset: 0,
  hasMore: false,
  sortBy,
  sortOrder,
  loading: false,
});

/** Natural direction per sort key (A–Z ascending, dates/ratings descending). */
function defaultOrderFor(sortBy: VideoSortBy): VideoSortOrder {
  return sortBy === 'SortName' ? 'Ascending' : 'Descending';
}

function isJellyfinUnavailable(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'JELLYFIN_UNAVAILABLE' || err.status === 503);
}

function isJellyseerrUnavailable(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'JELLYSEERR_UNAVAILABLE' || err.status === 503);
}

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Poll cadence + cap while a container boots (fast so the UI flips ASAP). */
const START_POLL_MS = 1000;
const START_TIMEOUT_MS = 90_000;

interface VideoState {
  activeTab: VideoTab;
  search: string;
  /** Búsqueda en lenguaje natural (Fase 5 Slice A). */
  aiSearch: boolean;
  /** Jellyfin not usable right now (not installed OR not running). */
  unavailable: boolean;
  /** Jellyfin container is installed (may still be stopped). */
  installed: boolean;
  /** On-demand start in progress (arranca bajo demanda + progreso). */
  starting: boolean;
  /** Last start error (timeout / RAM budget / etc.), null while OK. */
  startError: string | null;
  /** Jellyseerr container absent/down (503 JELLYSEERR_UNAVAILABLE). */
  jellyseerrUnavailable: boolean;

  libraries: VideoLibrary[] | null;

  // Home rails
  resume: VideoItem[] | null;
  nextUp: VideoItem[] | null;
  latestMovies: VideoItem[] | null;
  latestSeries: VideoItem[] | null;
  loadingHome: boolean;

  // Movies / Series tabs (offset paging + sort)
  movies: ListingState;
  series: ListingState;

  // Search overlay
  searchResults: VideoItem[] | null;
  loadingSearch: boolean;

  // Detail navigation (Movie/Episode detail, or Series -> seasons -> episodes)
  selectedItem: VideoItemDetail | null;
  seasons: VideoItem[] | null;
  episodesBySeason: Record<string, VideoItem[]>;
  loadingDetail: boolean;
  /** seasonId currently loading its episodes. */
  loadingEpisodes: string | null;

  // Requests tab (Jellyseerr)
  discoverResults: DiscoverResult[] | null;
  loadingDiscover: boolean;
  requests: MediaRequest[] | null;
  loadingRequests: boolean;
  requesting: boolean;

  // Player
  playingItem: PlayingItem | null;

  // Actions
  setActiveTab: (tab: VideoTab) => void;
  setSearch: (q: string) => void;
  toggleAiSearch: () => void;
  checkStatus: () => Promise<void>;
  /** Check status and, if installed-but-stopped, auto-start + poll to running. */
  ensureRunning: () => Promise<void>;
  /** Start the container on-demand and poll /status until running (fast transition). */
  startAndWait: () => Promise<void>;
  loadHome: () => Promise<void>;
  loadListing: (kind: 'movies' | 'series', opts?: { reset?: boolean }) => Promise<void>;
  loadMore: (kind: 'movies' | 'series') => Promise<void>;
  setSort: (kind: 'movies' | 'series', sortBy: VideoSortBy) => void;
  runSearch: (q: string) => Promise<void>;
  openItem: (id: string) => Promise<void>;
  loadSeasonEpisodes: (seasonId: string) => Promise<void>;
  closeDetail: () => void;
  loadDiscover: (q: string) => Promise<void>;
  loadRequests: () => Promise<void>;
  submitRequest: (body: { media_type: 'movie' | 'tv'; tmdb_id: number; seasons?: number[] }) => Promise<boolean>;
  play: (item: PlayingItem) => void;
  closePlayer: () => void;
}

export const useVideoStore = create<VideoState>()((set, get) => {
  const handleError = (err: unknown, fallback: string) => {
    if (isJellyfinUnavailable(err)) {
      set({ unavailable: true });
      return;
    }
    toast.error(errMessage(err, fallback));
  };

  const handleSeerrError = (err: unknown, fallback: string) => {
    if (isJellyseerrUnavailable(err)) {
      set({ jellyseerrUnavailable: true });
      return;
    }
    toast.error(errMessage(err, fallback));
  };

  /** Load and cache library views (movies / tvshows). */
  const ensureLibraries = async (): Promise<VideoLibrary[]> => {
    const cached = get().libraries;
    if (cached) return cached;
    const libraries = await videoService.getLibraries();
    set({ libraries });
    return libraries;
  };

  const libraryIdFor = (libraries: VideoLibrary[], kind: 'movies' | 'series'): string | undefined =>
    libraries.find((l) => l.collection_type === (kind === 'movies' ? 'movies' : 'tvshows'))?.id;

  return {
    activeTab: 'home',
    search: '',
    aiSearch: false,
    unavailable: false,
    installed: true,
    starting: false,
    startError: null,
    jellyseerrUnavailable: false,

    libraries: null,

    resume: null,
    nextUp: null,
    latestMovies: null,
    latestSeries: null,
    loadingHome: false,

    movies: emptyListing('SortName', 'Ascending'),
    series: emptyListing('SortName', 'Ascending'),

    searchResults: null,
    loadingSearch: false,

    selectedItem: null,
    seasons: null,
    episodesBySeason: {},
    loadingDetail: false,
    loadingEpisodes: null,

    discoverResults: null,
    loadingDiscover: false,
    requests: null,
    loadingRequests: false,
    requesting: false,

    playingItem: null,

    // ─── Navigation ────────────────────────────────────

    setActiveTab: (tab) => {
      set({ activeTab: tab, selectedItem: null, seasons: null, episodesBySeason: {} });
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
      set({ aiSearch: !get().aiSearch });
      const q = get().search.trim();
      if (q) void get().runSearch(q);
    },

    // ─── Status / home ─────────────────────────────────

    checkStatus: async () => {
      try {
        const status = await videoService.getStatus();
        set({
          installed: status.installed,
          unavailable: !status.running,
          jellyseerrUnavailable: !status.jellyseerr_available,
        });
      } catch (err) {
        handleError(err, 'Could not check video service status');
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
        let status = await videoService.start();
        set({ installed: status.installed });
        const deadline = Date.now() + START_TIMEOUT_MS;
        while (!status.running && Date.now() < deadline) {
          await sleep(START_POLL_MS);
          status = await videoService.getStatus();
        }
        if (status.running) {
          // Flip to running → VideoPage re-renders the active view, which self-loads.
          set({ starting: false, unavailable: false, installed: true, jellyseerrUnavailable: !status.jellyseerr_available });
        } else {
          set({ starting: false, startError: 'Jellyfin tardó demasiado en arrancar' });
        }
      } catch (err) {
        const code = err instanceof ApiError ? err.code : undefined;
        set({
          starting: false,
          installed: code === 'NOT_INSTALLED' ? false : get().installed,
          startError: code === 'NOT_INSTALLED' ? null : errMessage(err, 'No se pudo arrancar Jellyfin'),
        });
      }
    },

    loadHome: async () => {
      if (get().loadingHome) return;
      set({ loadingHome: true });
      try {
        const libraries = await ensureLibraries();
        const movieLib = libraryIdFor(libraries, 'movies');
        const seriesLib = libraryIdFor(libraries, 'series');
        const [resume, nextUp, latestMovies, latestSeries] = await Promise.all([
          videoService.getResume(),
          videoService.getNextUp(),
          movieLib
            ? videoService
                .getItems({
                  parentId: movieLib,
                  includeTypes: 'Movie',
                  sortBy: 'DateCreated',
                  sortOrder: 'Descending',
                  limit: RAIL_LIMIT,
                })
                .then((r) => r.items)
            : Promise.resolve([]),
          seriesLib
            ? videoService
                .getItems({
                  parentId: seriesLib,
                  includeTypes: 'Series',
                  sortBy: 'DateCreated',
                  sortOrder: 'Descending',
                  limit: RAIL_LIMIT,
                })
                .then((r) => r.items)
            : Promise.resolve([]),
        ]);
        set({ resume, nextUp, latestMovies, latestSeries, unavailable: false });
      } catch (err) {
        handleError(err, 'Could not load video home');
      } finally {
        set({ loadingHome: false });
      }
    },

    // ─── Movies / Series listings ──────────────────────

    loadListing: async (kind, opts) => {
      const listing = get()[kind];
      if (listing.loading) return;
      const reset = opts?.reset ?? false;
      const offset = reset ? 0 : listing.offset;
      set({ [kind]: { ...listing, loading: true } } as Partial<VideoState>);
      try {
        const libraries = await ensureLibraries();
        const { items, total } = await videoService.getItems({
          parentId: libraryIdFor(libraries, kind),
          includeTypes: kind === 'movies' ? 'Movie' : 'Series',
          sortBy: listing.sortBy,
          sortOrder: listing.sortOrder,
          limit: PAGE_SIZE,
          offset,
        });
        const merged = reset ? items : [...listing.items, ...items];
        set({
          [kind]: {
            ...get()[kind],
            items: merged,
            total,
            offset: offset + items.length,
            hasMore: merged.length < total && items.length > 0,
            loading: false,
          },
          unavailable: false,
        } as Partial<VideoState>);
      } catch (err) {
        set({ [kind]: { ...get()[kind], loading: false } } as Partial<VideoState>);
        handleError(err, `Could not load ${kind}`);
      }
    },

    loadMore: async (kind) => {
      if (!get()[kind].hasMore) return;
      await get().loadListing(kind);
    },

    setSort: (kind, sortBy) => {
      const listing = get()[kind];
      if (listing.sortBy === sortBy) return;
      set({
        [kind]: { ...emptyListing(sortBy, defaultOrderFor(sortBy)) },
      } as Partial<VideoState>);
      void get().loadListing(kind, { reset: true });
    },

    // ─── Search ────────────────────────────────────────

    runSearch: async (q) => {
      set({ loadingSearch: true });
      try {
        const items = await videoService.search(q, get().aiSearch);
        // Ignore stale responses (the query moved on while we were fetching).
        if (get().search.trim() === q) {
          set({ searchResults: items, unavailable: false });
        }
      } catch (err) {
        handleError(err, 'Search failed');
      } finally {
        set({ loadingSearch: false });
      }
    },

    // ─── Detail ────────────────────────────────────────

    openItem: async (id) => {
      set({ loadingDetail: true });
      try {
        const item = await videoService.getItem(id);
        let seasons: VideoItem[] | null = null;
        if (item.type === 'Series') {
          seasons = await videoService.getChildren(item.id);
        }
        set({ selectedItem: item, seasons, episodesBySeason: {} });
      } catch (err) {
        handleError(err, 'Could not load item');
      } finally {
        set({ loadingDetail: false });
      }
    },

    loadSeasonEpisodes: async (seasonId) => {
      const { episodesBySeason, selectedItem, loadingEpisodes } = get();
      if (episodesBySeason[seasonId] || loadingEpisodes === seasonId) return;
      set({ loadingEpisodes: seasonId });
      try {
        const episodes = await videoService.getChildren(seasonId, selectedItem?.id);
        set({ episodesBySeason: { ...get().episodesBySeason, [seasonId]: episodes } });
      } catch (err) {
        handleError(err, 'Could not load episodes');
      } finally {
        if (get().loadingEpisodes === seasonId) set({ loadingEpisodes: null });
      }
    },

    closeDetail: () => {
      set({ selectedItem: null, seasons: null, episodesBySeason: {} });
    },

    // ─── Requests (Jellyseerr) ─────────────────────────

    loadDiscover: async (q) => {
      if (!q.trim()) {
        set({ discoverResults: null, loadingDiscover: false });
        return;
      }
      set({ loadingDiscover: true });
      try {
        const results = await videoService.discover(q.trim());
        set({
          discoverResults: results.filter((r) => r.media_type !== 'person'),
          jellyseerrUnavailable: false,
        });
      } catch (err) {
        handleSeerrError(err, 'Discover search failed');
      } finally {
        set({ loadingDiscover: false });
      }
    },

    loadRequests: async () => {
      if (get().loadingRequests) return;
      set({ loadingRequests: true });
      try {
        const requests = await videoService.listRequests();
        set({ requests, jellyseerrUnavailable: false });
      } catch (err) {
        handleSeerrError(err, 'Could not load requests');
      } finally {
        set({ loadingRequests: false });
      }
    },

    submitRequest: async (body) => {
      set({ requesting: true });
      try {
        await videoService.createRequest(body);
        toast.success('Request submitted');
        void get().loadRequests();
        return true;
      } catch (err) {
        handleSeerrError(err, 'Could not submit request');
        return false;
      } finally {
        set({ requesting: false });
      }
    },

    // ─── Player ────────────────────────────────────────

    play: (item) => {
      set({ playingItem: item });
    },

    closePlayer: () => {
      set({ playingItem: null });
      // Positions/played flags changed server-side — refresh what we show.
      void (async () => {
        try {
          const [resume, nextUp] = await Promise.all([
            videoService.getResume(),
            videoService.getNextUp(),
          ]);
          set({ resume, nextUp });
          const selected = get().selectedItem;
          if (selected) {
            const item = await videoService.getItem(selected.id);
            set({ selectedItem: item, episodesBySeason: {} });
          }
        } catch {
          /* best-effort refresh */
        }
      })();
    },
  };
});
