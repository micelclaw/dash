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
 * Music service — thin wrapper over the Core music API (`/api/v1/music/*`),
 * which proxies a local Navidrome instance via the Subsonic API.
 *
 * All responses are snake_case on the wire (case-transform plugin in Core).
 */

import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// ─── Wire types (snake_case) ─────────────────────────────

export type AlbumListType =
  | 'newest'
  | 'recent'
  | 'frequent'
  | 'random'
  | 'starred'
  | 'alphabeticalByName';

export interface MusicStatus {
  installed: boolean;
  running: boolean;
}

export interface AlbumSummary {
  id: string;
  name: string;
  artist: string;
  artist_id: string;
  cover_art: string;
  song_count: number;
  duration: number;
  year?: number;
}

export interface Track {
  id: string;
  title: string;
  album: string;
  album_id: string;
  artist: string;
  artist_id: string;
  duration: number;
  track?: number;
  cover_art: string;
  starred?: boolean;
}

export interface ArtistSummary {
  id: string;
  name: string;
  cover_art?: string;
  album_count?: number;
}

export interface Playlist {
  id: string;
  name: string;
  song_count: number;
  duration: number;
  cover_art?: string;
}

export type AlbumWithTracks = AlbumSummary & { tracks: Track[] };

export interface MusicSearchResults {
  artists: ArtistSummary[];
  albums: AlbumSummary[];
  tracks: Track[];
}

export type StarrableType = 'song' | 'album' | 'artist';

// ─── URL helpers ─────────────────────────────────────────

/**
 * Authenticated cover art URL for `<img src>`. The auth plugin accepts
 * `?token=<jwt>` for media elements (same pattern as audio-engine.ts).
 */
export function coverUrl(id: string, size = 300): string {
  const token = useAuthStore.getState().tokens?.accessToken ?? '';
  return `${BASE_URL}/api/v1/music/cover/${encodeURIComponent(id)}?size=${size}&token=${token}`;
}

// ─── API wrappers ────────────────────────────────────────

export const musicService = {
  async getStatus(): Promise<MusicStatus> {
    const res = await api.get<{ data: MusicStatus }>('/music/status');
    return res.data;
  },

  /** On-demand start of the shared Navidrome container (user-accessible). */
  async start(): Promise<MusicStatus> {
    const res = await api.post<{ data: MusicStatus }>('/music/start');
    return res.data;
  },

  async getAlbums(opts?: {
    type?: AlbumListType;
    size?: number;
    offset?: number;
  }): Promise<AlbumSummary[]> {
    const res = await api.get<{ data: { albums: AlbumSummary[] } }>('/music/albums', {
      type: opts?.type,
      size: opts?.size,
      offset: opts?.offset,
    });
    return res.data.albums;
  },

  async getAlbum(id: string): Promise<AlbumWithTracks> {
    const res = await api.get<{ data: { album: AlbumWithTracks } }>(
      `/music/albums/${encodeURIComponent(id)}`,
    );
    return res.data.album;
  },

  async getArtists(): Promise<ArtistSummary[]> {
    const res = await api.get<{ data: { artists: ArtistSummary[] } }>('/music/artists');
    return res.data.artists;
  },

  async getArtist(id: string): Promise<{ artist: ArtistSummary; albums: AlbumSummary[] }> {
    const res = await api.get<{ data: { artist: ArtistSummary; albums: AlbumSummary[] } }>(
      `/music/artists/${encodeURIComponent(id)}`,
    );
    return res.data;
  },

  async search(q: string, limit?: number, semantic?: boolean): Promise<MusicSearchResults> {
    const res = await api.get<{ data: MusicSearchResults }>('/music/search', {
      q, limit, ...(semantic ? { semantic: '1' } : {}),
    });
    return res.data;
  },

  async getStarred(): Promise<MusicSearchResults> {
    const res = await api.get<{ data: MusicSearchResults }>('/music/starred');
    return res.data;
  },

  async getPlaylists(): Promise<Playlist[]> {
    const res = await api.get<{ data: { playlists: Playlist[] } }>('/music/playlists');
    return res.data.playlists;
  },

  async getPlaylist(id: string): Promise<{ playlist: Playlist; tracks: Track[] }> {
    const res = await api.get<{ data: { playlist: Playlist; tracks: Track[] } }>(
      `/music/playlists/${encodeURIComponent(id)}`,
    );
    return res.data;
  },

  async createPlaylist(name: string, songIds?: string[]): Promise<{ id: string; name: string }> {
    const res = await api.post<{ data: { playlist: { id: string; name: string } } }>(
      '/music/playlists',
      { name, song_ids: songIds },
    );
    return res.data.playlist;
  },

  async updatePlaylist(
    id: string,
    changes: { name?: string; add_song_ids?: string[]; remove_indexes?: number[] },
  ): Promise<void> {
    await api.patch<void>(`/music/playlists/${encodeURIComponent(id)}`, changes);
  },

  async deletePlaylist(id: string): Promise<void> {
    await api.delete<void>(`/music/playlists/${encodeURIComponent(id)}`);
  },

  async scrobble(id: string, submission: boolean): Promise<void> {
    await api.post<void>('/music/scrobble', { id, submission });
  },

  async star(id: string, type: StarrableType): Promise<void> {
    await api.post<void>('/music/star', { id, type });
  },

  async unstar(id: string, type: StarrableType): Promise<void> {
    await api.post<void>('/music/unstar', { id, type });
  },
};
