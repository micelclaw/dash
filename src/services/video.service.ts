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
 * Video service — thin wrapper over the Core video API (`/api/v1/video/*`),
 * which proxies a local Jellyfin instance (library, playback, images) plus an
 * optional Jellyseerr instance (discover / media requests).
 *
 * All responses are snake_case on the wire (case-transform plugin in Core).
 */

import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// ─── Wire types (snake_case) ─────────────────────────────

export type VideoItemType = 'Movie' | 'Series' | 'Season' | 'Episode';
export type VideoSortBy = 'SortName' | 'DateCreated' | 'CommunityRating';
export type VideoSortOrder = 'Ascending' | 'Descending';

export interface VideoStatus {
  installed: boolean;
  running: boolean;
  jellyseerr_available: boolean;
}

export interface VideoLibrary {
  id: string;
  name: string;
  /** 'movies' | 'tvshows' */
  collection_type: string;
}

export interface VideoUserData {
  played: boolean;
  played_percentage?: number;
  position_seconds: number;
}

export interface VideoItem {
  id: string;
  name: string;
  type: VideoItemType;
  overview?: string;
  year?: number;
  runtime_seconds?: number;
  community_rating?: number;
  official_rating?: string;
  genres?: string[];
  primary_image_tag?: string;
  backdrop_image_tag?: string;
  series_id?: string;
  series_name?: string;
  season_id?: string;
  season_name?: string;
  index_number?: number;
  parent_index_number?: number;
  user_data: VideoUserData;
}

export interface VideoChapter {
  name: string;
  start_seconds: number;
}

export interface VideoPerson {
  name: string;
  role?: string;
  type?: string;
}

export type VideoItemDetail = VideoItem & {
  media_sources?: Array<Record<string, unknown>>;
  chapters?: VideoChapter[];
  people?: VideoPerson[];
};

export interface AudioStreamInfo {
  index: number;
  language?: string;
  title?: string;
  codec?: string;
  is_default?: boolean;
}

export interface SubtitleStreamInfo {
  index: number;
  language?: string;
  title?: string;
  codec?: string;
  is_external?: boolean;
  /** OUR proxy `/video/subtitles/...` URL when the track is VTT-deliverable. */
  delivery_url?: string;
}

export interface MediaSourceInfo {
  id: string;
  container: string;
  direct_play: boolean;
  /** OUR proxy URL, relative ('/video/stream/...' or '/video/hls/...'). */
  stream_url: string;
  audio_streams: AudioStreamInfo[];
  subtitle_streams: SubtitleStreamInfo[];
}

export interface PlaybackInfoResult {
  play_session_id: string;
  media_source: MediaSourceInfo;
}

export interface PlaybackInfoBody {
  item_id: string;
  /** Jellyfin DeviceProfile JSON — passed through to Items/{id}/PlaybackInfo. */
  device_profile: Record<string, unknown>;
  start_position_seconds?: number;
  audio_stream_index?: number;
  subtitle_stream_index?: number;
  media_source_id?: string;
}

export type PlayingReportKind = 'start' | 'progress' | 'stopped';

export interface PlayingReportBody {
  item_id: string;
  media_source_id: string;
  play_session_id: string;
  position_seconds: number;
  is_paused?: boolean;
  audio_stream_index?: number;
  subtitle_stream_index?: number;
}

// ─── Jellyseerr (discover / requests) ────────────────────

export interface DiscoverResult {
  /** TMDB id. */
  id: number;
  media_type: 'movie' | 'tv' | 'person';
  /** Movies use `title`, TV uses `name`. */
  title?: string;
  name?: string;
  overview?: string;
  /** TMDB poster path ('/abc.jpg'). */
  poster_path?: string;
  release_date?: string;
  first_air_date?: string;
  media_info?: { status?: number } | null;
}

/** Jellyseerr request status: 1=pending, 2=approved, 3=declined. */
export const REQUEST_STATUS = { pending: 1, approved: 2, declined: 3 } as const;
/** Jellyseerr media status: 5 = available in the library. */
export const MEDIA_STATUS_AVAILABLE = 5;

export interface MediaRequest {
  id: number;
  status: number;
  created_at?: string;
  media?: {
    media_type?: 'movie' | 'tv';
    tmdb_id?: number;
    status?: number;
    title?: string;
  };
}

// ─── URL helpers ─────────────────────────────────────────

/**
 * Authenticated image URL for `<img src>`. The auth plugin accepts
 * `?token=<jwt>` for media elements (same pattern as music coverUrl).
 */
export function imageUrl(
  itemId: string,
  opts?: { type?: 'Primary' | 'Backdrop' | 'Thumb'; maxWidth?: number; tag?: string },
): string {
  const token = useAuthStore.getState().tokens?.accessToken ?? '';
  const qs = new URLSearchParams();
  if (opts?.type) qs.set('type', opts.type);
  if (opts?.maxWidth) qs.set('max_width', String(opts.maxWidth));
  if (opts?.tag) qs.set('tag', opts.tag);
  qs.set('token', token);
  return `${BASE_URL}/api/v1/video/image/${encodeURIComponent(itemId)}?${qs.toString()}`;
}

// ─── API wrappers ────────────────────────────────────────

export const videoService = {
  async getStatus(): Promise<VideoStatus> {
    const res = await api.get<{ data: VideoStatus }>('/video/status');
    return res.data;
  },

  /** On-demand start of the shared Jellyfin container (user-accessible). */
  async start(): Promise<VideoStatus> {
    const res = await api.post<{ data: VideoStatus }>('/video/start');
    return res.data;
  },

  async getLibraries(): Promise<VideoLibrary[]> {
    const res = await api.get<{ data: { libraries: VideoLibrary[] } }>('/video/libraries');
    return res.data.libraries;
  },

  async getItems(opts?: {
    parentId?: string;
    /** Comma-separated, e.g. 'Movie,Series'. */
    includeTypes?: string;
    search?: string;
    sortBy?: VideoSortBy;
    sortOrder?: VideoSortOrder;
    limit?: number;
    offset?: number;
  }): Promise<{ items: VideoItem[]; total: number }> {
    const res = await api.get<{ data: { items: VideoItem[]; total: number } }>('/video/items', {
      parent_id: opts?.parentId,
      include_types: opts?.includeTypes,
      search: opts?.search,
      sort_by: opts?.sortBy,
      sort_order: opts?.sortOrder,
      limit: opts?.limit,
      offset: opts?.offset,
    });
    return res.data;
  },

  /** Natural-language search (Fase 5 Slice A). semantic=false → keyword. */
  async search(q: string, semantic: boolean, limit = 60): Promise<VideoItem[]> {
    const res = await api.get<{ data: { items: VideoItem[]; total: number } }>('/video/search', {
      q, limit, ...(semantic ? { semantic: '1' } : {}),
    });
    return res.data.items;
  },

  async getResume(): Promise<VideoItem[]> {
    const res = await api.get<{ data: { items: VideoItem[] } }>('/video/resume');
    return res.data.items;
  },

  async getNextUp(): Promise<VideoItem[]> {
    const res = await api.get<{ data: { items: VideoItem[] } }>('/video/next-up');
    return res.data.items;
  },

  async getItem(id: string): Promise<VideoItemDetail> {
    const res = await api.get<{ data: { item: VideoItemDetail } }>(
      `/video/item/${encodeURIComponent(id)}`,
    );
    return res.data.item;
  },

  /** Series -> seasons; Season -> episodes (pass `seriesId` for seasons). */
  async getChildren(id: string, seriesId?: string): Promise<VideoItem[]> {
    const res = await api.get<{ data: { items: VideoItem[] } }>(
      `/video/item/${encodeURIComponent(id)}/children`,
      { series_id: seriesId },
    );
    return res.data.items;
  },

  async playbackInfo(body: PlaybackInfoBody): Promise<PlaybackInfoResult> {
    const res = await api.post<{ data: PlaybackInfoResult }>('/video/playback-info', body);
    return res.data;
  },

  /**
   * Playback session reporting. `stopped` MUST be sent when playback ends —
   * it tears down server-side transcodes and persists the resume position.
   */
  async reportPlaying(kind: PlayingReportKind, body: PlayingReportBody): Promise<void> {
    await api.post<void>(`/video/playing/${kind}`, body);
  },

  // ─── Jellyseerr ────────────────────────────────────────

  async discover(q: string): Promise<DiscoverResult[]> {
    const res = await api.get<{ data: { results: DiscoverResult[] } }>('/video/discover', { q });
    return res.data.results;
  },

  async createRequest(body: {
    media_type: 'movie' | 'tv';
    tmdb_id: number;
    seasons?: number[];
  }): Promise<void> {
    await api.post<unknown>('/video/request', body);
  },

  async listRequests(): Promise<MediaRequest[]> {
    const res = await api.get<{ data: { requests: MediaRequest[] } }>('/video/requests');
    return res.data.requests;
  },
};
