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
  audioCoverUrl,
  booksService,
  type AudioItem,
  type AudioItemDetail,
  type AudioTrack,
  type Book,
  type BooksStatus,
} from '@/services/books.service';
import { usePlayerStore, type PlayableItem } from '@/stores/player.store';

export type BooksTab = 'library' | 'audiobooks' | 'manage';

/** The book currently open in the fullscreen ReaderView overlay. */
export interface ReadingBook {
  id: string;
  title: string;
}

interface BooksState {
  activeTab: BooksTab;
  search: string;
  /** Búsqueda en lenguaje natural (Fase 5 Slice A). */
  aiSearch: boolean;
  /** Resultados semánticos (sólo cuando aiSearch+query); null = filtro local. */
  aiResults: Book[] | null;
  loadingSearch: boolean;
  status: BooksStatus | null;

  // Library (EPUBs)
  books: Book[];
  booksLoaded: boolean;
  loadingBooks: boolean;
  /** Non-null while the ReaderView overlay is open. */
  readingBook: ReadingBook | null;

  // Audiobooks (Audiobookshelf)
  audioItems: AudioItem[];
  audioLoaded: boolean;
  loadingAudio: boolean;
  selectedAudiobook: AudioItemDetail | null;
  loadingAudioDetail: boolean;
  /** Audiobookshelf not usable right now (not installed OR not running). */
  absUnavailable: boolean;
  /** ABS on-demand start in progress. */
  absStarting: boolean;
  /** Last ABS start error (timeout / RAM budget / etc.), null while OK. */
  absStartError: string | null;

  /** Full playable queue of the audiobook currently in the player (chapter jumps). */
  audioQueue: PlayableItem[];
  playingAudiobookId: string | null;

  // Actions
  setActiveTab: (tab: BooksTab) => void;
  setSearch: (q: string) => void;
  toggleAiSearch: () => void;
  runSearch: (q: string) => Promise<void>;
  loadStatus: () => Promise<void>;
  /** Refresh ABS status and, if installed-but-stopped, auto-start + poll then load. */
  ensureAbsRunning: () => Promise<void>;
  /** Start Audiobookshelf on-demand and poll until running (fast transition). */
  startAbsAndWait: () => Promise<void>;
  loadBooks: () => Promise<void>;
  openBook: (book: ReadingBook) => void;
  closeBook: () => void;
  loadAudio: () => Promise<void>;
  openAudiobook: (id: string, opts?: { autoplay?: boolean }) => Promise<void>;
  closeAudiobook: () => void;
  /** Open an ABS play session and start the global player (resume position by default). */
  playAudiobook: (detail: AudioItemDetail, startAtSeconds?: number) => Promise<void>;
  /** Jump to an absolute position (seconds within the whole book), e.g. a chapter start. */
  jumpToPosition: (detail: AudioItemDetail, seconds: number) => Promise<void>;
}

function isAbsUnavailableError(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'ABS_UNAVAILABLE' || err.status === 503);
}

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Poll cadence + cap while a container boots (fast so the UI flips ASAP). */
const START_POLL_MS = 1000;
const START_TIMEOUT_MS = 90_000;

/** Map an ABS track to the global player's PlayableItem. */
function trackToPlayable(
  detail: AudioItemDetail,
  sessionId: string,
  track: AudioTrack,
): PlayableItem {
  return {
    fileId: `${detail.id}:${track.index}`,
    sourceId: sessionId,
    source: 'abs',
    title: detail.title,
    artist: detail.author ?? undefined,
    streamUrl: track.content_url ?? '',
    mediaType: 'audio',
    coverUrl: audioCoverUrl(detail.id),
    durationSec: track.duration,
    trackStartOffset: track.start_offset,
  };
}

/**
 * Start the global player at an absolute book position. The queue passed to
 * playAudio is the remainder from the containing track (music playTracks
 * pattern — playAudio resets queueIndex to 0), then we seek within the track
 * once the audio element knows its duration.
 */
function startQueueAt(queue: PlayableItem[], globalSeconds: number): void {
  if (queue.length === 0) return;
  const found = queue.findIndex((q) => {
    const start = q.trackStartOffset ?? 0;
    const dur = q.durationSec ?? 0;
    return globalSeconds >= start && globalSeconds < start + dur;
  });
  // found < 0 → position beyond the end (finished) or unknown — restart at 0.
  const idx = found < 0 ? 0 : found;
  const item = queue[idx];
  if (!item) return; // unreachable: idx siempre está en [0, queue.length)
  const offset = found < 0 ? 0 : globalSeconds - (item.trackStartOffset ?? 0);
  usePlayerStore.getState().playAudio(item, queue.slice(idx));
  if (offset > 1) seekWhenReady(item.fileId, offset);
}

/**
 * One-shot: seek once the NEW source is ready. `isLoading` flips false only
 * on the new source's 'canplay' (playAudio sets it true synchronously), so
 * waiting for it avoids seeking the singleton audio element while it still
 * holds the previous track.
 */
function seekWhenReady(fileId: string, offset: number): void {
  let done = false;
  const unsub = usePlayerStore.subscribe((s) => {
    if (done) return;
    if (s.currentItem?.fileId !== fileId) {
      done = true;
      unsub();
      return;
    }
    if (s.duration > 0 && !s.isLoading) {
      done = true;
      usePlayerStore.getState().seek(offset);
      unsub();
    }
  });
  setTimeout(() => {
    if (!done) {
      done = true;
      unsub();
    }
  }, 30_000);
}

export const useBooksStore = create<BooksState>()((set, get) => ({
  activeTab: 'library',
  search: '',
  aiSearch: false,
  aiResults: null,
  loadingSearch: false,
  status: null,

  books: [],
  booksLoaded: false,
  loadingBooks: false,
  readingBook: null,

  audioItems: [],
  audioLoaded: false,
  loadingAudio: false,
  selectedAudiobook: null,
  loadingAudioDetail: false,
  absUnavailable: false,
  absStarting: false,
  absStartError: null,

  audioQueue: [],
  playingAudiobookId: null,

  // ─── Navigation ────────────────────────────────────────

  setActiveTab: (tab) => {
    set({ activeTab: tab, selectedAudiobook: null });
  },

  setSearch: (q) => {
    set({ search: q });
    if (get().aiSearch && q.trim()) {
      void get().runSearch(q.trim());
    } else if (!q.trim()) {
      set({ aiResults: null });
    }
  },

  toggleAiSearch: () => {
    const next = !get().aiSearch;
    set({ aiSearch: next, aiResults: null });
    const q = get().search.trim();
    if (next && q) void get().runSearch(q);
  },

  runSearch: async (q) => {
    set({ loadingSearch: true });
    try {
      const results = await booksService.searchBooks(q, get().aiSearch);
      if (get().search.trim() === q) set({ aiResults: results });
    } catch (err) {
      toast.error(errMessage(err, 'Search failed'));
    } finally {
      set({ loadingSearch: false });
    }
  },

  // ─── Loads ─────────────────────────────────────────────

  loadStatus: async () => {
    try {
      const status = await booksService.status();
      set({
        status,
        // Pre-flag so the Audiobooks tab shows the friendly state instantly.
        absUnavailable: !(status.abs.installed && status.abs.running),
      });
    } catch {
      /* non-blocking — views degrade on their own */
    }
  },

  ensureAbsRunning: async () => {
    await get().loadStatus();
    const abs = get().status?.abs;
    // Installed but stopped → start it on-demand (no admin/Servarr detour).
    if (abs && abs.installed && !abs.running && !get().absStarting) {
      await get().startAbsAndWait();
    } else {
      void get().loadAudio();
    }
  },

  startAbsAndWait: async () => {
    if (get().absStarting) return;
    set({ absStarting: true, absStartError: null });
    try {
      let st = await booksService.startAbs();
      const deadline = Date.now() + START_TIMEOUT_MS;
      while (!st.running && Date.now() < deadline) {
        await sleep(START_POLL_MS);
        const full = await booksService.status();
        set({ status: full });
        st = { installed: full.abs.installed, running: full.abs.running };
      }
      if (st.running) {
        set({ absStarting: false, absUnavailable: false });
        await get().loadAudio();
      } else {
        set({ absStarting: false, absStartError: 'Audiobookshelf tardó demasiado en arrancar' });
      }
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      set({
        absStarting: false,
        absStartError: code === 'NOT_INSTALLED' ? null : errMessage(err, 'No se pudo arrancar Audiobookshelf'),
      });
    }
  },

  loadBooks: async () => {
    if (get().loadingBooks) return;
    set({ loadingBooks: true });
    try {
      const books = await booksService.listBooks();
      set({ books, booksLoaded: true });
    } catch (err) {
      toast.error(errMessage(err, 'Could not load the book library'));
    } finally {
      set({ loadingBooks: false });
    }
  },

  openBook: (book) => set({ readingBook: book }),

  closeBook: () => {
    set({ readingBook: null });
    // Refresh so 'Continue reading' picks up the progress saved by the reader.
    void get().loadBooks();
  },

  loadAudio: async () => {
    if (get().loadingAudio) return;
    set({ loadingAudio: true });
    try {
      const items = await booksService.listAudio();
      set({ audioItems: items, audioLoaded: true, absUnavailable: false });
    } catch (err) {
      if (isAbsUnavailableError(err)) {
        set({ absUnavailable: true, audioLoaded: true });
      } else {
        toast.error(errMessage(err, 'Could not load audiobooks'));
      }
    } finally {
      set({ loadingAudio: false });
    }
  },

  openAudiobook: async (id, opts) => {
    set({ loadingAudioDetail: true });
    try {
      const detail = await booksService.getAudioItem(id);
      set({ selectedAudiobook: detail, absUnavailable: false });
      if (opts?.autoplay) {
        void get().playAudiobook(detail);
      }
    } catch (err) {
      if (isAbsUnavailableError(err)) {
        set({ absUnavailable: true });
      } else {
        toast.error(errMessage(err, 'Could not load the audiobook'));
      }
    } finally {
      set({ loadingAudioDetail: false });
    }
  },

  closeAudiobook: () => set({ selectedAudiobook: null }),

  // ─── Playback ──────────────────────────────────────────

  playAudiobook: async (detail, startAtSeconds) => {
    try {
      const session = await booksService.playAudio(detail.id);
      const sourceTracks = session.tracks.length > 0 ? session.tracks : detail.tracks;
      const playable = sourceTracks.filter((t) => !!t.content_url);
      if (playable.length === 0) {
        toast.error('This audiobook has no playable tracks');
        return;
      }
      const queue = playable.map((t) => trackToPlayable(detail, session.session_id, t));
      set({ audioQueue: queue, playingAudiobookId: detail.id });
      const startTime =
        typeof startAtSeconds === 'number' ? startAtSeconds : session.current_time || 0;
      startQueueAt(queue, startTime);
    } catch (err) {
      if (isAbsUnavailableError(err)) {
        set({ absUnavailable: true });
      } else {
        toast.error(errMessage(err, 'Could not start playback'));
      }
    }
  },

  jumpToPosition: async (detail, seconds) => {
    const { audioQueue, playingAudiobookId } = get();
    const player = usePlayerStore.getState();
    const playingThis =
      playingAudiobookId === detail.id &&
      player.currentItem?.source === 'abs' &&
      player.currentItem.fileId.startsWith(`${detail.id}:`) &&
      audioQueue.length > 0;

    if (!playingThis) {
      await get().playAudiobook(detail, seconds);
      return;
    }

    const current = player.currentItem!;
    const curStart = current.trackStartOffset ?? 0;
    const curDur = current.durationSec ?? player.duration ?? 0;
    if (seconds >= curStart && seconds < curStart + curDur) {
      // Same track — plain seek.
      player.seek(seconds - curStart);
      if (!player.isPlaying) player.resume();
      return;
    }
    // Different track — restart the queue from there (same ABS session).
    startQueueAt(audioQueue, seconds);
  },
}));

// ─── ABS sync watcher ────────────────────────────────────
//
// Module-level subscription on the player store (initScrobbleWatcher
// pattern in music.store). Initialized once from BooksPage. While an
// 'abs' item is playing it POSTs a progress sync every 15s with the
// absolute book position (trackStartOffset + element currentTime) and
// the real wall-clock listened delta; when the player moves away from
// the ABS session (stop, other media, other book) it closes the session
// with the final position.

const ABS_SYNC_INTERVAL_MS = 15_000;

let absSyncWatcherStarted = false;

export function initAbsSyncWatcher(): void {
  if (absSyncWatcherStarted) return;
  absSyncWatcherStarted = true;

  let timer: ReturnType<typeof setInterval> | null = null;
  let lastTickAt: number | null = null;

  const syncNow = () => {
    const s = usePlayerStore.getState();
    const item = s.currentItem;
    if (!item || item.source !== 'abs' || !item.sourceId || !s.isPlaying) return;
    const now = Date.now();
    const listened = lastTickAt ? Math.max(0, (now - lastTickAt) / 1000) : 0;
    lastTickAt = now;
    booksService
      .syncSession(item.sourceId, {
        current_time: (item.trackStartOffset ?? 0) + s.currentTime,
        time_listened: Math.round(listened),
      })
      .catch(() => { /* best-effort */ });
  };

  const startTimer = () => {
    if (timer) return;
    lastTickAt = Date.now();
    timer = setInterval(syncNow, ABS_SYNC_INTERVAL_MS);
  };

  const stopTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    lastTickAt = null;
  };

  usePlayerStore.subscribe((state, prev) => {
    const item = state.currentItem;
    const prevItem = prev.currentItem;
    const sessionId = item?.source === 'abs' ? (item.sourceId ?? null) : null;
    const prevSessionId = prevItem?.source === 'abs' ? (prevItem.sourceId ?? null) : null;

    // Moved away from an ABS session (stop / other media / other book) — close it.
    if (prevSessionId && prevSessionId !== sessionId) {
      stopTimer();
      const closeTime = (prevItem!.trackStartOffset ?? 0) + prev.currentTime;
      booksService
        .closeSession(prevSessionId, { current_time: closeTime })
        .catch(() => { /* best-effort */ });
      if (!sessionId) {
        useBooksStore.setState({ playingAudiobookId: null, audioQueue: [] });
      }
    }

    // The 15s sync timer runs only while an ABS item is actively playing.
    if (sessionId && state.isPlaying) startTimer();
    else stopTimer();
  });
}
