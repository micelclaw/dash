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

export interface DiaryEntry {
  id: string;
  entry_date: string;
  content: string;
  mood: MoodLevel | null;
  tags: string[];
  weather: { temp: number; condition: string; location: string } | null;
  custom_fields: Record<string, unknown> | null;
  is_encrypted: boolean;
  is_draft: boolean;
  source: string;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
  heat_score?: number;
}

export interface DiaryCreateInput {
  entry_date: string;
  content: string;
  mood?: string;
  tags?: string[];
}

export type MoodLevel = 'great' | 'good' | 'neutral' | 'bad' | 'terrible';

export const MOOD_CONFIG: Record<MoodLevel, { emoji: string; label: string; color: string }> = {
  great:    { emoji: '😊', label: 'Great', color: '#22c55e' },
  good:     { emoji: '🙂', label: 'Good',  color: '#84cc16' },
  neutral:  { emoji: '😐', label: 'Okay',  color: '#eab308' },
  bad:      { emoji: '😟', label: 'Bad',   color: '#f97316' },
  terrible: { emoji: '😢', label: 'Awful', color: '#ef4444' },
};
