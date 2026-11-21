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

import { EntitySource } from '@/components/shared/SourceBadge';
import { Disc3, Play, Shuffle } from 'lucide-react';
import { MediaHero } from '@/components/media';
import { useMusicStore } from '@/stores/music.store';
import { coverUrl } from '@/services/music.service';
import { TrackList } from '../components/TrackList';
import { playTracks, shufflePlayTracks } from '../lib/playback';
import { formatTotalDuration } from '../lib/format';
import { BackButton, HeroActionButton } from '../components/detail-chrome';
import { useI18n } from '@/i18n';

export function AlbumDetailView() {
  const { t } = useI18n();
  const detail = useMusicStore((s) => s.selectedAlbum);
  const closeDetail = useMusicStore((s) => s.closeDetail);

  if (!detail) return null;
  const { album, tracks } = detail;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <BackButton onClick={closeDetail} />
      <EntitySource entity={album} domain="music" native detail />
      <MediaHero
        image={album.cover_art ? coverUrl(album.cover_art, 600) : null}
        fallbackIcon={Disc3}
        kicker={t('music.album')}
        title={album.name}
        subtitle={
          <button
            onClick={() => void useMusicStore.getState().openArtist(album.artist_id)}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              color: 'var(--text-dim)', fontSize: 'inherit', fontFamily: 'inherit',
            }}
          >
            {album.artist}
          </button>
        }
        meta={
          <>
            {t(album.song_count === 1 ? 'music.song' : 'music.songs', { count: album.song_count })} · {formatTotalDuration(album.duration)}
            {album.year ? ` · ${album.year}` : ''}
          </>
        }
        actions={
          <>
            <HeroActionButton icon={Play} label={t('music.playAll')} primary onClick={() => playTracks(tracks)} />
            <HeroActionButton icon={Shuffle} label={t('music.shuffle')} onClick={() => shufflePlayTracks(tracks)} />
          </>
        }
      />
      <TrackList tracks={tracks} />
    </div>
  );
}
