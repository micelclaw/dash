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

import { toast } from 'sonner';
import { usePlayerStore, type PlayableItem } from '@/stores/player.store';
import { coverUrl, musicService, type Track } from '@/services/music.service';

/** Map a Navidrome track to the global player's PlayableItem. */
export function trackToPlayable(track: Track): PlayableItem {
  return {
    fileId: track.id,
    sourceId: track.id,
    source: 'navidrome',
    title: track.title,
    artist: track.artist,
    album: track.album,
    streamUrl: `/music/stream/${track.id}`,
    mediaType: 'audio',
    coverUrl: track.cover_art ? coverUrl(track.cover_art) : undefined,
    durationSec: track.duration,
  };
}

/**
 * Play a list of tracks starting at `startIndex`. The queue is the remainder
 * of the list (playAudio resets queueIndex to 0).
 */
export function playTracks(tracks: Track[], startIndex = 0): void {
  const queue = tracks.slice(startIndex).map(trackToPlayable);
  if (queue.length === 0) return;
  usePlayerStore.getState().playAudio(queue[0], queue);
}

/** Fisher–Yates shuffle, then play. */
export function shufflePlayTracks(tracks: Track[]): void {
  const shuffled = [...tracks];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  playTracks(shuffled);
}

/** Fetch an album's tracks and play them all (cover hover-play action). */
export async function playAlbumById(albumId: string): Promise<void> {
  try {
    const album = await musicService.getAlbum(albumId);
    playTracks(album.tracks);
  } catch {
    toast.error('Could not play album');
  }
}

/** Fetch a playlist's tracks and play them all. */
export async function playPlaylistById(playlistId: string): Promise<void> {
  try {
    const { tracks } = await musicService.getPlaylist(playlistId);
    playTracks(tracks);
  } catch {
    toast.error('Could not play playlist');
  }
}

/** Insert a track right after the currently playing queue position. */
export function playTrackNext(track: Track): void {
  const item = trackToPlayable(track);
  usePlayerStore.setState((s) => {
    if (s.queue.length === 0 || s.queueIndex < 0) {
      return { queue: [...s.queue, item] };
    }
    const at = s.queueIndex + 1;
    return { queue: [...s.queue.slice(0, at), item, ...s.queue.slice(at)] };
  });
}

/** Append a track to the end of the play queue. */
export function addTrackToQueue(track: Track): void {
  usePlayerStore.getState().addToQueue(trackToPlayable(track));
}
