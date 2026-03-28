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

import { useState, useEffect } from 'react';
import { api } from '@/services/api';

export interface DiaryStats {
  totalEntries: number;
  currentStreak: number;
  longestStreak: number;
  moodDistribution: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
  avgWordsPerEntry: number;
}

export function useDiaryStats(period = 'all') {
  const [stats, setStats] = useState<DiaryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ data: DiaryStats }>(`/diary/stats?period=${period}`);
        setStats(res.data);
      } catch {
        // Stats endpoint optional
      }
      setLoading(false);
    })();
  }, [period]);

  return { stats, loading };
}
