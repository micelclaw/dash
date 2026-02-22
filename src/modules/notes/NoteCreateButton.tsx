import { Plus } from 'lucide-react';

interface NoteCreateButtonProps {
  onClick: () => void;
}

export function NoteCreateButton({ onClick }: NoteCreateButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: 'calc(100% - 24px)',
        margin: '8px 12px',
        padding: '8px 12px',
        background: 'var(--amber)',
        color: '#06060a',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--amber-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--amber)')}
    >
      <Plus size={16} />
      New Note
    </button>
  );
}
