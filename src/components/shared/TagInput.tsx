import { useState } from 'react';
import { Plus } from 'lucide-react';
import { TagChip } from './TagChip';

interface TagInputProps {
  tags: string[];
  /** Recibe la lista completa ya actualizada. El padre decide la persistencia
   *  (inmediata con PATCH, o en estado de formulario para guardar on-submit). */
  onChange: (next: string[]) => void;
  placeholder?: string;
  size?: 'xs' | 'sm';
  /** Texto del botón de añadir. */
  addLabel?: string;
}

/**
 * Editor de etiquetas unificado para todos los dominios (patrón de Notas):
 * chips coloreados con X + botón "+tag" que abre un input inline.
 * Enter o coma añaden; Escape cancela; blur con texto confirma.
 * Normaliza `trim().toLowerCase()` y evita duplicados.
 */
export function TagInput({ tags, onChange, placeholder = 'etiqueta', size = 'sm', addLabel = 'tag' }: TagInputProps) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const fontSize = size === 'xs' ? '0.625rem' : '0.6875rem';

  const add = () => {
    const t = input.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput('');
  };
  const remove = (tag: string) => onChange(tags.filter((x) => x !== tag));

  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
      {tags.map((tag) => (
        <TagChip key={tag} tag={tag} size={size} onRemove={() => remove(tag)} />
      ))}

      {open ? (
        <input
          value={input}
          autoFocus
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
            if (e.key === 'Escape') {
              setOpen(false);
              setInput('');
            }
          }}
          onBlur={() => {
            add();
            setOpen(false);
          }}
          placeholder={placeholder}
          style={{
            width: 90,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 7px',
            fontSize,
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 7px',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize,
            fontFamily: 'var(--font-sans)',
            transition: 'border-color var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          <Plus size={10} />
          {addLabel}
        </button>
      )}
    </div>
  );
}
