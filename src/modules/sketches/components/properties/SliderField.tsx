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

// ─── Campo slider con etiqueta + valor en vivo ──────────

import { Slider } from '@/components/ui/slider';
import { miniLabelStyle } from './shared';

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={miniLabelStyle}>{label}</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text, #e2e8f0)' }}>
          {value}{suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v ?? 0)}
        className="w-full [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-range]]:bg-amber-500 [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-amber-500"
      />
    </div>
  );
}
