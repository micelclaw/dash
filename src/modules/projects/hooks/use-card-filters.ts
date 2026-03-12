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

import { useMemo } from 'react';
import { useProjectsStore } from '@/stores/projects.store';
import type { Card, CardFilters } from '../types';

/**
 * Client-side card filtering. Returns a Set of card IDs that pass the filters.
 * Cards NOT in the set should be dimmed (opacity: 0.15) rather than hidden.
 */
export function useCardFilters(): {
  matchingIds: Set<string> | null; // null = no filters active, show all
  hasActiveFilters: boolean;
} {
  const cards = useProjectsStore((s) => s.cards);
  const filters = useProjectsStore((s) => s.filters);

  return useMemo(() => {
    const hasActive = !!(
      filters.search || filters.priority || filters.assignee_id ||
      filters.tag || filters.label_id || filters.due_before ||
      filters.due_after || filters.has_dependencies || filters.is_blocked
    );

    if (!hasActive) return { matchingIds: null, hasActiveFilters: false };

    const matching = new Set<string>();
    const searchLower = filters.search?.toLowerCase();

    for (const card of Object.values(cards)) {
      if (matchesCard(card, filters, searchLower)) {
        matching.add(card.id);
      }
    }

    return { matchingIds: matching, hasActiveFilters: true };
  }, [cards, filters]);
}

function matchesCard(card: Card, filters: CardFilters, searchLower?: string): boolean {
  if (searchLower) {
    const titleMatch = card.title.toLowerCase().includes(searchLower);
    const descMatch = card.description?.toLowerCase().includes(searchLower);
    const tagMatch = card.tags?.some(t => t.toLowerCase().includes(searchLower));
    if (!titleMatch && !descMatch && !tagMatch) return false;
  }

  if (filters.priority && card.priority !== filters.priority) return false;

  if (filters.assignee_id) {
    if (!(card.assignee_ids ?? []).includes(filters.assignee_id)) return false;
  }

  if (filters.tag) {
    if (!(card.tags ?? []).includes(filters.tag)) return false;
  }

  if (filters.due_before) {
    if (!card.due_date || card.due_date > filters.due_before) return false;
  }

  if (filters.due_after) {
    if (!card.due_date || card.due_date < filters.due_after) return false;
  }

  return true;
}
