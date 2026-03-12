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

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-media-query';

interface SplitPaneProps {
  children: [ReactNode, ReactNode] | [ReactNode, ReactNode, ReactNode];
  direction?: 'horizontal' | 'vertical';
  defaultSizes?: number[];
  minSizes?: number[];
  maxSizes?: number[];
  onResize?: (sizes: number[]) => void;
  id?: string;
  className?: string;
}

export function SplitPane({
  children,
  direction = 'horizontal',
  defaultSizes,
  minSizes,
  maxSizes,
  onResize,
  id,
  className,
}: SplitPaneProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const count = children.length;

  // Initialize sizes
  const getInitialSizes = (): number[] => {
    if (id) {
      try {
        const stored = localStorage.getItem(`splitpane-${id}`);
        if (stored) return JSON.parse(stored) as number[];
      } catch { /* ignore */ }
    }
    if (defaultSizes && defaultSizes.length === count) return defaultSizes;
    return Array(count).fill(100 / count);
  };

  const [sizes, setSizes] = useState<number[]>(getInitialSizes);
  const [activeMobilePanel, setActiveMobilePanel] = useState(0);
  const draggingRef = useRef<{ index: number; startPos: number; startSizes: number[] } | null>(null);

  // Persist sizes
  useEffect(() => {
    if (id) {
      localStorage.setItem(`splitpane-${id}`, JSON.stringify(sizes));
    }
  }, [sizes, id]);

  const handlePointerDown = useCallback((index: number, e: React.PointerEvent) => {
    e.preventDefault();
    const startPos = direction === 'horizontal' ? e.clientX : e.clientY;
    draggingRef.current = { index, startPos, startSizes: [...sizes] };

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
  }, [direction, sizes]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !containerRef.current) return;

    const { index, startPos, startSizes } = draggingRef.current;
    const container = containerRef.current;
    const totalSize = direction === 'horizontal' ? container.offsetWidth : container.offsetHeight;
    const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
    const delta = ((currentPos - startPos) / totalSize) * 100;

    const newSizes = [...startSizes];
    const leftIdx = index;
    const rightIdx = index + 1;

    let newLeft = startSizes[leftIdx]! + delta;
    let newRight = startSizes[rightIdx]! - delta;

    // Apply min constraints
    if (minSizes) {
      const minLeftPct = (minSizes[leftIdx]! / totalSize) * 100;
      const minRightPct = (minSizes[rightIdx]! / totalSize) * 100;
      if (newLeft < minLeftPct) { newRight += newLeft - minLeftPct; newLeft = minLeftPct; }
      if (newRight < minRightPct) { newLeft += newRight - minRightPct; newRight = minRightPct; }
    }

    // Apply max constraints
    if (maxSizes) {
      const maxLeftPct = maxSizes[leftIdx] ? (maxSizes[leftIdx]! / totalSize) * 100 : 100;
      const maxRightPct = maxSizes[rightIdx] ? (maxSizes[rightIdx]! / totalSize) * 100 : 100;
      if (newLeft > maxLeftPct) { newRight += newLeft - maxLeftPct; newLeft = maxLeftPct; }
      if (newRight > maxRightPct) { newLeft += newRight - maxRightPct; newRight = maxRightPct; }
    }

    newSizes[leftIdx] = newLeft;
    newSizes[rightIdx] = newRight;

    setSizes(newSizes);
    onResize?.(newSizes);
  }, [direction, minSizes, maxSizes, onResize]);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  // Mobile: stacked layout
  if (isMobile) {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Mobile tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {children.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveMobilePanel(i)}
              style={{
                flex: 1,
                padding: '8px',
                background: i === activeMobilePanel ? 'var(--surface-hover)' : 'transparent',
                border: 'none',
                borderBottom: i === activeMobilePanel ? '2px solid var(--amber)' : '2px solid transparent',
                color: i === activeMobilePanel ? 'var(--text)' : 'var(--text-dim)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Panel {i + 1}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {children[activeMobilePanel]}
        </div>
      </div>
    );
  }

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {children.map((child, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <div
            style={{
              [isHorizontal ? 'width' : 'height']: `${sizes[i]}%`,
              overflow: 'auto',
              minWidth: isHorizontal ? (minSizes?.[i] ?? 0) : undefined,
              minHeight: !isHorizontal ? (minSizes?.[i] ?? 0) : undefined,
            }}
          >
            {child}
          </div>
          {i < count - 1 && (
            <div
              onPointerDown={(e) => handlePointerDown(i, e)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                [isHorizontal ? 'width' : 'height']: 4,
                flexShrink: 0,
                background: 'var(--border)',
                cursor: isHorizontal ? 'col-resize' : 'row-resize',
                transition: 'background var(--transition-fast)',
                touchAction: 'none',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--border-hover)'; }}
              onMouseLeave={(e) => { if (!draggingRef.current) e.currentTarget.style.background = 'var(--border)'; }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
