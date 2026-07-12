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

import { useEffect, useMemo } from 'react';
import { Headphones } from 'lucide-react';
import { MediaCard, MediaGrid, MediaUnavailable } from '@/components/media';
import { EmptyState } from '@/components/shared/EmptyState';
import { useBooksStore } from '@/stores/books.store';
import { audioCoverUrl } from '@/services/books.service';
import { AudiobookDetail } from './AudiobookDetail';
import { formatTotalDuration } from '../lib/format';

/**
 * Shown when Audiobookshelf is not installed, not running, or starting
 * on-demand. A user with Books access NEVER gets sent to the admin-only
 * Servarr module — the container starts here (auto on entry; button as
 * fallback).
 */
function AbsUnavailableState() {
  const installed = useBooksStore((s) => s.status?.abs.installed ?? false);
  const starting = useBooksStore((s) => s.absStarting);
  const startError = useBooksStore((s) => s.absStartError);
  return (
    <MediaUnavailable
      icon={Headphones}
      serviceName="Audiobookshelf"
      mediaNoun="audiobooks"
      installed={installed}
      starting={starting}
      startError={startError}
      onStart={() => void useBooksStore.getState().startAbsAndWait()}
      onRetry={() => void useBooksStore.getState().ensureAbsRunning()}
    />
  );
}

/**
 * Audiobooks tab: grid of Audiobookshelf items with listening progress.
 * Clicking a card opens the AudiobookDetail panel; the play hover button
 * opens it and starts playback through the global player.
 */
export function AudiobooksView() {
  const items = useBooksStore((s) => s.audioItems);
  const audioLoaded = useBooksStore((s) => s.audioLoaded);
  const loading = useBooksStore((s) => s.loadingAudio);
  const absUnavailable = useBooksStore((s) => s.absUnavailable);
  const selected = useBooksStore((s) => s.selectedAudiobook);
  const search = useBooksStore((s) => s.search);

  useEffect(() => {
    // Ensure ABS is running (auto-start on-demand if installed-but-stopped),
    // then load the library.
    void useBooksStore.getState().ensureAbsRunning();
  }, []);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(query) ||
        (i.author ?? '').toLowerCase().includes(query),
    );
  }, [items, query]);

  if (absUnavailable) return <AbsUnavailableState />;

  if (selected) return <AudiobookDetail detail={selected} />;

  if (!audioLoaded) {
    return loading ? (
      <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading…</div>
    ) : null;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Headphones}
        title="No audiobooks yet"
        description="Add audiobooks to your Audiobookshelf library to listen to them here."
      />
    );
  }

  if (query && filtered.length === 0) {
    return (
      <EmptyState
        icon={Headphones}
        title="No audiobooks match your search"
        description={`Nothing in the library matches “${search.trim()}”.`}
      />
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <MediaGrid min={160}>
        {filtered.map((item) => {
          const progress =
            item.progress && item.duration_seconds > 0
              ? item.progress.is_finished
                ? 1
                : item.progress.current_time / item.duration_seconds
              : undefined;
          return (
            <MediaCard
              key={item.id}
              image={audioCoverUrl(item.id)}
              fallbackIcon={Headphones}
              title={item.title}
              subtitle={item.author ?? formatTotalDuration(item.duration_seconds)}
              progress={progress}
              onClick={() => void useBooksStore.getState().openAudiobook(item.id)}
              onPlay={() => void useBooksStore.getState().openAudiobook(item.id, { autoplay: true })}
            />
          );
        })}
      </MediaGrid>
    </div>
  );
}
