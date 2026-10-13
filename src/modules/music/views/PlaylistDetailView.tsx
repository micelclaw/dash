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
import { ListMusic, Play, Shuffle } from 'lucide-react';
import { MediaHero } from '@/components/media';
import { useMusicStore } from '@/stores/music.store';
import { coverUrl } from '@/services/music.service';
import { TrackList } from '../components/TrackList';
import { playTracks, shufflePlayTracks } from '../lib/playback';
import { formatTotalDuration } from '../lib/format';
import { BackButton, HeroActionButton } from '../components/detail-chrome';

export function PlaylistDetailView() {
  const detail = useMusicStore((s) => s.selectedPlaylist);
  const closeDetail = useMusicStore((s) => s.closeDetail);
  const removeTrack = useMusicStore((s) => s.removeTrackFromSelectedPlaylist);

  if (!detail) return null;
  const { playlist, tracks } = detail;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <BackButton onClick={closeDetail} />
      <EntitySource entity={playlist} domain="music" native detail />
      <MediaHero
        image={playlist.cover_art ? coverUrl(playlist.cover_art, 600) : null}
        fallbackIcon={ListMusic}
        kicker="Playlist"
        title={playlist.name}
        meta={
          <>
            {playlist.song_count} song{playlist.song_count === 1 ? '' : 's'} · {formatTotalDuration(playlist.duration)}
          </>
        }
        actions={
          <>
            <HeroActionButton icon={Play} label="Play all" primary onClick={() => playTracks(tracks)} />
            <HeroActionButton icon={Shuffle} label="Shuffle" onClick={() => shufflePlayTracks(tracks)} />
          </>
        }
      />
      <TrackList tracks={tracks} onRemoveFromPlaylist={(index) => void removeTrack(index)} />
    </div>
  );
}
