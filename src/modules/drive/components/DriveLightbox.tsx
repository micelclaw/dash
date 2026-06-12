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

import { useEffect, useCallback, useRef, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Image, Download, Star, Info, ZoomIn, ZoomOut,
} from 'lucide-react';
import { formatFileSize, getPreviewUrl } from '@/lib/file-utils';
import { downloadFile } from '@/lib/file-download';
import type { FileRecord } from '@/types/files';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

interface DriveLightboxProps {
  /** Image files of the current folder/view, in display order. */
  images: FileRecord[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  /** Star toggle wired to the hosting view so its list refreshes. */
  onToggleStar?: (file: FileRecord, starred: boolean) => void;
  /** "Details" → open the inspector for this file (the view closes the lightbox). */
  onDetails?: (file: FileRecord) => void;
}

/**
 * Drive image lightbox (D6) — fullscreen overlay modeled on PhotoLightbox
 * (arrows, swipe, Esc) but standalone: no Photo-AI coupling, plus a "3/12"
 * counter, basic zoom (click or +/- buttons) and a quick-actions bar
 * (Download / Star / Details).
 */
export function DriveLightbox({
  images, currentIndex, onClose, onNavigate, onToggleStar, onDetails,
}: DriveLightboxProps) {
  const file = images[currentIndex];
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Touch/swipe support (same thresholds as PhotoLightbox)
  const pointerStartX = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 50;

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
  }, [currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < images.length - 1) onNavigate(currentIndex + 1);
  }, [currentIndex, images.length, onNavigate]);

  // Keyboard: Esc closes, arrows navigate.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext]);

  // Basic focus trap: focus the dialog on mount, keep Tab cycling inside.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    containerRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  const handleTabTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !containerRef.current) return;
    const focusables = containerRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  // Reset zoom + image state when the photo changes.
  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
    setZoom(1);
  }, [file?.id]);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartX.current = e.clientX;
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (pointerStartX.current === null) return;
    const dx = e.clientX - pointerStartX.current;
    // Swipe only when not zoomed in (zoom>1 pans by scrolling instead).
    if (zoom === 1 && Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx > 0) goPrev();
      else goNext();
    }
    pointerStartX.current = null;
  };

  const zoomIn = useCallback(() => setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP)), []);
  const toggleZoom = useCallback(() => setZoom(z => (z === 1 ? 2 : 1)), []);

  if (!file) return null;

  const previewUrl = getPreviewUrl(file.id, 2048);

  const navBtnStyle = (id: string, disabled: boolean): React.CSSProperties => ({
    width: 40,
    height: 40,
    borderRadius: 'var(--radius-full)',
    border: 'none',
    background: hoveredBtn === id && !disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
    color: disabled ? 'rgba(255,255,255,0.2)' : '#fff',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background var(--transition-fast)',
    flexShrink: 0,
  });

  const actionBtnStyle = (id: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 12px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: hoveredBtn === id ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.75)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontFamily: 'var(--font-sans)',
    transition: 'background var(--transition-fast)',
  });

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Image preview: ${file.filename}`}
      tabIndex={-1}
      onKeyDown={handleTabTrap}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(0,0,0,0.92)',
        outline: 'none',
      }}
    >
      {/* Top bar: counter + zoom + close */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px', flexShrink: 0,
      }}>
        <span style={{
          fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)',
          fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums',
        }}>
          {currentIndex + 1}/{images.length}
        </span>

        <div style={{ flex: 1 }} />

        <button
          onClick={zoomOut}
          onMouseEnter={() => setHoveredBtn('zoom-out')}
          onMouseLeave={() => setHoveredBtn(null)}
          disabled={zoom <= MIN_ZOOM}
          title="Zoom out"
          aria-label="Zoom out"
          style={navBtnStyle('zoom-out', zoom <= MIN_ZOOM)}
        >
          <ZoomOut size={17} />
        </button>
        <span style={{
          fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', width: 44,
          textAlign: 'center', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={zoomIn}
          onMouseEnter={() => setHoveredBtn('zoom-in')}
          onMouseLeave={() => setHoveredBtn(null)}
          disabled={zoom >= MAX_ZOOM}
          title="Zoom in"
          aria-label="Zoom in"
          style={navBtnStyle('zoom-in', zoom >= MAX_ZOOM)}
        >
          <ZoomIn size={17} />
        </button>

        <button
          onClick={onClose}
          onMouseEnter={() => setHoveredBtn('close')}
          onMouseLeave={() => setHoveredBtn(null)}
          title="Close (Esc)"
          aria-label="Close image preview"
          style={navBtnStyle('close', false)}
        >
          <X size={18} />
        </button>
      </div>

      {/* Image + arrows */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 12px', minHeight: 0,
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          onMouseEnter={() => setHoveredBtn('prev')}
          onMouseLeave={() => setHoveredBtn(null)}
          disabled={currentIndex === 0}
          title="Previous (←)"
          aria-label="Previous image"
          style={navBtnStyle('prev', currentIndex === 0)}
        >
          <ChevronLeft size={20} />
        </button>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            overflow: zoom > 1 ? 'auto' : 'hidden',
            display: 'flex',
            alignItems: zoom > 1 ? 'flex-start' : 'center',
            justifyContent: zoom > 1 ? 'flex-start' : 'center',
            position: 'relative',
          }}
        >
          {!imgError ? (
            <>
              <img
                src={previewUrl}
                alt={file.filename}
                onError={() => setImgError(true)}
                onLoad={() => setImgLoaded(true)}
                onClick={toggleZoom}
                onDragStart={(e) => e.preventDefault()}
                style={zoom > 1 ? {
                  width: `${zoom * 100}%`,
                  maxWidth: 'none',
                  height: 'auto',
                  cursor: 'zoom-out',
                  opacity: imgLoaded ? 1 : 0,
                  transition: 'opacity 0.2s',
                } : {
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  cursor: 'zoom-in',
                  opacity: imgLoaded ? 1 : 0,
                  transition: 'opacity 0.2s',
                }}
              />
              {!imgLoaded && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Image size={56} style={{ opacity: 0.25, color: '#fff' }} />
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, margin: 'auto' }}>
              <Image size={56} style={{ opacity: 0.25, color: '#fff' }} />
              <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
                {file.filename}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          onMouseEnter={() => setHoveredBtn('next')}
          onMouseLeave={() => setHoveredBtn(null)}
          disabled={currentIndex === images.length - 1}
          title="Next (→)"
          aria-label="Next image"
          style={navBtnStyle('next', currentIndex === images.length - 1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Bottom bar: name + quick actions */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        padding: '10px 24px 14px', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span
          title={file.filename}
          style={{
            fontSize: '0.8125rem', color: 'rgba(255,255,255,0.85)',
            fontFamily: 'var(--font-sans)', fontWeight: 500,
            maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {file.filename}
        </span>
        {file.size_bytes > 0 && (
          <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-sans)' }}>
            {formatFileSize(file.size_bytes)}
          </span>
        )}

        <button
          onClick={() => { void downloadFile(file.id, file.filename); }}
          onMouseEnter={() => setHoveredBtn('download')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={actionBtnStyle('download')}
        >
          <Download size={13} /> Download
        </button>

        {onToggleStar && (
          <button
            onClick={() => onToggleStar(file, !file.starred)}
            onMouseEnter={() => setHoveredBtn('star')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              ...actionBtnStyle('star'),
              color: file.starred ? 'var(--amber)' : 'rgba(255,255,255,0.75)',
            }}
          >
            <Star size={13} fill={file.starred ? 'currentColor' : 'none'} />
            {file.starred ? 'Starred' : 'Star'}
          </button>
        )}

        {onDetails && (
          <button
            onClick={() => onDetails(file)}
            onMouseEnter={() => setHoveredBtn('details')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={actionBtnStyle('details')}
          >
            <Info size={13} /> Details
          </button>
        )}
      </div>
    </div>
  );
}
