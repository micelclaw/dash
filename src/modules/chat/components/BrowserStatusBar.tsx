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

interface BrowserStatusBarProps {
  url: string | null;
  humanizedAction: string | null;
  isActive: boolean;
}

export function BrowserStatusBar({ url, humanizedAction, isActive }: BrowserStatusBarProps) {
  const displayUrl = url ? truncateUrl(url, 50) : 'Starting browser...';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px',
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      borderRadius: 'var(--radius-md)',
      fontSize: 12,
      color: '#fff',
      maxWidth: '90%',
    }}>
      {/* Pulsing dot when active */}
      {isActive && (
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#22c55e',
          flexShrink: 0,
          animation: 'canvas-pulse 2s ease-in-out infinite',
        }} />
      )}

      {/* URL */}
      <span style={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>
        {displayUrl}
      </span>

      {/* Humanized action */}
      {humanizedAction && (
        <>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
          <span style={{
            color: 'rgba(255,255,255,0.85)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {humanizedAction}
          </span>
        </>
      )}
    </div>
  );
}

function truncateUrl(url: string, max: number): string {
  try {
    const u = new URL(url);
    const display = u.hostname + (u.pathname !== '/' ? u.pathname : '');
    return display.length > max ? display.slice(0, max) + '...' : display;
  } catch {
    return url.length > max ? url.slice(0, max) + '...' : url;
  }
}
