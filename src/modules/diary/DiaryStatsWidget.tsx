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

import { Flame, BookOpen, BarChart3 } from 'lucide-react';
import { useDiaryStats } from './hooks/use-diary-stats';

const MOOD_EMOJI: Record<string, string> = {
  great: '😄', good: '🙂', neutral: '😐', bad: '😕', terrible: '😢',
};

export function DiaryStatsWidget() {
  const { stats, loading } = useDiaryStats();

  if (loading || !stats) return null;

  return (
    <div className="flex items-center gap-4 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs">
      <div className="flex items-center gap-1.5 text-[var(--text-muted)]" title="Total entries">
        <BookOpen size={12} />
        <span className="font-medium text-[var(--text)]">{stats.totalEntries}</span>
        entries
      </div>
      <div className="flex items-center gap-1.5 text-[var(--text-muted)]" title="Current streak">
        <Flame size={12} className="text-orange-400" />
        <span className="font-medium text-[var(--text)]">{stats.currentStreak}</span>
        day streak
      </div>
      {stats.topTags?.length > 0 && (
        <div className="flex items-center gap-1.5 text-[var(--text-muted)]" title="Top tags">
          <BarChart3 size={12} />
          {stats.topTags.slice(0, 3).map(t => (
            <span key={t.tag} className="px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] text-[10px]">
              {t.tag}
            </span>
          ))}
        </div>
      )}
      {stats.moodDistribution && Object.keys(stats.moodDistribution).length > 0 && (
        <div className="flex items-center gap-0.5" title="Mood distribution">
          {Object.entries(stats.moodDistribution)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 4)
            .map(([mood, count]) => (
              <span key={mood} title={`${mood}: ${count}`}>
                {MOOD_EMOJI[mood] ?? '•'}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
