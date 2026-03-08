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
