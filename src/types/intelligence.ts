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

export type HeatTier = 'hot' | 'warm' | 'cold';

export interface SimilarItem {
  domain: string;
  record_id: string;
  similarity: number;
  title: string;
  heat_score: number;
}

export interface GraphNode {
  id: string;
  name: string;
  entity_type: string;
  mention_count: number;
  aliases: string[];
  metadata: Record<string, unknown>;
  heat_score: number;
}

export interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  relationship: string | null;
  link_type: string;
  confidence: number | null;
  strength: number | null;
  heat_edge: number;
  weight?: number;
}

export interface GraphSubgraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    total_entities: number;
    total_edges: number;
    returned_entities: number;
    returned_edges: number;
  };
}

export interface GraphStats {
  entities: {
    total: number;
    by_type: Record<string, number>;
  };
  connections: {
    total: number;
    by_created_by: Record<string, number>;
  };
  merge_candidates_count: number;
  orphan_count: number;
  last_extraction_at: string | null;
  extraction_queue_pending: number;
}

export interface MergeCandidate {
  entity_a_id: string;
  entity_a_name: string;
  entity_type: string;
  entity_b_id: string;
  entity_b_name: string;
  name_similarity: number;
}

export interface GraphProximityItem {
  id: string;
  name: string;
  entity_type: string;
  mention_count: number;
  confidence: number | null;
  heat_score: number;
}

export function getHeatTier(score: number): HeatTier {
  if (score > 0.7) return 'hot';
  if (score > 0.2) return 'warm';
  return 'cold';
}

export const HEAT_COLORS: Record<HeatTier, string> = {
  hot: '#f43f5e',
  warm: '#fbbf24',
  cold: '#38bdf8',
};
