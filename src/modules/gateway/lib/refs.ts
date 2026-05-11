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

import type { GatewayModel } from '../types';

/**
 * Validate that a string model reference (alias target, fallback entry,
 * session.model, agent.model, etc.) points to a model present in the
 * Configured list. Returns true while `models` is still empty so we
 * don't false-flag during the brief mount window before the store
 * hydrates.
 */
export function isModelRefValid(target: string, models: GatewayModel[]): boolean {
  if (models.length === 0) return true;
  return models.some(m => m.id === target || m.model === target);
}
