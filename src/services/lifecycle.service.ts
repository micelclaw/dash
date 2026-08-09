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

import { api } from './api';
import type { ResourcePolicyPatch } from '@/stores/services.store';

export async function updateServiceResourcePolicy(
  serviceName: string,
  patch: ResourcePolicyPatch,
): Promise<void> {
  await api.patch(`/services/${encodeURIComponent(serviceName)}/resource-policy`, patch);
}
