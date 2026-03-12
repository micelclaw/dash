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

import { ToolsLauncher } from './ToolsLauncher';

export function Component() {
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 32px' }}>
      <ToolsLauncher />
    </div>
  );
}
