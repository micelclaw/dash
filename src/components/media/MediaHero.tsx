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

interface MediaHeroProps {
  image?: string | null;
  fallbackIcon?: LucideIcon;
  /** Small uppercase label above the title (e.g. "Album", "Artist"). */
  kicker?: string;
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  rounded?: 'square' | 'circle';
}

/**
 * Detail-page header for media modules: big cover art (~192px) on the left,
 * kicker / title / subtitle / meta / actions stacked on the right.
 */
export function MediaHero({
  image,
  fallbackIcon: FallbackIcon,
  kicker,
  title,
  subtitle,
  meta,
  actions,
  rounded = 'square',
}: MediaHeroProps) {
  const [imgError, setImgError] = useState(false);
  const isCircle = rounded === 'circle';
  const showImage = !!image && !imgError;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 24,
        padding: 16,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Art */}
      <div
        style={{
          width: 192,
          height: 192,
          flexShrink: 0,
          borderRadius: isCircle ? '50%' : 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--surface)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {showImage ? (
          <img
            src={image}
            alt=""
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          FallbackIcon && <FallbackIcon size={64} style={{ color: 'var(--text-muted)' }} />
        )}
      </div>

      {/* Text stack */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {kicker && (
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}
          >
            {kicker}
          </span>
        )}
        <h1
          title={title}
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
            lineHeight: 1.15,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>{subtitle}</div>
        )}
        {meta && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{meta}</div>
        )}
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
