import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Search, Upload } from 'lucide-react';
import type { PhotosView } from './types';

interface PhotosToolbarProps {
  view: PhotosView;
  onViewChange: (view: PhotosView) => void;
  search: string;
  onSearchChange: (search: string) => void;
  onUpload: (files: File[]) => void;
}

export function PhotosToolbar({
  view,
  onViewChange,
  search,
  onSearchChange,
  onUpload,
}: PhotosToolbarProps) {
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const handleSearchInput = useCallback((value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  }, [onSearchChange]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(Array.from(files));
      e.target.value = '';
    }
  };

  const viewBtnStyle = (v: PhotosView): React.CSSProperties => ({
    padding: '4px 12px',
    fontSize: '0.75rem',
    fontFamily: 'var(--font-sans)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    background: view === v ? 'var(--amber)' : hoveredBtn === v ? 'var(--surface-hover)' : 'transparent',
    color: view === v ? '#06060a' : 'var(--text-dim)',
    fontWeight: view === v ? 600 : 400,
    transition: 'background var(--transition-fast)',
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Camera size={18} style={{ color: 'var(--mod-photos)' }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
          Photos
        </span>
      </div>

      {/* View toggle */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-sm)',
          padding: 2,
        }}
      >
        <button
          style={viewBtnStyle('timeline')}
          onClick={() => onViewChange('timeline')}
          onMouseEnter={() => setHoveredBtn('timeline')}
          onMouseLeave={() => setHoveredBtn(null)}
        >
          Timeline
        </button>
        <button
          style={viewBtnStyle('albums')}
          onClick={() => onViewChange('albums')}
          onMouseEnter={() => setHoveredBtn('albums')}
          onMouseLeave={() => setHoveredBtn(null)}
        >
          Albums
        </button>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px 10px',
          minWidth: 160,
        }}
      >
        <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search..."
          value={localSearch}
          onChange={(e) => handleSearchInput(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            width: '100%',
          }}
        />
      </div>

      {/* Upload button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        onMouseEnter={() => setHoveredBtn('upload')}
        onMouseLeave={() => setHoveredBtn(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          background: hoveredBtn === 'upload' ? 'var(--amber)' : 'var(--amber-dim)',
          color: hoveredBtn === 'upload' ? '#06060a' : 'var(--text)',
          transition: 'background var(--transition-fast)',
        }}
      >
        <Upload size={14} />
        Upload
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
