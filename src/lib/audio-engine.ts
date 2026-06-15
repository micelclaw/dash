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

/**
 * AudioEngine — Singleton HTMLAudioElement manager.
 * Lives for the entire Dash session. Connects to PlayerStore for state sync.
 */

import { usePlayerStore } from '@/stores/player.store';
import { useAuthStore } from '@/stores/auth.store';
import { coverSrc } from '@/components/player/cover-src';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

class AudioEngine {
  private audio: HTMLAudioElement;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.audio.addEventListener('timeupdate', () => {
      usePlayerStore.getState().setCurrentTime(this.audio.currentTime);
    });
    this.audio.addEventListener('ended', () => {
      usePlayerStore.getState().playNext();
    });
    this.audio.addEventListener('loadedmetadata', () => {
      usePlayerStore.getState().setDuration(this.audio.duration);
    });
    this.audio.addEventListener('error', () => {
      usePlayerStore.getState().setError('Playback error');
    });
    this.audio.addEventListener('canplay', () => {
      usePlayerStore.getState().setLoading(false);
    });
  }

  play(streamUrl: string): void {
    const token = useAuthStore.getState().tokens?.accessToken;
    const sep = streamUrl.includes('?') ? '&' : '?';
    const url = streamUrl.startsWith('http')
      ? `${streamUrl}${sep}token=${token}`
      : `${BASE_URL}/api/v1${streamUrl}${sep}token=${token}`;
    this.audio.src = url;
    this.audio.play().catch(() => {/* autoplay may be blocked */});
    this.updateMediaSession();
  }

  /**
   * Sync OS-level media controls (lock screen, media keys, BT headsets)
   * with the item that just started playing.
   */
  private updateMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    const item = usePlayerStore.getState().currentItem;
    if (!item) return;

    const art = coverSrc(item);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.title,
      artist: item.artist || '',
      album: item.album || '',
      artwork: art ? [{ src: art, sizes: '512x512' }] : [],
    });

    navigator.mediaSession.setActionHandler('play', () => usePlayerStore.getState().resume());
    navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => usePlayerStore.getState().playPrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => usePlayerStore.getState().playNext());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) usePlayerStore.getState().seek(details.seekTime);
    });
  }

  pause(): void {
    this.audio.pause();
  }

  resume(): void {
    this.audio.play().catch(() => {});
  }

  seek(time: number): void {
    this.audio.currentTime = time;
  }

  setVolume(vol: number): void {
    this.audio.volume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Playback speed. Sets defaultPlaybackRate too so the rate survives
   * src changes (the media load algorithm resets playbackRate to it).
   */
  setRate(rate: number): void {
    const r = Math.max(0.25, Math.min(4, rate || 1));
    this.audio.defaultPlaybackRate = r;
    this.audio.playbackRate = r;
  }

  setMuted(muted: boolean): void {
    this.audio.muted = muted;
  }

  stop(): void {
    this.audio.pause();
    this.audio.src = '';
    this.audio.currentTime = 0;
  }

  get isPlaying(): boolean {
    return !this.audio.paused;
  }

  get currentTime(): number {
    return this.audio.currentTime;
  }

  get duration(): number {
    return this.audio.duration || 0;
  }
}

export const audioEngine = new AudioEngine();
