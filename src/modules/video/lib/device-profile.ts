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
 * Device profile builder for Jellyfin playback negotiation.
 *
 * The profile tells Jellyfin's /Items/{id}/PlaybackInfo what THIS browser
 * can play natively (direct play) and what it should transcode to (HLS)
 * when the source doesn't fit. Capabilities are probed at call time with
 * `MediaSource.isTypeSupported` / `HTMLVideoElement.canPlayType`.
 *
 * Logic re-derived from first principles against the public Jellyfin
 * DeviceProfile schema. The codec probe strings are platform facts.
 * No GPL code was copied.
 *
 * NOTE: keys are PascalCase on purpose — this object is sent as the
 * `device_profile` field of POST /video/playback-info and Core passes it
 * through VERBATIM to Jellyfin (which expects its own casing).
 */

// ─── Jellyfin DeviceProfile types (PascalCase, wire-passthrough) ─────

export interface ProfileCondition {
  Condition: 'Equals' | 'NotEquals' | 'LessThanEqual' | 'GreaterThanEqual' | 'EqualsAny';
  Property: string;
  Value: string;
  IsRequired: boolean;
}

export interface DirectPlayProfile {
  Container: string;
  Type: 'Video' | 'Audio';
  VideoCodec?: string;
  AudioCodec?: string;
}

export interface TranscodingProfile {
  Container: string;
  Type: 'Video' | 'Audio';
  VideoCodec?: string;
  AudioCodec?: string;
  Context: 'Streaming' | 'Static';
  Protocol: 'hls' | 'http';
  MaxAudioChannels?: string;
  MinSegments?: number;
  BreakOnNonKeyFrames?: boolean;
}

export interface CodecProfile {
  Type: 'Video' | 'Audio' | 'VideoAudio';
  Codec?: string;
  Conditions: ProfileCondition[];
}

export interface SubtitleProfile {
  Format: string;
  Method: 'External' | 'Embed' | 'Encode' | 'Hls';
}

/**
 * Type alias (not interface) on purpose: aliases get an implicit index
 * signature, so the profile is assignable to the `device_profile:
 * Record<string, unknown>` passthrough field of PlaybackInfoBody.
 */
export type DeviceProfile = {
  Name: string;
  MaxStreamingBitrate: number;
  MaxStaticBitrate: number;
  MusicStreamingTranscodingBitrate: number;
  DirectPlayProfiles: DirectPlayProfile[];
  TranscodingProfiles: TranscodingProfile[];
  ContainerProfiles: unknown[];
  CodecProfiles: CodecProfile[];
  SubtitleProfiles: SubtitleProfile[];
};

// ─── Capability probes ───────────────────────────────────────────────

/** Shared probe element — canPlayType is cheap but element creation isn't free. */
let probeVideo: HTMLVideoElement | null = null;

function canPlayNative(mimeType: string): boolean {
  if (typeof document === 'undefined') return false;
  probeVideo ??= document.createElement('video');
  // canPlayType returns '' | 'maybe' | 'probably' — anything non-empty counts.
  return probeVideo.canPlayType(mimeType) !== '';
}

/**
 * A codec counts as supported if EITHER the MSE pipeline (used by hls.js)
 * OR the native <video src> pipeline can decode it. The two agree for the
 * common codecs; checking both avoids false negatives on browsers where
 * only one API reports support.
 */
function supports(mimeType: string): boolean {
  if (typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(mimeType)) return true;
  return canPlayNative(mimeType);
}

// ─── Profile builder ─────────────────────────────────────────────────

export function buildDeviceProfile(): DeviceProfile {
  // ── Video codecs ──
  // h264 High@L4.1 — the canonical probe string; if this fails nothing else matters.
  const h264 = supports('video/mp4; codecs="avc1.640029"');
  // HEVC ships in two sample-entry boxings (hvc1/hev1); files in the wild use
  // both, and some platforms (Safari) only report support for one of them.
  const hevc =
    supports('video/mp4; codecs="hvc1.1.6.L153.B0"') ||
    supports('video/mp4; codecs="hev1.1.6.L153.B0"');
  const av1 = supports('video/mp4; codecs="av01.0.08M.08"');
  const vp9 = supports('video/webm; codecs="vp09.00.50.08"');
  const vp8 = supports('video/webm; codecs="vp8"');
  const av1Webm = supports('video/webm; codecs="av01.0.08M.08"');

  // ── Audio codecs (probed in the mp4 container — what direct play uses) ──
  const aac = supports('audio/mp4; codecs="mp4a.40.2"');
  // mp3-in-mp4 has its own object type (40.34); fall back to plain audio/mpeg
  // support, which implies the decoder exists even if the mux probe is coy.
  const mp3 = supports('audio/mp4; codecs="mp4a.40.34"') || canPlayNative('audio/mpeg');
  const ac3 = supports('audio/mp4; codecs="ac-3"');
  const eac3 = supports('audio/mp4; codecs="ec-3"');
  const opusMp4 = supports('audio/mp4; codecs="opus"');
  const flac = supports('audio/mp4; codecs="flac"');
  const opusWebm = supports('audio/webm; codecs="opus"');
  const vorbis = supports('audio/webm; codecs="vorbis"');

  const mp4Video: string[] = [];
  if (h264) mp4Video.push('h264');
  if (hevc) mp4Video.push('hevc');
  if (av1) mp4Video.push('av1');

  const mp4Audio: string[] = [];
  if (aac) mp4Audio.push('aac');
  if (mp3) mp4Audio.push('mp3');
  if (ac3) mp4Audio.push('ac3');
  if (eac3) mp4Audio.push('eac3');
  if (opusMp4) mp4Audio.push('opus');
  if (flac) mp4Audio.push('flac');

  const webmVideo: string[] = [];
  if (vp9) webmVideo.push('vp9');
  if (vp8) webmVideo.push('vp8');
  if (av1Webm) webmVideo.push('av1');

  const webmAudio: string[] = [];
  if (opusWebm) webmAudio.push('opus');
  if (vorbis) webmAudio.push('vorbis');

  // Matroska: Chromium demuxes mkv natively (canPlayType → 'maybe'); Firefox
  // returns '' and Jellyfin will remux/transcode instead. Declaring mkv when
  // supported avoids pointless remuxes of the most common rip container.
  const mkv =
    canPlayNative('video/x-matroska; codecs="avc1.640029"') || canPlayNative('video/mkv');

  // ── DirectPlayProfiles — only declare containers we can actually decode ──
  const directPlayProfiles: DirectPlayProfile[] = [];
  if (mp4Video.length > 0) {
    directPlayProfiles.push({
      Container: 'mp4,m4v',
      Type: 'Video',
      VideoCodec: mp4Video.join(','),
      AudioCodec: mp4Audio.join(','),
    });
  }
  if (mkv && mp4Video.length > 0) {
    directPlayProfiles.push({
      Container: 'mkv',
      Type: 'Video',
      VideoCodec: mp4Video.join(','),
      // mkv can mux both mp4-family and webm-family audio.
      AudioCodec: [...new Set([...mp4Audio, ...webmAudio])].join(','),
    });
  }
  if (webmVideo.length > 0) {
    directPlayProfiles.push({
      Container: 'webm',
      Type: 'Video',
      VideoCodec: webmVideo.join(','),
      AudioCodec: webmAudio.join(','),
    });
  }

  // ── TranscodingProfiles — what the server should produce when direct play fails ──
  const transcodingProfiles: TranscodingProfile[] = [
    {
      Type: 'Video',
      Container: 'ts',
      Protocol: 'hls',
      VideoCodec: 'h264',
      AudioCodec: 'aac',
      Context: 'Streaming',
      MaxAudioChannels: '2',
      // Start playback as soon as the first segment is ready instead of
      // waiting for a buffer of segments.
      MinSegments: 1,
      // hls.js tolerates segments that don't start on a keyframe; allowing
      // them makes seeks into a live transcode start much faster.
      BreakOnNonKeyFrames: true,
    },
    // Audio-only fallback (e.g. video direct-playable but audio codec isn't —
    // lets the server transcode just the audio track strategy server-side).
    {
      Type: 'Audio',
      Container: 'ts',
      Protocol: 'hls',
      AudioCodec: 'aac',
      Context: 'Streaming',
    },
  ];

  // ── CodecProfiles — constraints on codecs we claimed above ──
  const codecProfiles: CodecProfile[] = [
    {
      Type: 'Video',
      Codec: 'h264',
      Conditions: [
        // Browser decoders top out around H.264 level 5.2. Without this cap a
        // level 6.x file matches the DirectPlayProfile and then stalls.
        { Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '52', IsRequired: false },
      ],
    },
  ];

  // ── SubtitleProfiles ──
  const subtitleProfiles: SubtitleProfile[] = [
    // Method External = the server extracts/converts text subs and serves
    // them on a separate URL (we render them with <track>). Without these
    // entries Jellyfin BURNS subtitles into the video, forcing a transcode.
    { Format: 'vtt', Method: 'External' },
    { Format: 'subrip', Method: 'External' },
    // ass/ssa intentionally NOT declared: <track> can't render them, and we
    // ship no libass renderer — omitting them makes the server burn styled
    // subs in, which is the correct fallback for fidelity.
  ];

  return {
    Name: 'Micelclaw Dash Web',
    // ~20 Mbps streaming ceiling: comfortably above 1080p remuxes while
    // keeping a single transcode from saturating a home uplink.
    MaxStreamingBitrate: 20_000_000,
    MaxStaticBitrate: 100_000_000,
    MusicStreamingTranscodingBitrate: 384_000,
    DirectPlayProfiles: directPlayProfiles,
    TranscodingProfiles: transcodingProfiles,
    ContainerProfiles: [],
    CodecProfiles: codecProfiles,
    SubtitleProfiles: subtitleProfiles,
  };
}
