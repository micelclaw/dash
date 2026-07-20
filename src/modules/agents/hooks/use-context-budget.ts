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
import { getContextBudget, type ContextBudget } from '@/services/agent-context.service';

/**
 * Fetch the agent's context budget. Refetches whenever `agentId` changes OR the
 * agent's `skill_modes` change (toggling an app núcleo↔completo changes how many
 * facade tools it carries → the budget shifts). `skillModes` is serialized for a
 * stable effect dep so the same object identity doesn't loop.
 */
export function useContextBudget(
  agentId: string | null,
  skillModes: Record<string, 'core' | 'full'> | undefined,
): { budget: ContextBudget | null; loading: boolean } {
  const [budget, setBudget] = useState<ContextBudget | null>(null);
  const [loading, setLoading] = useState(false);
  const modesKey = JSON.stringify(skillModes ?? {});

  useEffect(() => {
    if (!agentId) { setBudget(null); return; }
    let cancelled = false;
    setLoading(true);
    getContextBudget(agentId)
      .then((b) => { if (!cancelled) setBudget(b); })
      .catch(() => { if (!cancelled) setBudget(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // modesKey drives the refetch when an app flips núcleo↔completo.
  }, [agentId, modesKey]);

  return { budget, loading };
}
