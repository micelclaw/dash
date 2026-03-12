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

import { useEffect, useRef } from 'react';
import { api } from '@/services/api';

interface ViewRecord {
  domain: string;
  id: string;
  timestamp: number;
}

const CO_NAV_WINDOW = 60_000; // 60 seconds

// Module-level last viewed record (shared across all component instances)
let lastViewed: ViewRecord | null = null;

/**
 * Track co-navigation between records.
 * If user views record B within 60s of viewing record A,
 * fires POST /links/heat-edge to boost the edge between them.
 */
export function useCoNavigation(domain: string, id: string) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!domain || !id) return;

    const now = Date.now();
    const prev = lastViewed;

    // Check if we should fire co-navigation
    if (
      prev &&
      !firedRef.current &&
      (prev.domain !== domain || prev.id !== id) &&
      now - prev.timestamp < CO_NAV_WINDOW
    ) {
      firedRef.current = true;
      // Fire and forget
      api.post('/links/heat-edge', {
        source_type: prev.domain,
        source_id: prev.id,
        target_type: domain,
        target_id: id,
      }).catch(() => {
        // Silent fail — co-navigation is best-effort
      });
    }

    // Update last viewed
    lastViewed = { domain, id, timestamp: now };

    return () => {
      firedRef.current = false;
    };
  }, [domain, id]);
}
