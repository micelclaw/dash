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

import { useSettingsStore } from '@/stores/settings.store';
import { ROW_HEIGHT } from './grid-constants';

export function WorkingHoursOverlay() {
  const cal = useSettingsStore(s => s.settings?.calendar);
  if (!cal?.working_hours_start || !cal?.working_hours_end) return null;

  const [startH, startM] = cal.working_hours_start.split(':').map(Number);
  const [endH, endM] = cal.working_hours_end.split(':').map(Number);
  const startTop = ((startH ?? 0) * 60 + (startM ?? 0)) * (ROW_HEIGHT * 2) / 60;
  const endTop = ((endH ?? 0) * 60 + (endM ?? 0)) * (ROW_HEIGHT * 2) / 60;

  if (endTop <= startTop) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: startTop,
        left: 0,
        right: 0,
        height: endTop - startTop,
        background: 'rgba(212, 160, 23, 0.04)',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
