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

import type { Photo } from '@/types/files';

export type PhotosView = 'timeline' | 'albums' | 'people' | 'dejavu' | 'dna';

export interface PhotoGroup {
  label: string;       // "February 2026"
  key: string;         // "2026-02"
  photos: Photo[];
}

export interface PhotoDNASnapshot {
  id: string;
  period_type: 'week' | 'month' | 'quarter' | 'year';
  period_key: string;
  photo_count: number;
  avg_aesthetic: number | null;
  top_faces: Array<{ cluster_id: string; name: string | null; count: number }>;
  top_locations: Array<{ lat: number; lng: number; count: number }>;
  top_tags: Array<{ tag: string; count: number }>;
  mood_summary: Record<string, number> | null;
  created_at: string;
}

export interface PhotoDNAComparison {
  visual_similarity: number | null;
  aesthetic_delta: number | null;
  face_changes: { appeared: string[]; disappeared: string[]; consistent: string[] };
  location_changes: { new_locations: number; dropped_locations: number };
  mood_delta: Record<string, number> | null;
}

export interface DejaVuCollection {
  id: string;
  title: string;
  photo_ids: string[];
  date_range: { earliest: string; latest: string };
  photo_count: number;
}
