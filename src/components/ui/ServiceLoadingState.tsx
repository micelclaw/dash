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

import { Loader2 } from 'lucide-react';

interface ServiceLoadingStateProps {
  displayName: string;
  estimatedSeconds?: number;
}

export function ServiceLoadingState({ displayName, estimatedSeconds }: ServiceLoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-[var(--text-dim)]">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--amber)]" />
      <div className="text-center">
        <p className="text-sm font-medium text-[var(--text)]">
          Starting {displayName}...
        </p>
        {estimatedSeconds && (
          <p className="mt-1 text-xs">
            Usually takes {estimatedSeconds}s
          </p>
        )}
      </div>
    </div>
  );
}
