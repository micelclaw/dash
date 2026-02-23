import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface ContactsFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedTag: string;
  onTagChange: (value: string) => void;
  availableTags: string[];
}

export function ContactsFilters({
  search, onSearchChange, selectedTag, onTagChange, availableTags,
}: ContactsFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(localSearch), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [localSearch, onSearchChange]);

  // Sync external search changes
  useEffect(() => { setLocalSearch(search); }, [search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 12px 0' }}>
      {/* Search input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          value={localSearch}
          onChange={e => setLocalSearch(e.target.value)}
          placeholder="Search contacts..."
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
          }}
        />
        {localSearch && (
          <button
            onClick={() => { setLocalSearch(''); onSearchChange(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tag chips row */}
      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4,
        scrollbarWidth: 'none',
      }}>
        <button
          onClick={() => onTagChange('')}
          style={{
            flexShrink: 0,
            padding: '3px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            background: selectedTag === '' ? 'var(--amber-dim)' : 'var(--surface)',
            border: selectedTag === '' ? '1px solid var(--amber)' : '1px solid var(--border)',
            color: selectedTag === '' ? 'var(--text)' : 'var(--text-dim)',
            transition: 'background var(--transition-fast), border-color var(--transition-fast)',
          }}
        >
          All
        </button>
        {availableTags.map(tag => (
          <button
            key={tag}
            onClick={() => onTagChange(tag === selectedTag ? '' : tag)}
            style={{
              flexShrink: 0,
              padding: '3px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              background: selectedTag === tag ? 'var(--amber-dim)' : 'var(--surface)',
              border: selectedTag === tag ? '1px solid var(--amber)' : '1px solid var(--border)',
              color: selectedTag === tag ? 'var(--text)' : 'var(--text-dim)',
              transition: 'background var(--transition-fast), border-color var(--transition-fast)',
            }}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
