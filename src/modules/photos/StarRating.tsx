import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

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
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
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
          }}
        >
          {star <= displayValue ? '★' : '☆'}
        </span>
      ))}
      {showValue && value > 0 && (
        <span
          style={{
            fontSize: size * 0.75,
            color: 'rgba(255,255,255,0.5)',
            fontFamily: 'var(--font-sans)',
            marginLeft: 2,
          }}
        >
          ({value.toFixed(1)})
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
          manual
        </span>
      )}
      {onReset && (
        <button
          onClick={(e) => { e.stopPropagation(); onReset(); }}
          title="Reset to AI score"
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
