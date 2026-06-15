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
 * PlayerView — fullscreen video player overlay for the video module.
 *
 * - Resolves playback via stream-resolver (device profile → PlaybackInfo).
 * - Direct play: plain <video src> with ?token= auth.
 * - HLS transcode: hls.js, imported DYNAMICALLY so it ships as its own
 *   lazy chunk; the JWT rides every playlist/segment request via xhrSetup.
 * - Controls: media-chrome web components (side-effect import — NOT the
 *   React wrapper, which has a peer-dep mismatch with React 19). Tag
 *   typings live in lib/media-chrome.d.ts.
 * - Progress reporting: start on first play, progress every 10s + on
 *   pause/seek/ended, stopped on close/unmount/page-hide. The stopped
 *   report is CRITICAL: without it Jellyfin keeps ffmpeg transcodes alive
 *   and never saves the resume position.
 */

import 'media-chrome';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import type Hls from 'hls.js';
import { useAuthStore } from '@/stores/auth.store';
import { videoService } from '@/services/video.service';
import { resolvePlayback, type ResolvedPlayback } from './lib/stream-resolver';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const PROGRESS_INTERVAL_MS = 10_000;

export interface PlayerViewItem {
  id: string;
  name: string;
  seriesName?: string;
  /** Resume position in seconds (from user_data.position_seconds). */
  positionSeconds?: number;
}

export interface PlayerViewProps {
  item: PlayerViewItem;
  onClose: () => void;
}

/** Append the JWT as ?token= — the auth plugin accepts it for media requests. */
function withToken(url: string, token: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

export function PlayerView({ item, onClose }: PlayerViewProps) {
  const [playback, setPlayback] = useState<ResolvedPlayback | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  /** Mirror of `playback` readable from unload handlers without re-binding them. */
  const playbackRef = useRef<ResolvedPlayback | null>(null);
  const startedRef = useRef(false);
  const resumedRef = useRef(false);
  const stoppedSentRef = useRef(false);
  const lastProgressAtRef = useRef(0);

  // Render-time token for <video src> / <track src> URLs.
  const token = useAuthStore((s) => s.tokens?.accessToken) ?? '';

  // ── Resolve playback (device profile → PlaybackInfo → direct | hls) ──
  useEffect(() => {
    let cancelled = false;
    resolvePlayback(item.id, { startPositionSeconds: item.positionSeconds })
      .then((pb) => {
        if (cancelled) return;
        playbackRef.current = pb;
        setPlayback(pb);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Could not start playback';
        setError(message);
        toast.error('Playback failed', { description: message });
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.positionSeconds]);

  // ── "stopped" report — exactly once, must survive unload ──
  const sendStopped = useCallback(() => {
    const pb = playbackRef.current;
    if (!pb || stoppedSentRef.current) return;
    stoppedSentRef.current = true;
    const tok = useAuthStore.getState().tokens?.accessToken ?? '';
    // Auth via ?token= — sendBeacon / keepalive fetch can't carry headers
    // reliably during unload.
    const url = withToken(`${BASE_URL}/api/v1/video/playing/stopped`, tok);
    const body = JSON.stringify({
      item_id: item.id,
      media_source_id: pb.mediaSource.id,
      play_session_id: pb.playSessionId,
      position_seconds: Math.floor(videoRef.current?.currentTime ?? 0),
    });
    // sendBeacon is designed to survive page teardown; keepalive fetch is
    // the fallback (and handles cross-origin BASE_URL deployments, where a
    // JSON beacon would need a CORS preflight beacons can't perform).
    let queued = false;
    if (typeof navigator.sendBeacon === 'function') {
      try {
        queued = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } catch {
        queued = false;
      }
    }
    if (!queued) {
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        /* fire-and-forget */
      });
    }
  }, [item.id]);

  const handleClose = useCallback(() => {
    sendStopped();
    onClose();
  }, [sendStopped, onClose]);

  // ── Attach media: direct <video src> or lazy hls.js ──
  useEffect(() => {
    const video = videoRef.current;
    if (!playback || !video) return;

    const streamUrl = `${BASE_URL}/api/v1${playback.mediaSource.stream_url}`;
    let disposed = false;

    if (playback.kind === 'direct') {
      // Direct play: the browser fetches with Range requests; the JWT rides
      // the query string (one URL for the whole file, so a static token is
      // unavoidable here).
      video.src = withToken(streamUrl, useAuthStore.getState().tokens?.accessToken ?? '');
    } else {
      // HLS transcode. Dynamic import keeps hls.js out of the main bundle —
      // it only loads when a transcode actually happens.
      void import('hls.js').then(({ default: HlsCtor }) => {
        if (disposed) return;
        if (HlsCtor.isSupported()) {
          const hls = new HlsCtor({
            // Every playlist/segment request goes to Core's JWT-gated
            // /video/hls proxy. Inject the token per-request: this covers
            // master.m3u8 AND the segment URLs hls.js resolves relative to
            // it. Read fresh from the store each time so a refreshed token
            // is picked up mid-playback.
            xhrSetup: (xhr, url) => {
              const tok = useAuthStore.getState().tokens?.accessToken ?? '';
              xhr.open('GET', withToken(url, tok), true);
            },
          });
          hls.on(HlsCtor.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            // Standard hls.js fatal-error ladder: retry network, recover
            // media pipeline, otherwise give up.
            if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
            } else if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              hls.destroy();
              setError('Playback failed (fatal HLS error)');
            }
          });
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS fallback (Safari without MSE). Best effort: the token
          // only rides the master URL here — segment requests resolved by the
          // native player won't carry it, so this path depends on the Core
          // proxy session, while hls.js (preferred above) always works.
          video.src = withToken(streamUrl, useAuthStore.getState().tokens?.accessToken ?? '');
        } else {
          setError('This browser cannot play HLS streams');
        }
      });
    }

    return () => {
      disposed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [playback]);

  // ── Resume + progress reporting ──
  useEffect(() => {
    const video = videoRef.current;
    if (!playback || !video) return;

    const report = (kind: 'start' | 'progress', extra?: { is_paused?: boolean }) => {
      lastProgressAtRef.current = Date.now();
      videoService
        .reportPlaying(kind, {
          item_id: item.id,
          media_source_id: playback.mediaSource.id,
          play_session_id: playback.playSessionId,
          position_seconds: Math.floor(video.currentTime || 0),
          ...extra,
        })
        .catch(() => {
          /* fire-and-forget — never interrupt playback over a report */
        });
    };

    const onLoadedMetadata = () => {
      // Resume exactly once per playback session. Applies to both kinds:
      // Jellyfin's HLS playlists are full-length VOD, so seeking the element
      // is the correct resume mechanism there too.
      if (!resumedRef.current && item.positionSeconds && item.positionSeconds > 0) {
        resumedRef.current = true;
        video.currentTime = item.positionSeconds;
      }
      video.play().catch(() => {
        /* autoplay may be blocked — the user presses play */
      });
    };
    const onPlay = () => {
      if (!startedRef.current) {
        startedRef.current = true;
        report('start', { is_paused: false });
      } else {
        report('progress', { is_paused: false });
      }
    };
    const onPause = () => report('progress', { is_paused: true });
    const onSeeked = () => report('progress', { is_paused: video.paused });
    const onEnded = () => report('progress', { is_paused: true });
    const onTimeUpdate = () => {
      // Throttle: timeupdate fires ~4x/s; report every 10s.
      if (Date.now() - lastProgressAtRef.current >= PROGRESS_INTERVAL_MS) {
        report('progress', { is_paused: video.paused });
      }
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('ended', onEnded);
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [playback, item.id, item.positionSeconds]);

  // ── Esc closes + stopped-on-unload safety nets ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
    };
    // capture phase: run before media-controller's own hotkey handling.
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pagehide', sendStopped);
    window.addEventListener('beforeunload', sendStopped);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pagehide', sendStopped);
      window.removeEventListener('beforeunload', sendStopped);
    };
  }, [handleClose, sendStopped]);

  // Unmount safety net: the parent may remove us without calling onClose.
  useEffect(() => () => sendStopped(), [sendStopped]);

  const externalSubs =
    playback?.mediaSource.subtitle_streams.filter((s) => s.is_external && s.delivery_url) ?? [];

  return (
    <div
      className="fixed inset-0 z-[350] flex flex-col bg-black"
      role="dialog"
      aria-label={`Playing ${item.name}`}
    >
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="max-w-md text-center text-sm text-white/80">{error}</p>
          <button
            onClick={handleClose}
            className="rounded-md bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
          >
            Close
          </button>
        </div>
      ) : !playback ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/80">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Preparing playback…</p>
          <button
            onClick={handleClose}
            className="mt-2 rounded-md bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
          >
            Cancel
          </button>
        </div>
      ) : (
        <media-controller className="block h-full w-full flex-1">
          <video
            slot="media"
            ref={videoRef}
            className="h-full w-full"
            playsInline
            autoPlay
            preload="metadata"
            crossOrigin="anonymous"
          >
            {externalSubs.map((s) => (
              <track
                key={s.index}
                kind="subtitles"
                src={withToken(`${BASE_URL}/api/v1${s.delivery_url ?? ''}`, token)}
                srcLang={s.language ?? 'und'}
                label={s.title ?? s.language ?? `Subtitle ${s.index}`}
              />
            ))}
          </video>

          <media-loading-indicator slot="centered-chrome" />

          {/* Title + close live inside top-chrome so they stay visible (and
              auto-hide with the controls) in element fullscreen too. */}
          <div
            slot="top-chrome"
            className="flex w-full items-center justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent px-4 py-3"
          >
            <div className="min-w-0">
              {item.seriesName && (
                <p className="truncate text-xs text-white/60">{item.seriesName}</p>
              )}
              <p className="truncate text-sm font-medium text-white">{item.name}</p>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close player"
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" /> Close
            </button>
          </div>

          <media-control-bar>
            <media-play-button />
            <media-mute-button />
            <media-volume-range />
            <media-time-range />
            <media-time-display showduration />
            <media-captions-button />
            <media-fullscreen-button />
          </media-control-bar>
        </media-controller>
      )}
    </div>
  );
}

export default PlayerView;
