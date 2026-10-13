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

import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Play, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';

interface MediaCardProps {
  image?: string | null;
  fallbackIcon?: LucideIcon;
  title: string;
  badge?: ReactNode;
  subtitle?: string;
  /** Playback/read progress 0..1, rendered as a thin bar at the cover bottom. */
  progress?: number;
  onClick?: () => void;
  onPlay?: () => void;
  /** DropdownMenuContent children — rendered behind a kebab button top-right. */
  menu?: ReactNode;
  rounded?: 'square' | 'circle';
  /** Cover aspect ratio: 'square' (1:1, default) or 'poster' (2:3). */
  aspect?: 'square' | 'poster';
}

/**
 * Cover card for media grids/rails: hover overlay with a centered play
 * button (when onPlay), kebab context menu (when menu), 1-line title,
 * dimmer subtitle and an optional progress bar over the cover.
 * Defaults to a square cover; `aspect="poster"` renders 2:3 (movies/series).
 */
export function MediaCard({
  image,
  fallbackIcon: FallbackIcon,
  title,
  badge,
  subtitle,
  progress,
  onClick,
  onPlay,
  menu,
  rounded = 'square',
  aspect = 'square',
}: MediaCardProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const isCircle = rounded === 'circle';
  const showImage = !!image && !imgError;
  const overlayVisible = hovered || menuOpen;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: 0,
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Cover */}
      <div
        style={{
          position: 'relative',
          aspectRatio: aspect === 'poster' ? '2 / 3' : '1 / 1',
          borderRadius: isCircle ? '50%' : 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--surface)',
        }}
      >
        {showImage ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {FallbackIcon && <FallbackIcon size={40} style={{ color: 'var(--text-muted)' }} />}
          </div>
        )}

        {/* Hover overlay with centered play button */}
        {onPlay && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.45)',
              opacity: overlayVisible ? 1 : 0,
              pointerEvents: overlayVisible ? 'auto' : 'none',
              transition: 'opacity var(--transition-fast)',
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              title="Play"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: 'var(--amber)',
                color: '#06060a',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />
            </button>
          </div>
        )}

        {/* Kebab menu top-right */}
        {menu && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              opacity: overlayVisible ? 1 : 0,
              pointerEvents: overlayVisible ? 'auto' : 'none',
              transition: 'opacity var(--transition-fast)',
            }}
          >
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  title="More"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 26,
                    height: 26,
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    background: 'rgba(0, 0, 0, 0.6)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  <MoreVertical size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {menu}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Progress bar at cover bottom */}
        {progress !== undefined && progress > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            <div
              style={{
                width: `${Math.min(1, Math.max(0, progress)) * 100}%`,
                height: '100%',
                background: 'var(--amber)',
              }}
            />
          </div>
        )}
      </div>

      {/* Texts */}
      <div style={{ marginTop: 8, textAlign: isCircle ? 'center' : 'left', minWidth: 0 }}>
        <div
          title={title}
          style={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {badge && <span style={{ float: 'right', marginLeft: 4 }}>{badge}</span>}
          {title}
        </div>
        {subtitle && (
          <div
            title={subtitle}
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
