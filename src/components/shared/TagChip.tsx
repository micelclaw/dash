import { X } from 'lucide-react';
import { tagColor } from '@/lib/tag-color';

interface TagChipProps {
  tag: string;
  /** Si se pasa, muestra la X para quitar el tag. */
  onRemove?: () => void;
  /** Click en el chip (p.ej. filtrar por ese tag). No se dispara al pulsar la X. */
  onClick?: () => void;
  size?: 'xs' | 'sm';
}

/**
 * Chip de etiqueta con color determinista por palabra (ver `tag-color.ts`).
 * Usado en TODOS los dominios (notes/contacts/calendar/diary/emails) — vista y edición.
 */
export function TagChip({ tag, onRemove, onClick, size = 'sm' }: TagChipProps) {
  const c = tagColor(tag);
  const fontSize = size === 'xs' ? '0.625rem' : '0.6875rem';
  const padding = size === 'xs' ? '1px 6px' : '2px 7px';
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        maxWidth: '100%',
        padding,
        borderRadius: 'var(--radius-full)',
        fontSize,
        lineHeight: 1.4,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Quitar ${tag}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            color: c.text,
            opacity: 0.7,
          }}
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}
