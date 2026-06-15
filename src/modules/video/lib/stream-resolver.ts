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

/*
 * Adaptation notice (MPL-2.0)
 * ───────────────────────────
 * The playback resolution flow in this file (build device profile →
 * PlaybackInfo → direct-play vs HLS-transcode decision) is adapted from
 * concepts in Streamyfin's `getStreamUrl.ts`
 * (https://github.com/streamyfin/streamyfin), licensed under the Mozilla
 * Public License 2.0. This file is intentionally ISOLATED so the adapted
 * logic stays contained; the adapted portions remain available under
 * MPL-2.0. See THIRD_PARTY_NOTICES.md at the repo root.
 */

import { videoService, type MediaSourceInfo } from '@/services/video.service';
import { buildDeviceProfile } from './device-profile';

export type PlaybackKind = 'direct' | 'hls';

export interface ResolvePlaybackOptions {
  startPositionSeconds?: number;
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  mediaSourceId?: string;
}

export interface ResolvedPlayback {
  playSessionId: string;
  mediaSource: MediaSourceInfo;
  kind: PlaybackKind;
}

/**
 * Negotiate playback for an item: probe this browser's capabilities,
 * send them to Core (which forwards to Jellyfin's PlaybackInfo), and
 * classify the returned proxy URL as direct play or HLS transcode.
 */
export async function resolvePlayback(
  itemId: string,
  opts: ResolvePlaybackOptions = {},
): Promise<ResolvedPlayback> {
  const deviceProfile = buildDeviceProfile();

  const result = await videoService.playbackInfo({
    item_id: itemId,
    device_profile: deviceProfile,
    start_position_seconds: opts.startPositionSeconds,
    audio_stream_index: opts.audioStreamIndex,
    subtitle_stream_index: opts.subtitleStreamIndex,
    media_source_id: opts.mediaSourceId,
  });

  const mediaSource = result.media_source;
  if (!mediaSource?.stream_url) {
    throw new Error('No playable media source returned for this item');
  }

  // Core encodes its direct-vs-transcode decision in the proxy path
  // ('/video/stream/...' vs '/video/hls/...'). The URL is authoritative —
  // the direct_play flag is informative only, so mirror the path instead
  // of re-deriving the decision client-side.
  const kind: PlaybackKind = mediaSource.stream_url.startsWith('/video/hls') ? 'hls' : 'direct';

  return {
    playSessionId: result.play_session_id,
    mediaSource,
    kind,
  };
}
