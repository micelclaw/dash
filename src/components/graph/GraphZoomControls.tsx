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

import { ZoomIn, ZoomOut, Maximize, Pause, Play, Eye, EyeOff } from 'lucide-react';

interface GraphZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onToggleFreeze: () => void;
  frozen: boolean;
  onToggleHulls: () => void;
  showHulls: boolean;
}

const BTN_STYLE: React.CSSProperties = {
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-dim)',
  borderRadius: 'var(--radius-sm)',
  transition: 'color var(--transition-fast), background var(--transition-fast)',
};

export function GraphZoomControls({
  onZoomIn, onZoomOut, onZoomReset, onToggleFreeze, frozen, onToggleHulls, showHulls,
}: GraphZoomControlsProps) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      right: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      background: 'rgba(12, 12, 16, 0.8)',
      backdropFilter: 'blur(8px)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 4,
    }}>
      <button
        onClick={onZoomIn}
        style={BTN_STYLE}
        title="Zoom in"
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'none'; }}
      >
        <ZoomIn size={16} />
      </button>
      <button
        onClick={onZoomOut}
        style={BTN_STYLE}
        title="Zoom out"
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'none'; }}
      >
        <ZoomOut size={16} />
      </button>
      <button
        onClick={onToggleHulls}
        style={{
          ...BTN_STYLE,
          color: showHulls ? 'var(--amber)' : 'var(--text-dim)',
        }}
        title={showHulls ? 'Hide clusters' : 'Show clusters'}
        onMouseEnter={e => { if (!showHulls) e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = showHulls ? 'var(--amber)' : 'var(--text-dim)'; e.currentTarget.style.background = 'none'; }}
      >
        {showHulls ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
      <button
        onClick={onZoomReset}
        style={BTN_STYLE}
        title="Reset zoom"
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'none'; }}
      >
        <Maximize size={16} />
      </button>

      <div style={{ height: 1, background: 'var(--border)', margin: '2px 4px' }} />

      <button
        onClick={onToggleFreeze}
        style={{
          ...BTN_STYLE,
          color: frozen ? 'var(--amber)' : 'var(--text-dim)',
        }}
        title={frozen ? 'Resume simulation' : 'Freeze simulation'}
        onMouseEnter={e => { if (!frozen) e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = frozen ? 'var(--amber)' : 'var(--text-dim)'; e.currentTarget.style.background = 'none'; }}
      >
        {frozen ? <Play size={16} /> : <Pause size={16} />}
      </button>
    </div>
  );
}
