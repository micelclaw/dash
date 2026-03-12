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

import { useState, useRef, useEffect } from 'react';
import { Plus, Camera } from 'lucide-react';
import type { Album } from '@/types/files';

interface AlbumPickerDropdownProps {
  open: boolean;
  anchorPos: { x: number; y: number };
  albums: Album[];
  onSelect: (albumId: string) => void;
  onCreate: (name: string) => Promise<Album>;
  onClose: () => void;
  title?: string;
}

export function AlbumPickerDropdown({
  open,
  anchorPos,
  albums,
  onSelect,
  onCreate,
  onClose,
  title = 'Add to album',
}: AlbumPickerDropdownProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [pos, setPos] = useState(anchorPos);

  // Adjust position to keep within viewport
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { x, y } = anchorPos;
    if (y + rect.height > vh) y = vh - rect.height - 8;
    if (x + rect.width > vw) x = vw - rect.width - 8;
    if (y < 8) y = 8;
    if (x < 8) x = 8;
    setPos({ x, y });
  }, [open, anchorPos]);

  // Close on click outside or Escape
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  // Focus input when creating
  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  if (!open) return null;

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const album = await onCreate(name);
    setNewName('');
    setCreating(false);
    onSelect(album.id);
  };

  return (
    <>
      <div
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-dropdown)' as unknown as number }}
      />
      <div
        ref={menuRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          zIndex: 'var(--z-dropdown)' as unknown as number,
          minWidth: 220,
          maxWidth: 280,
          maxHeight: 320,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 100ms ease',
        }}
      >
        {/* Title */}
        <div style={{
          padding: '8px 12px',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--font-sans)',
        }}>
          {title}
        </div>

        {/* Album list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
          {albums.length === 0 && !creating && (
            <div style={{
              padding: '12px',
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
              fontFamily: 'var(--font-sans)',
            }}>
              No albums yet
            </div>
          )}

          {albums.map(album => (
            <button
              key={album.id}
              onClick={() => onSelect(album.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                height: 32,
                padding: '0 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                textAlign: 'left',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Camera size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {album.name}
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                {album.photo_count}
              </span>
            </button>
          ))}
        </div>

        {/* New album */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '4px 0' }}>
          {creating ? (
            <div style={{ display: 'flex', gap: 4, padding: '4px 8px' }}>
              <input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                }}
                placeholder="Album name..."
                style={{
                  flex: 1,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                  fontSize: '0.8125rem',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                height: 32,
                padding: '0 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--amber)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                textAlign: 'left',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Plus size={14} />
              New album
            </button>
          )}
        </div>
      </div>
    </>
  );
}
