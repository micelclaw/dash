import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { MOOD_CONFIG, type MoodLevel } from './types';

interface MoodSelectorProps {
  value: MoodLevel | null;
  onChange: (mood: MoodLevel) => void;
}

const MOODS = Object.entries(MOOD_CONFIG) as [MoodLevel, (typeof MOOD_CONFIG)[MoodLevel]][];

export function MoodSelector({ value, onChange }: MoodSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const current = value ? MOOD_CONFIG[value] : null;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: current ? current.color : 'var(--text-muted)',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          transition: 'border-color var(--transition-fast)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
      >
        {current ? (
          <><span>{current.emoji}</span> <span>{current.label}</span></>
        ) : (
          <span>Set mood</span>
        )}
        <ChevronDown size={12} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 'var(--z-dropdown)' as unknown as number,
            overflow: 'hidden',
            minWidth: 140,
          }}
        >
          {MOODS.map(([key, config]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                background: value === key ? 'var(--surface-hover)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: config.color,
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = value === key ? 'var(--surface-hover)' : 'transparent'; }}
            >
              <span>{config.emoji}</span>
              <span>{config.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
