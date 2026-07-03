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
import { Star } from 'lucide-react';

export function SetDefaultButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--amber-dim)' : 'transparent',
        color: hovered ? 'var(--amber)' : 'var(--text-dim)',
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 10px',
        fontSize: '0.75rem',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
        display: 'flex', alignItems: 'center', gap: 4,
        opacity: loading ? 0.5 : 1,
      }}
    >
      <Star size={12} />
      {loading ? '...' : 'Set Default'}
    </button>
  );
}

export function ActionButton({ icon, label, loading, onClick, variant, title }: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
  variant: 'primary' | 'danger' | 'secondary';
  title?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const colors = variant === 'primary'
    ? { bg: '#10b98120', color: '#10b981' }
    : variant === 'danger'
      ? { bg: '#ef444420', color: '#ef4444' }
      : { bg: 'var(--amber-dim)', color: 'var(--amber)' };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? colors.bg : 'transparent',
        color: hovered ? colors.color : 'var(--text-dim)',
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 10px',
        fontSize: '0.75rem',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
        display: 'flex', alignItems: 'center', gap: 4,
        opacity: loading ? 0.5 : 1,
      }}
    >
      {icon}
      {loading ? '...' : label}
    </button>
  );
}
