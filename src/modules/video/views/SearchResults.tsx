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

import { SearchX } from 'lucide-react';
import { MediaGrid } from '@/components/media';
import { EmptyState } from '@/components/shared/EmptyState';
import { useVideoStore } from '@/stores/video.store';
import { PosterCard } from '../components/PosterCard';

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

/** Library search overlay — movies and series matching the toolbar query. */
export function SearchResults() {
  const results = useVideoStore((s) => s.searchResults);
  const loading = useVideoStore((s) => s.loadingSearch);

  if (!results) {
    return loading ? (
      <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Searching…</div>
    ) : null;
  }

  if (results.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No results"
        description="Nothing in your library matches that search. Try the Requests tab to discover new titles."
      />
    );
  }

  const movies = results.filter((i) => i.type === 'Movie');
  const series = results.filter((i) => i.type === 'Series');
  const other = results.filter((i) => i.type !== 'Movie' && i.type !== 'Series');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }}>
      {movies.length > 0 && (
        <Section title="Movies">
          <MediaGrid>
            {movies.map((item) => (
              <PosterCard key={item.id} item={item} />
            ))}
          </MediaGrid>
        </Section>
      )}
      {series.length > 0 && (
        <Section title="Series">
          <MediaGrid>
            {series.map((item) => (
              <PosterCard key={item.id} item={item} />
            ))}
          </MediaGrid>
        </Section>
      )}
      {other.length > 0 && (
        <Section title="Other">
          <MediaGrid>
            {other.map((item) => (
              <PosterCard key={item.id} item={item} />
            ))}
          </MediaGrid>
        </Section>
      )}
    </div>
  );
}
