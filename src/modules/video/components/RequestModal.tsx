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

import { Clapperboard, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DiscoverResult } from '@/services/video.service';
import { useVideoStore } from '@/stores/video.store';

/** Public TMDB poster URL for a Jellyseerr discover result. */
export function tmdbPosterUrl(posterPath: string | undefined, size = 'w342'): string | null {
  return posterPath ? `https://image.tmdb.org/t/p/${size}${posterPath}` : null;
}

export function discoverTitle(result: DiscoverResult): string {
  return result.title ?? result.name ?? 'Untitled';
}

export function discoverYear(result: DiscoverResult): string | null {
  const date = result.release_date ?? result.first_air_date;
  return date ? date.slice(0, 4) : null;
}

/**
 * Confirmation dialog for a Jellyseerr media request: poster + overview and a
 * single Request action. TV requests cover all seasons.
 */
export function RequestModal({
  result,
  onClose,
}: {
  result: DiscoverResult | null;
  onClose: () => void;
}) {
  const requesting = useVideoStore((s) => s.requesting);

  const submit = async () => {
    if (!result || result.media_type === 'person') return;
    const ok = await useVideoStore.getState().submitRequest({
      media_type: result.media_type,
      tmdb_id: result.id,
    });
    if (ok) onClose();
  };

  const poster = result ? tmdbPosterUrl(result.poster_path) : null;

  return (
    <Dialog open={!!result} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        {result && (
          <>
            <DialogHeader>
              <DialogTitle style={{ color: 'var(--text)' }}>
                Request {result.media_type === 'tv' ? 'series' : 'movie'}
              </DialogTitle>
              <DialogDescription>
                Sends a download request to Jellyseerr.
                {result.media_type === 'tv' && ' All seasons will be requested.'}
              </DialogDescription>
            </DialogHeader>

            <div style={{ display: 'flex', gap: 16, margin: '16px 0', fontFamily: 'var(--font-sans)' }}>
              <div
                style={{
                  width: 96,
                  aspectRatio: '2 / 3',
                  flexShrink: 0,
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  background: 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {poster ? (
                  <img
                    src={poster}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <Clapperboard size={28} style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
                  {discoverTitle(result)}
                  {discoverYear(result) && (
                    <span style={{ fontWeight: 400, color: 'var(--text-dim)', marginLeft: 8 }}>
                      ({discoverYear(result)})
                    </span>
                  )}
                </div>
                {result.overview && (
                  <p
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-dim)',
                      lineHeight: 1.5,
                      margin: '8px 0 0',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 6,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {result.overview}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-dim)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void submit()}
                disabled={requesting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-sans)',
                  cursor: requesting ? 'default' : 'pointer',
                  border: 'none',
                  background: 'var(--amber)',
                  color: '#06060a',
                  fontWeight: 600,
                  opacity: requesting ? 0.6 : 1,
                }}
              >
                <Download size={14} />
                {requesting ? 'Requesting…' : 'Request'}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
