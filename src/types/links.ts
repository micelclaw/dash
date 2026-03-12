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

export interface EntityLink {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relationship: string | null;
  link_type: string;
  confidence: number;
  strength: number | null;
  heat_edge: number;
  created_by: 'user' | 'llm' | 'system';
  created_at: string;
}

/** A resolved linked record with enough info to display */
export interface LinkedRecord {
  link: EntityLink;
  domain: string;
  record: {
    id: string;
    title: string;
    subtitle?: string;
    route: string;
  };
}
