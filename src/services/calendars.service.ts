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

import { api } from '@/services/api';
import type { ApiResponse } from '@/types/api';

export interface CalendarUpdateResult {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  position: number;
}

/** Rename a persisted user calendar and its owned events through Core's CRUD contract. */
export async function renameCalendar(id: string, name: string): Promise<CalendarUpdateResult> {
  const response = await api.patch<ApiResponse<CalendarUpdateResult>>(
    `/calendars/${encodeURIComponent(id)}`,
    { name },
  );
  return response.data;
}
