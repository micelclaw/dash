import { useEffect } from 'react';
import { usePlayerStore } from '@/stores/player.store';

/**
 * Integrates with the browser MediaSession API for OS-level media controls:
 * media keys on keyboard, lock screen, Bluetooth headphone buttons.
 */
export function useMediaKeys() {
  const currentItem = usePlayerStore((s) => s.currentItem);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentItem) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentItem.title,
      artist: currentItem.artist || '',
      album: currentItem.album || '',
      artwork: currentItem.coverBase64
        ? [{ src: currentItem.coverBase64, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    });

    navigator.mediaSession.setActionHandler('play', () => usePlayerStore.getState().resume());
    navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => usePlayerStore.getState().playPrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => usePlayerStore.getState().playNext());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) usePlayerStore.getState().seek(details.seekTime);
    });

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('seekto', null);
    };
  }, [currentItem, isPlaying]);
}
