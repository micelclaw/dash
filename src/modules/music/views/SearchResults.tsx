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
import { MicVocal, SearchX } from 'lucide-react';
import { MediaGrid, MediaCard } from '@/components/media';
import { EmptyState } from '@/components/shared/EmptyState';
import { useMusicStore } from '@/stores/music.store';
import { coverUrl } from '@/services/music.service';
import { TrackList } from '../components/TrackList';
import { AlbumCard } from '../components/AlbumCard';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function SearchResults() {
  const results = useMusicStore((s) => s.searchResults);
  const loading = useMusicStore((s) => s.loadingSearch);

  if (!results) {
    return loading ? (
      <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Searching…</div>
    ) : null;
  }

  const empty =
    results.tracks.length === 0 && results.albums.length === 0 && results.artists.length === 0;

  if (empty) {
    return (
      <EmptyState
        icon={SearchX}
        title="No results"
        description="Nothing in your library matches that search."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }}>
      {results.tracks.length > 0 && (
        <Section title="Tracks">
          <TrackList tracks={results.tracks} />
        </Section>
      )}
      {results.albums.length > 0 && (
        <Section title="Albums">
          <MediaGrid>
            {results.albums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </MediaGrid>
        </Section>
      )}
      {results.artists.length > 0 && (
        <Section title="Artists">
          <MediaGrid>
            {results.artists.map((artist) => (
              <MediaCard
                key={artist.id}
                image={artist.cover_art ? coverUrl(artist.cover_art) : null}
                fallbackIcon={MicVocal}
                title={artist.name}
            badge={<EntitySource entity={artist} domain="music" native />}
                rounded="circle"
                onClick={() => void useMusicStore.getState().openArtist(artist.id)}
              />
            ))}
          </MediaGrid>
        </Section>
      )}
    </div>
  );
}
