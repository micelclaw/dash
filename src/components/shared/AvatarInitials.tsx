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

import { useState } from 'react';

interface AvatarInitialsProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: 24, md: 32, lg: 44 };
const FONT_SIZES = { sm: '0.5625rem', md: '0.6875rem', lg: '0.875rem' };

function nameToColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 45%)`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]![0]?.toUpperCase() ?? '?';
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function AvatarInitials({ name, src, size = 'md', className }: AvatarInitialsProps) {
  const [imgError, setImgError] = useState(false);
  const px = SIZES[size];
  const bg = nameToColor(name);
  const initials = getInitials(name);

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        className={className}
        style={{
          width: px,
          height: px,
          borderRadius: 'var(--radius-full)',
          objectFit: 'cover',
        }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        width: px,
        height: px,
        borderRadius: 'var(--radius-full)',
        background: bg,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: FONT_SIZES[size],
        fontWeight: 600,
        flexShrink: 0,
        userSelect: 'none',
      }}
      title={name}
    >
      {initials}
    </div>
  );
}
