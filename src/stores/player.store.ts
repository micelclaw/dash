import { create } from 'zustand';
import { api } from '@/services/api';

// ─── Types ───────────────────────────────────────────────

export interface PlayableItem {
  fileId: string;
  title: string;
  artist?: string;
  album?: string;
  coverBase64?: string;
  streamUrl: string;
  mediaType: 'audio' | 'video';
}

export interface MediaDownload {
  id: string;
  url: string;
  title: string | null;
  status: string;
  progress: number;
  format: string;
  file_id: string | null;
  error: string | null;
  created_at: string;
}

interface PlayerState {
  // Current playback
  currentItem: PlayableItem | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  volume: number;
  isMuted: boolean;

  // Saved audio state (when video overlay opens over playing audio)
  _savedAudioItem: PlayableItem | null;
  _savedAudioWasPlaying: boolean;

  // Queue
  queue: PlayableItem[];
  queueIndex: number;
  shuffle: boolean;
  repeat: 'none' | 'one' | 'all';

  // UI visibility
  miniPlayerVisible: boolean;
  videoOverlayVisible: boolean;
  queuePanelOpen: boolean;

  // Downloads
  downloads: MediaDownload[];

  // Playback actions
  playAudio: (item: PlayableItem, queue?: PlayableItem[]) => void;
  playVideo: (item: PlayableItem) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  playNext: () => void;
  playPrev: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;

  // Queue actions
  addToQueue: (item: PlayableItem) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  toggleQueuePanel: () => void;

  // Video
  closeVideoOverlay: () => void;

  // Downloads
  fetchDownloads: () => Promise<void>;
  startDownload: (url: string, format?: string) => Promise<void>;

  // Internal (called by AudioEngine events)
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setError: (msg: string) => void;
  setLoading: (loading: boolean) => void;
}

// ─── Store ───────────────────────────────────────────────

export const usePlayerStore = create<PlayerState>()((set, get) => {
  // Lazy import to avoid circular dependency at module load
  const getEngine = () => import('@/lib/audio-engine').then((m) => m.audioEngine);

  return {
    currentItem: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isLoading: false,
    error: null,
    volume: 0.8,
    isMuted: false,

    queue: [],
    queueIndex: -1,
    shuffle: false,
    repeat: 'none',

    miniPlayerVisible: false,
    videoOverlayVisible: false,
    queuePanelOpen: false,

    _savedAudioItem: null,
    _savedAudioWasPlaying: false,

    downloads: [],

    // ─── Playback ──────────────────────────────────────

    playAudio: (item, queue) => {
      set({
        currentItem: item,
        isPlaying: true,
        isLoading: true,
        error: null,
        miniPlayerVisible: true,
        videoOverlayVisible: false,
        ...(queue ? { queue, queueIndex: 0 } : {}),
      });
      getEngine().then((e) => {
        e.setVolume(get().volume);
        e.setMuted(get().isMuted);
        e.play(item.streamUrl);
      });
    },

    playVideo: (item) => {
      const { currentItem, isPlaying } = get();
      // Save current audio state before switching to video
      const wasAudio = currentItem?.mediaType === 'audio';
      getEngine().then((e) => e.pause());
      set({
        currentItem: item,
        isPlaying: true,
        isLoading: false,
        error: null,
        videoOverlayVisible: true,
        miniPlayerVisible: false,
        _savedAudioItem: wasAudio ? currentItem : null,
        _savedAudioWasPlaying: wasAudio && isPlaying,
      });
    },

    pause: () => {
      getEngine().then((e) => e.pause());
      set({ isPlaying: false });
    },

    resume: () => {
      const { currentItem } = get();
      if (!currentItem) return;
      if (currentItem.mediaType === 'audio') {
        getEngine().then((e) => e.resume());
      }
      set({ isPlaying: true });
    },

    stop: () => {
      getEngine().then((e) => e.stop());
      set({
        currentItem: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        miniPlayerVisible: false,
        videoOverlayVisible: false,
      });
    },

    playNext: () => {
      const { queue, queueIndex, repeat, shuffle } = get();
      if (queue.length === 0) {
        if (repeat === 'one') {
          const item = get().currentItem;
          if (item) getEngine().then((e) => e.play(item.streamUrl));
          return;
        }
        set({ isPlaying: false });
        return;
      }

      let nextIndex: number;
      if (repeat === 'one') {
        nextIndex = queueIndex;
      } else if (shuffle) {
        nextIndex = Math.floor(Math.random() * queue.length);
      } else {
        nextIndex = queueIndex + 1;
        if (nextIndex >= queue.length) {
          if (repeat === 'all') nextIndex = 0;
          else { set({ isPlaying: false }); return; }
        }
      }

      const next = queue[nextIndex];
      if (next) {
        set({ currentItem: next, queueIndex: nextIndex, isPlaying: true, isLoading: true, error: null });
        getEngine().then((e) => e.play(next.streamUrl));
      }
    },

    playPrev: () => {
      const { queue, queueIndex, currentTime } = get();
      // If more than 3 seconds in, restart current track
      if (currentTime > 3) {
        getEngine().then((e) => e.seek(0));
        return;
      }
      const prevIndex = queueIndex - 1;
      if (prevIndex < 0 || queue.length === 0) return;
      const prev = queue[prevIndex];
      if (prev) {
        set({ currentItem: prev, queueIndex: prevIndex, isPlaying: true, isLoading: true, error: null });
        getEngine().then((e) => e.play(prev.streamUrl));
      }
    },

    seek: (time) => {
      getEngine().then((e) => e.seek(time));
    },

    setVolume: (vol) => {
      getEngine().then((e) => e.setVolume(vol));
      set({ volume: vol, isMuted: false });
    },

    toggleMute: () => {
      const muted = !get().isMuted;
      getEngine().then((e) => e.setMuted(muted));
      set({ isMuted: muted });
    },

    toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),

    cycleRepeat: () => set((s) => ({
      repeat: s.repeat === 'none' ? 'all' : s.repeat === 'all' ? 'one' : 'none',
    })),

    // ─── Queue ─────────────────────────────────────────

    addToQueue: (item) => set((s) => ({ queue: [...s.queue, item] })),
    removeFromQueue: (index) => set((s) => ({
      queue: s.queue.filter((_, i) => i !== index),
    })),
    clearQueue: () => set({ queue: [], queueIndex: -1 }),
    toggleQueuePanel: () => set((s) => ({ queuePanelOpen: !s.queuePanelOpen })),

    // ─── Video ─────────────────────────────────────────

    closeVideoOverlay: () => {
      const { _savedAudioItem, _savedAudioWasPlaying } = get();
      if (_savedAudioItem) {
        // Restore previous audio state
        set({
          videoOverlayVisible: false,
          currentItem: _savedAudioItem,
          miniPlayerVisible: true,
          isPlaying: false,
          _savedAudioItem: null,
          _savedAudioWasPlaying: false,
        });
        // Auto-resume if audio was playing before video opened
        if (_savedAudioWasPlaying) {
          getEngine().then((e) => {
            e.resume();
            set({ isPlaying: true });
          });
        }
      } else {
        set({
          videoOverlayVisible: false,
          currentItem: null,
          isPlaying: false,
        });
      }
    },

    // ─── Downloads ─────────────────────────────────────

    fetchDownloads: async () => {
      try {
        const res = await api.get<{ data: MediaDownload[] }>('/media/downloads');
        set({ downloads: res.data });
      } catch { /* ignore */ }
    },

    startDownload: async (url, format) => {
      try {
        await api.post('/media/downloads', { url, format: format || 'best' });
        await get().fetchDownloads();
      } catch { /* ignore */ }
    },

    // ─── Internal ──────────────────────────────────────

    setCurrentTime: (t) => set({ currentTime: t }),
    setDuration: (d) => set({ duration: d }),
    setError: (msg) => set({ error: msg, isLoading: false }),
    setLoading: (loading) => set({ isLoading: loading }),
  };
});
