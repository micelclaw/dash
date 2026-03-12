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

import { Zap } from 'lucide-react';

export function Component() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-dim)' }}>
      <Zap size={32} style={{ color: '#f59e0b' }} />
      <span style={{ fontSize: 16, fontWeight: 500 }}>Lightning Management</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Coming soon — channel management, payments, and forwarding via CLNRest</span>
    </div>
  );
}
