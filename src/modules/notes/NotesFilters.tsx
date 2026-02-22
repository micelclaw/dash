import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface NotesFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  source: string;
  onSourceChange: (value: string) => void;
  selectedTag: string;
  onTagChange: (value: string) => void;
  availableTags: string[];
}

const SOURCES = [
  { value: '', label: 'All sources' },
  { value: 'local', label: 'Local' },
  { value: 'google_keep', label: 'Google Keep' },
  { value: 'apple_notes', label: 'Apple Notes' },
  { value: 'synology_note', label: 'Synology' },
];

export function NotesFilters({
  search, onSearchChange, source, onSourceChange,
  selectedTag, onTagChange, availableTags,
}: NotesFiltersProps) {
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
          placeholder="Search notes..."
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

      {/* Source + Tag row */}
      <div style={{ display: 'flex', gap: 6 }}>
        {/* Source dropdown */}
        <div style={{ position: 'relative', flex: 1 }}>
          <select
            value={source}
            onChange={e => onSourceChange(e.target.value)}
            style={{
              width: '100%', padding: '5px 24px 5px 8px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)', appearance: 'none', cursor: 'pointer', outline: 'none',
            }}
          >
            {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <ChevronDown size={12} style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
        </div>

        {/* Tag dropdown */}
        <div style={{ position: 'relative', flex: 1 }}>
          <select
            value={selectedTag}
            onChange={e => onTagChange(e.target.value)}
            style={{
              width: '100%', padding: '5px 24px 5px 8px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)', appearance: 'none', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="">All tags</option>
            {availableTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown size={12} style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
        </div>
      </div>
    </div>
  );
}
