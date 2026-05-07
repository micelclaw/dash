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

// ─── Sensor Fusion service ──────────────────────────────────────────
//
// Wraps `/api/v1/sensor-fusion/*` endpoints used by SensorFusionSection.
// Status of the Home Assistant bridge + zone mapping (presence sensors
// that the fusion engine subscribes to).

import { api } from './api';

export interface SensorZone {
  id: string;
  name: string;
  haEntity: string;
}

export interface FusionStatus {
  haConnected: boolean;
  rulesActive: number;
  lastEvent: string | null;
}

export async function getFusionStatus(): Promise<FusionStatus> {
  const res = await api.get<{ data: FusionStatus }>('/sensor-fusion/status');
  return res.data;
}

export async function listZones(): Promise<SensorZone[]> {
  const res = await api.get<{ data: SensorZone[] }>('/sensor-fusion/zones');
  return res.data ?? [];
}

/**
 * Replace the zone list. Backend treats this as a full replace —
 * existing zones not in `zones` are deleted.
 */
export async function replaceZones(
  zones: Array<{ name: string; ha_entity: string }>,
): Promise<void> {
  await api.put('/sensor-fusion/zones', { zones });
}
