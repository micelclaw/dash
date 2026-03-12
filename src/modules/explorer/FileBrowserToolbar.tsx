/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Search, FolderPlus, Upload } from 'lucide-react';
import { FileBreadcrumb } from '@/components/shared/FileBreadcrumb';
import { ViewToggle } from '@/components/shared/ViewToggle';
import type { SourceRoot } from './types';

interface FileBrowserToolbarProps {
  currentPath: string;
  currentSource: SourceRoot;
  isWritable: boolean;
  view: 'grid' | 'list';
  search: string;
  onNavigate: (path: string) => void;
  onViewChange: (view: 'grid' | 'list') => void;
  onSearchChange: (search: string) => void;
  onCreateFolder: (name: string) => void;
  onUploadClick: () => void;
}

export function FileBrowserToolbar({
  currentPath,
  currentSource,
  isWritable,
  view,
  search,
  onNavigate,
  onViewChange,
  onSearchChange,
  onCreateFolder,
  onUploadClick,
}: FileBrowserToolbarProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchValue, setSearchValue] = useState(search);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external search changes
  useEffect(() => {
    setSearchValue(search);
    if (!search) setShowSearch(false);
  }, [search]);

  const handleSearchInput = useCallback((value: string) => {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  }, [onSearchChange]);

  const toggleSearch = () => {
    if (showSearch) {
      setSearchValue('');
      onSearchChange('');
      setShowSearch(false);
    } else {
      setShowSearch(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  const handleNewFolder = () => {
    if (folderName.trim()) {
      onCreateFolder(folderName.trim());
      setFolderName('');
      setShowNewFolder(false);
    }
  };

  const handleFolderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNewFolder();
    if (e.key === 'Escape') {
      setFolderName('');
      setShowNewFolder(false);
    }
  };

  // Focus folder input when shown
  useEffect(() => {
    if (showNewFolder) {
      setTimeout(() => folderInputRef.current?.focus(), 50);
    }
  }, [showNewFolder]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
        minHeight: 40,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Breadcrumb */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <FileBreadcrumb
          path={currentPath}
          rootLabel={currentSource.label}
          rootIcon={currentSource.icon}
          rootBasePath={currentSource.basePath}
          onNavigate={onNavigate}
        />
        {!isWritable && (
          <span
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              background: 'var(--surface-hover)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            Read only
          </span>
        )}
      </div>

      {/* Search */}
      {showSearch && (
        <input
          ref={searchInputRef}
          type="text"
          value={searchValue}
          onChange={e => handleSearchInput(e.target.value)}
          placeholder="Search files..."
          style={{
            width: 180,
            height: 28,
            padding: '0 8px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
          onKeyDown={e => { if (e.key === 'Escape') toggleSearch(); }}
        />
      )}
      <ToolbarButton icon={Search} title="Search" onClick={toggleSearch} active={showSearch} />

      {/* View toggle */}
      <ViewToggle view={view} onChange={onViewChange} />

      {/* Writable actions */}
      {isWritable && (
        <>
          <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
          {showNewFolder ? (
            <input
              ref={folderInputRef}
              type="text"
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              onKeyDown={handleFolderKeyDown}
              onBlur={() => { if (!folderName.trim()) setShowNewFolder(false); }}
              placeholder="Folder name..."
              style={{
                width: 140,
                height: 28,
                padding: '0 8px',
                border: '1px solid var(--amber)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
            />
          ) : (
            <ToolbarButton icon={FolderPlus} title="New Folder" onClick={() => setShowNewFolder(true)} />
          )}
          <ToolbarButton icon={Upload} title="Upload" onClick={onUploadClick} />
        </>
      )}
    </div>
  );
}

function ToolbarButton({ icon: Icon, title, onClick, active }: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        background: active ? 'var(--surface-hover)' : hovered ? 'var(--surface-hover)' : 'transparent',
        color: active ? 'var(--amber)' : 'var(--text-dim)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background var(--transition-fast)',
      }}
    >
      <Icon size={14} />
    </button>
  );
}
