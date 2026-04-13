/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 *
 * Displays current thinking level as a signal-bars icon in the bottom bar.
 * Fetches from /managed-agents/advanced-config on mount.
 */

import { useState, useEffect } from 'react';
import { api } from '@/services/api';

const LEVELS: Record<string, { bars: number; label: string }> = {
  off:      { bars: 0, label: 'Thinking: Off' },
  minimal:  { bars: 1, label: 'Thinking: Minimal' },
  low:      { bars: 2, label: 'Thinking: Low' },
  medium:   { bars: 3, label: 'Thinking: Medium' },
  high:     { bars: 4, label: 'Thinking: High' },
  xhigh:    { bars: 5, label: 'Thinking: X-High' },
  adaptive: { bars: -1, label: 'Thinking: Adaptive (auto)' },
};

function SignalBars({ bars, size = 16 }: { bars: number; size?: number }) {
  const totalBars = 5;
  const barWidth = size / (totalBars * 2);
  const gap = barWidth * 0.4;
  const totalWidth = totalBars * (barWidth + gap) - gap;
  const startX = (size - totalWidth) / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {Array.from({ length: totalBars }, (_, i) => {
        const barHeight = ((i + 1) / totalBars) * (size * 0.75);
        const x = startX + i * (barWidth + gap);
        const y = size - 1 - barHeight;
        const active = i < bars;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={barWidth * 0.3}
            fill={active ? 'var(--text-dim)' : 'var(--text-muted)'}
            opacity={active ? 1 : 0.3}
          />
        );
      })}
    </svg>
  );
}

function AdaptiveIcon({ size = 16 }: { size?: number }) {
  // Signal bars with an "A" overlay for adaptive mode
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <SignalBars bars={4} size={size} />
      <span style={{
        position: 'absolute',
        top: -1,
        right: -2,
        fontSize: size * 0.45,
        fontWeight: 800,
        color: 'var(--amber)',
        lineHeight: 1,
        fontFamily: 'var(--font-sans)',
      }}>
        A
      </span>
    </div>
  );
}

export function ThinkingLevelIndicator() {
  const [level, setLevel] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: { thinking: { thinking_default: string } } }>('/managed-agents/advanced-config')
      .then(res => setLevel(res.data.thinking.thinking_default))
      .catch(() => setLevel(null));
  }, []);

  if (!level) return null;

  const config = LEVELS[level] ?? LEVELS.medium;
  const isAdaptive = level === 'adaptive';

  return (
    <div
      title={config.label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        cursor: 'default',
        flexShrink: 0,
      }}
    >
      {isAdaptive ? (
        <AdaptiveIcon size={20} />
      ) : (
        <SignalBars bars={config.bars} size={20} />
      )}
    </div>
  );
}
