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

import { useCallback } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

export function ZoomSlider() {
  const reactFlow = useReactFlow();
  const { zoom } = useViewport();

  const zoomPercent = Math.round(zoom * 100);

  const handleZoomIn = useCallback(() => {
    reactFlow.zoomIn({ duration: 200 });
  }, [reactFlow]);

  const handleZoomOut = useCallback(() => {
    reactFlow.zoomOut({ duration: 200 });
  }, [reactFlow]);

  const handleFitView = useCallback(() => {
    reactFlow.fitView({ duration: 300, padding: 0.1 });
  }, [reactFlow]);

  const handleReset = useCallback(() => {
    reactFlow.zoomTo(1, { duration: 200 });
  }, [reactFlow]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value) / 100;
      reactFlow.zoomTo(value, { duration: 100 });
    },
    [reactFlow],
  );

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        background: 'var(--surface, #1a1a1a)',
        border: '1px solid var(--border, #333)',
        borderRadius: 8,
        padding: '6px 4px',
        zIndex: 5,
      }}
    >
      <button onClick={handleZoomIn} style={btnStyle} title="Zoom In">
        <ZoomIn size={14} />
      </button>

      <input
        type="range"
        min={10}
        max={400}
        value={zoomPercent}
        onChange={handleSliderChange}
        title={`${zoomPercent}%`}
        style={{
          writingMode: 'vertical-lr',
          direction: 'rtl',
          width: 20,
          height: 80,
          cursor: 'pointer',
          accentColor: 'var(--amber, #d4a017)',
        }}
      />

      <button onClick={handleZoomOut} style={btnStyle} title="Zoom Out">
        <ZoomOut size={14} />
      </button>

      <div
        style={{
          width: '100%',
          height: 1,
          background: 'var(--border, #333)',
          margin: '2px 0',
        }}
      />

      <button
        onClick={handleReset}
        onDoubleClick={handleFitView}
        style={{
          ...btnStyle,
          fontSize: 9,
          fontFamily: 'var(--font-mono, monospace)',
          width: 'auto',
          padding: '2px 4px',
        }}
        title="Click: 100% | Double-click: Fit View"
      >
        {zoomPercent}%
      </button>

      <button onClick={handleFitView} style={btnStyle} title="Fit View">
        <Maximize size={14} />
      </button>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: '1px solid var(--border, #333)',
  borderRadius: 4,
  color: 'var(--text-dim, #94a3b8)',
  cursor: 'pointer',
  padding: 0,
  transition: 'color 0.15s, background 0.15s',
};
