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

import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface InfoTooltipProps {
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function InfoTooltip({ children, side = 'top' }: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', padding: 0,
              cursor: 'help', color: 'var(--text-muted)',
              verticalAlign: 'middle', lineHeight: 1,
            }}
          >
            <HelpCircle size={12} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} style={{ maxWidth: 260, lineHeight: 1.5 }}>
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
