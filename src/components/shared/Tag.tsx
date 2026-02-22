import { X } from 'lucide-react';

interface TagProps {
  label: string;
  color?: string;
  removable?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  size?: 'sm' | 'md';
  variant?: 'filled' | 'outline';
}

export function Tag({
  label,
  color = 'var(--amber)',
  removable = false,
  onRemove,
  onClick,
  size = 'md',
  variant = 'filled',
}: TagProps) {
  const height = size === 'sm' ? 20 : 24;
  const fontSize = size === 'sm' ? '0.6875rem' : '0.75rem';

  const isFilled = variant === 'filled';
  const bgStyle = isFilled ? { background: `color-mix(in srgb, ${color} 15%, transparent)` } : { background: 'transparent' };
  const borderStyle = isFilled ? {} : { border: `1px solid ${color}` };

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height,
        padding: `0 ${removable ? 4 : 8}px 0 8px`,
        borderRadius: 'var(--radius-full)',
        color,
        fontSize,
        fontFamily: 'var(--font-sans)',
        cursor: onClick ? 'pointer' : 'default',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...bgStyle,
        ...borderStyle,
      }}
    >
      {label}
      {removable && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'inherit',
            padding: 0,
            opacity: 0.7,
          }}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
