import { Search, X } from 'lucide-react';

interface GraphSearchInputProps {
  value: string;
  onChange: (v: string) => void;
}

export function GraphSearchInput({ value, onChange }: GraphSearchInputProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 8px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      minWidth: 160,
    }}>
      <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search entities..."
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text)',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-sans)',
          minWidth: 0,
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 0, display: 'flex',
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
