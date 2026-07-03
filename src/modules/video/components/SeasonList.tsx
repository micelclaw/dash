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

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { VideoItem } from '@/services/video.service';
import { useVideoStore } from '@/stores/video.store';
import { EpisodeRow } from './EpisodeRow';

/**
 * Expandable season sections for a Series detail. Episodes load lazily on
 * first expand (Shows/{seriesId}/Episodes via the store); the first season
 * starts expanded.
 */
export function SeasonList({ seasons }: { seasons: VideoItem[] }) {
  const episodesBySeason = useVideoStore((s) => s.episodesBySeason);
  const loadingEpisodes = useVideoStore((s) => s.loadingEpisodes);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const first = seasons[0];
    return first ? { [first.id]: true } : {};
  });

  useEffect(() => {
    for (const season of seasons) {
      if (expanded[season.id] && !episodesBySeason[season.id]) {
        void useVideoStore.getState().loadSeasonEpisodes(season.id);
      }
    }
  }, [expanded, seasons, episodesBySeason]);

  if (seasons.length === 0) {
    return (
      <div style={{ padding: '8px 16px', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
        No seasons found.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--font-sans)' }}>
      {seasons.map((season) => {
        const isOpen = !!expanded[season.id];
        const episodes = episodesBySeason[season.id];
        const loading = loadingEpisodes === season.id;
        return (
          <section key={season.id}>
            <button
              onClick={() => setExpanded((prev) => ({ ...prev, [season.id]: !isOpen }))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text)',
                fontSize: '0.875rem',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                textAlign: 'left',
              }}
            >
              {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              {season.name}
              {episodes && (
                <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {episodes.length} episode{episodes.length === 1 ? '' : 's'}
                </span>
              )}
            </button>

            {isOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 8 }}>
                {loading && !episodes && (
                  <div style={{ padding: '8px 10px', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                    Loading episodes…
                  </div>
                )}
                {episodes?.map((ep) => <EpisodeRow key={ep.id} episode={ep} />)}
                {episodes && episodes.length === 0 && (
                  <div style={{ padding: '8px 10px', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                    No episodes in this season.
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
