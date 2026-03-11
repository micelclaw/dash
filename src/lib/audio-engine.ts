/**
 * AudioEngine — Singleton HTMLAudioElement manager.
 * Lives for the entire Dash session. Connects to PlayerStore for state sync.
 */

import { usePlayerStore } from '@/stores/player.store';
import { useAuthStore } from '@/stores/auth.store';

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
