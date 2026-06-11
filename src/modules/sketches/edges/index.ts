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

import type { EdgeTypes } from '@xyflow/react';
import { LabeledEdge } from './LabeledEdge';
import { SmartEdge } from './SmartEdge';
import { ElbowEdge } from './ElbowEdge';
import { CurvedEdge } from './CurvedEdge';

export const edgeTypes: EdgeTypes = {
  labeled: LabeledEdge,
  smoothstep: LabeledEdge,
  step: LabeledEdge,
  straight: LabeledEdge,
  default: LabeledEdge,
  smart: SmartEdge,
  elbow: ElbowEdge,
  curved: CurvedEdge,
};
