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
import { RotateCcw } from 'lucide-react';
import { useI18n } from '@/i18n';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  showValue?: boolean;
  isOverride?: boolean;
  onReset?: () => void;
}

export function StarRating({
  value,
  onChange,
  size = 14,
  showValue,
  isOverride,
  onReset,
}: StarRatingProps) {
  const { t, locale } = useI18n();
  const [hoverStar, setHoverStar] = useState<number | null>(null);
  const interactive = !!onChange;
  const displayValue = hoverStar ?? Math.round(value);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        cursor: interactive ? 'pointer' : 'default',
        userSelect: 'none',
      }}
      onMouseLeave={() => interactive && setHoverStar(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => interactive ? (
        <button
          key={star}
          type="button"
          aria-label={t(star === 1 ? 'photos.starOne' : 'photos.starMany', { count: star })}
          aria-pressed={star === Math.round(value)}
          onClick={(e) => {
            if (!interactive) return;
            e.stopPropagation();
            onChange(star);
          }}
          onMouseEnter={() => interactive && setHoverStar(star)}
          style={{
            fontSize: size,
            lineHeight: 1,
            color: star <= displayValue ? 'var(--amber)' : 'var(--text-muted)',
            transition: 'color 0.1s',
            background: 'none', border: 0, padding: 0, cursor: 'pointer',
          }}
        >
          {star <= displayValue ? '★' : '☆'}
        </button>
      ) : (
        <span key={star} aria-hidden="true" style={{ fontSize: size, lineHeight: 1, color: star <= displayValue ? 'var(--amber)' : 'var(--text-muted)' }}>
          {star <= displayValue ? '★' : '☆'}
        </span>
      ))}
      {!interactive && <span className="sr-only">{t(value === 1 ? 'photos.starOne' : 'photos.starMany', { count: value })}</span>}
      {showValue && value > 0 && (
        <span
          style={{
            fontSize: size * 0.75,
            color: 'rgba(255,255,255,0.5)',
            fontFamily: 'var(--font-sans)',
            marginLeft: 2,
          }}
        >
          ({new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)})
        </span>
      )}
      {isOverride && (
        <span
          style={{
            fontSize: size * 0.65,
            color: 'rgba(255,255,255,0.4)',
            fontFamily: 'var(--font-sans)',
            marginLeft: 2,
          }}
        >
          {t('photos.manualRating')}
        </span>
      )}
      {onReset && (
        <button
          onClick={(e) => { e.stopPropagation(); onReset(); }}
          title={t('photos.resetRating')}
          aria-label={t('photos.resetRating')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            marginLeft: 2,
          }}
        >
          <RotateCcw size={size * 0.7} />
        </button>
      )}
    </span>
  );
}
