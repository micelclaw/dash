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

import {
  Globe, Loader2, ZoomIn, ZoomOut, RotateCcw,
  ChevronLeft, ChevronRight, Download, Trash2,
} from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import type { BrowserSessionState } from '@/stores/canvas.store';
import { BrowserStatusBar } from './BrowserStatusBar';
import { BrowserActionLog } from './BrowserActionLog';

export interface PersistedScreenshot {
  id: string;
  conversation_id: string;
  url: string | null;
  filename: string;
  mime_type: string;
  size_bytes: number | null;
  created_at: string;
  // Loaded on demand
  base64?: string;
}

interface BrowserSessionViewProps {
  session: BrowserSessionState;
  persistedScreenshots?: PersistedScreenshot[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
  onDelete?: (screenshotId: string) => void;
  onDownload?: (screenshotId: string) => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'rgba(255,255,255,0.7)',
  cursor: 'pointer',
  padding: 4,
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  lineHeight: 1,
};

const btnStyleDisabled: React.CSSProperties = {
  ...btnStyle,
  color: 'rgba(255,255,255,0.2)',
  cursor: 'default',
};

export function BrowserSessionView({
  session,
  persistedScreenshots = [],
  currentIndex = 0,
  onNavigate,
  onDelete,
  onDownload,
}: BrowserSessionViewProps) {
  const isActive = session.status === 'active';
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalScreenshots = persistedScreenshots.length;
  const hasPersisted = totalScreenshots > 0;
  const canPrev = hasPersisted && currentIndex > 0;
  const canNext = hasPersisted && currentIndex < totalScreenshots - 1;

  // Current screenshot base64: from persisted list or from live session
  const currentScreenshot = hasPersisted
    ? persistedScreenshots[currentIndex]
    : undefined;
  const snapshotBase64 = currentScreenshot?.base64 ?? session.snapshot;
  const snapshotMime = currentScreenshot?.mime_type ?? 'image/png';

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.005)));
  }, []);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP)), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  const goPrev = useCallback(() => {
    if (canPrev && onNavigate) onNavigate(currentIndex - 1);
  }, [canPrev, currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (canNext && onNavigate) onNavigate(currentIndex + 1);
  }, [canNext, currentIndex, onNavigate]);

  const handleDelete = useCallback(() => {
    if (currentScreenshot && onDelete) onDelete(currentScreenshot.id);
  }, [currentScreenshot, onDelete]);

  const handleDownload = useCallback(() => {
    if (currentScreenshot && onDownload) onDownload(currentScreenshot.id);
  }, [currentScreenshot, onDownload]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Screenshot area — scrollable + zoomable */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        style={{
          flex: 1,
          position: 'relative',
          background: '#1a1a2e',
          overflow: 'auto',
          minHeight: 0,
        }}
      >
        {snapshotBase64 ? (
          <img
            src={`data:${snapshotMime};base64,${snapshotBase64}`}
            alt="Browser screenshot"
            draggable={false}
            style={{
              width: `${100 * zoom}%`,
              display: 'block',
              transformOrigin: 'top left',
            }}
          />
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 12,
            color: 'rgba(255,255,255,0.4)',
          }}>
            {isActive ? (
              <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Globe size={28} />
            )}
            <span style={{ fontSize: 12 }}>
              {isActive ? 'Waiting for screenshot...' : 'No screenshot available'}
            </span>
          </div>
        )}

        {/* Floating toolbar — bottom right */}
        {snapshotBase64 && (
          <div style={{
            position: 'sticky',
            bottom: 44,
            float: 'right',
            marginRight: 8,
            display: 'flex',
            gap: 2,
            background: 'rgba(0,0,0,0.75)',
            borderRadius: 6,
            padding: '4px 6px',
            backdropFilter: 'blur(8px)',
            zIndex: 10,
          }}>
            {/* Navigation arrows */}
            {hasPersisted && (
              <>
                <button onClick={goPrev} title="Previous screenshot" style={canPrev ? btnStyle : btnStyleDisabled} disabled={!canPrev}>
                  <ChevronLeft size={14} />
                </button>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, lineHeight: '24px', padding: '0 2px', minWidth: 30, textAlign: 'center' }}>
                  {currentIndex + 1}/{totalScreenshots}
                </span>
                <button onClick={goNext} title="Next screenshot" style={canNext ? btnStyle : btnStyleDisabled} disabled={!canNext}>
                  <ChevronRight size={14} />
                </button>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.15)', margin: '4px 2px' }} />
              </>
            )}

            {/* Zoom controls */}
            <button onClick={zoomOut} title="Zoom out" style={btnStyle}>
              <ZoomOut size={14} />
            </button>
            <button onClick={zoomReset} title="Reset zoom" style={btnStyle}>
              <RotateCcw size={14} />
            </button>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, lineHeight: '24px', padding: '0 2px' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={zoomIn} title="Zoom in" style={btnStyle}>
              <ZoomIn size={14} />
            </button>

            {/* Download & Delete */}
            {currentScreenshot && (
              <>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.15)', margin: '4px 2px' }} />
                <button onClick={handleDownload} title="Download" style={btnStyle}>
                  <Download size={14} />
                </button>
                <button onClick={handleDelete} title="Delete" style={{ ...btnStyle, color: 'rgba(239,68,68,0.7)' }}>
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Status bar overlay at bottom */}
        <div style={{
          position: 'sticky',
          bottom: 8,
          left: 8,
          right: 8,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <BrowserStatusBar
            url={currentScreenshot?.url ?? session.currentUrl}
            humanizedAction={session.humanizedAction}
            isActive={isActive}
          />
        </div>
      </div>

      {/* Action log */}
      <BrowserActionLog actions={session.actions} />

      {/* Spin keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes canvas-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
