import { useState, useEffect, useRef } from 'react';
import { FolderOpen, FolderPlus, Upload, Search, X } from 'lucide-react';
import { FileBreadcrumb } from '@/components/shared/FileBreadcrumb';
import { ViewToggle } from '@/components/shared/ViewToggle';
import type { DriveView } from './types';

interface DriveToolbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  search: string;
  onSearchChange: (val: string) => void;
  view: DriveView;
  onViewChange: (v: DriveView) => void;
  onNewFolder: () => void;
  onUpload: () => void;
}

export function DriveToolbar({
  currentPath, onNavigate,
  search, onSearchChange,
  view, onViewChange,
  onNewFolder, onUpload,
}: DriveToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const [newFolderHovered, setNewFolderHovered] = useState(false);
  const [uploadHovered, setUploadHovered] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external search changes into local state
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounced search (300ms)
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localSearch, search, onSearchChange]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Left: Breadcrumb */}
      <div style={{ flex: '0 1 auto', minWidth: 0 }}>
        <FileBreadcrumb
          path={currentPath}
          rootLabel="Drive"
          rootIcon={FolderOpen}
          onNavigate={onNavigate}
        />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Search input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '0 10px',
          maxWidth: 240,
          flex: '0 1 240px',
        }}
      >
        <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          type="text"
          value={localSearch}
          onChange={e => setLocalSearch(e.target.value)}
          placeholder="Search files..."
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            color: 'var(--text)',
            padding: '6px 8px',
          }}
        />
        {localSearch && (
          <button
            onClick={() => {
              setLocalSearch('');
              onSearchChange('');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 2,
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* View toggle */}
      <ViewToggle view={view} onChange={onViewChange} />

      {/* New Folder button */}
      <button
        onClick={onNewFolder}
        title="New folder"
        onMouseEnter={() => setNewFolderHovered(true)}
        onMouseLeave={() => setNewFolderHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          background: newFolderHovered ? 'var(--surface-hover)' : 'transparent',
          color: 'var(--text-dim)',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background var(--transition-fast)',
        }}
      >
        <FolderPlus size={16} />
      </button>

      {/* Upload button */}
      <button
        onClick={onUpload}
        title="Upload file"
        onMouseEnter={() => setUploadHovered(true)}
        onMouseLeave={() => setUploadHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          background: uploadHovered ? 'var(--amber)' : 'var(--amber-dim)',
          color: uploadHovered ? '#06060a' : 'var(--amber)',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all var(--transition-fast)',
        }}
      >
        <Upload size={14} />
        Upload
      </button>
    </div>
  );
}
