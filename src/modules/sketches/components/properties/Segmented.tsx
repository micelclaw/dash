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

// ─── Segmentos de opciones exclusivas (solid/dashed/…) ──

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
      {options.map((s) => (
        <Button
          key={s}
          variant="ghost"
          size="sm"
          onClick={() => onChange(s)}
          className={cn(
            'h-auto px-2 py-[3px] text-[10px] font-normal capitalize border border-[var(--border,#333)]',
            value === s
              ? 'bg-[var(--amber,#d4a017)] text-black hover:bg-[var(--amber,#d4a017)] hover:text-black'
              : 'bg-[var(--surface,#1e1e1e)] text-[var(--text-dim)]',
          )}
          style={{ borderRadius: 4 }}
        >
          {s}
        </Button>
      ))}
    </div>
  );
}
