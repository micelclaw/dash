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

import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, FolderOpen, FolderPlus, X } from 'lucide-react';
import { api } from '@/services/api';
import type { FileRecord } from '@/types/files';

interface FolderPickerProps {
  open: boolean;
  currentPath: string;
  onSelect: (path: string) => void;
  onCancel: () => void;
}

interface FolderNode {
  file: FileRecord;
  children: FolderNode[] | null;
  expanded: boolean;
  loading: boolean;
}

export function FolderPicker({ open, currentPath, onSelect, onCancel }: FolderPickerProps) {
  const [roots, setRoots] = useState<FolderNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loadingRoot, setLoadingRoot] = useState(true);
  const [newFolderInput, setNewFolderInput] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [moveHover, setMoveHover] = useState(false);

  // Fetch root folders on open
  useEffect(() => {
    if (!open) return;
    setSelectedPath(null);
    setShowNewFolder(false);
    setNewFolderInput('');
    setLoadingRoot(true);

    api.get<{ data: FileRecord[] }>('/files?parent_folder=/drive/&is_directory=true')
      .then(res => {
        setRoots(res.data.map(f => ({
          file: f,
          children: null,
          expanded: false,
          loading: false,
        })));
        setLoadingRoot(false);
      })
      .catch(() => setLoadingRoot(false));
  }, [open]);

  const toggleExpand = useCallback(async (node: FolderNode) => {
    if (node.expanded) {
      node.expanded = false;
      setRoots(prev => [...prev]);
      return;
    }

    node.loading = true;
    setRoots(prev => [...prev]);

    try {
      const res = await api.get<{ data: FileRecord[] }>(
        `/files?parent_folder=${encodeURIComponent(node.file.filepath)}&is_directory=true`
      );
      node.children = res.data.map(f => ({
        file: f,
        children: null,
        expanded: false,
        loading: false,
      }));
      node.expanded = true;
    } catch {
      node.children = [];
      node.expanded = true;
    }
    node.loading = false;
    setRoots(prev => [...prev]);
  }, []);

  const handleCreateFolder = useCallback(async () => {
    const name = newFolderInput.trim();
    if (!name) return;
    const parentPath = selectedPath || '/drive/';
    try {
      const res = await api.post<{ data: FileRecord }>('/files/mkdir', { name, parent_folder: parentPath });
      const newNode: FolderNode = {
        file: res.data,
        children: null,
        expanded: false,
        loading: false,
      };

      // Find the right parent and add the new folder
      if (parentPath === '/drive/') {
        setRoots(prev => [...prev, newNode]);
      } else {
        // Find parent node and add child
        function addToParent(nodes: FolderNode[]): boolean {
          for (const n of nodes) {
            if (n.file.filepath === parentPath) {
              if (n.children) {
                n.children.push(newNode);
              } else {
                n.children = [newNode];
              }
              n.expanded = true;
              return true;
            }
            if (n.children && addToParent(n.children)) return true;
          }
          return false;
        }
        setRoots(prev => { addToParent(prev); return [...prev]; });
      }

      setSelectedPath(res.data.filepath);
      setNewFolderInput('');
      setShowNewFolder(false);
    } catch {
      // ignore
    }
  }, [newFolderInput, selectedPath]);

  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          width: 400,
          maxWidth: '90vw',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
            Move to...
          </h3>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tree */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px', minHeight: 200 }}>
          {/* Root Drive node */}
          <FolderRow
            label="Drive"
            path="/drive/"
            depth={0}
            selected={selectedPath === '/drive/'}
            disabled={currentPath === '/drive/'}
            onSelect={() => setSelectedPath('/drive/')}
            expanded={true}
            hasChildren={roots.length > 0}
            onToggle={() => {}}
          />

          {loadingRoot ? (
            <div style={{ padding: '12px 0 12px 24px', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
              Loading...
            </div>
          ) : (
            roots.map(node => (
              <FolderTreeNode
                key={node.file.id}
                node={node}
                depth={1}
                selectedPath={selectedPath}
                currentPath={currentPath}
                onSelect={setSelectedPath}
                onToggle={toggleExpand}
              />
            ))
          )}

          {/* New folder button */}
          {showNewFolder ? (
            <div style={{ display: 'flex', gap: 6, padding: '6px 0 6px 24px', alignItems: 'center' }}>
              <FolderOpen size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
              <input
                autoFocus
                value={newFolderInput}
                onChange={e => setNewFolderInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
                placeholder="Folder name"
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
              onClick={() => setShowNewFolder(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 0 6px 24px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: '0.8125rem', color: 'var(--amber)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <FolderPlus size={14} />
              New folder
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: '1px solid var(--border)',
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
              fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => selectedPath && onSelect(selectedPath)}
            disabled={!selectedPath || selectedPath === currentPath}
            onMouseEnter={() => setMoveHover(true)}
            onMouseLeave={() => setMoveHover(false)}
            style={{
              padding: '6px 14px',
              background: (!selectedPath || selectedPath === currentPath) ? 'var(--surface)' : moveHover ? 'var(--amber)' : 'var(--amber)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: (!selectedPath || selectedPath === currentPath) ? 'var(--text-muted)' : '#000',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: (!selectedPath || selectedPath === currentPath) ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
              opacity: (!selectedPath || selectedPath === currentPath) ? 0.5 : moveHover ? 0.9 : 1,
            }}
          >
            Move here
          </button>
        </div>
      </div>
    </div>
  );
}

function FolderTreeNode({
  node, depth, selectedPath, currentPath, onSelect, onToggle,
}: {
  node: FolderNode;
  depth: number;
  selectedPath: string | null;
  currentPath: string;
  onSelect: (path: string) => void;
  onToggle: (node: FolderNode) => void;
}) {
  return (
    <>
      <FolderRow
        label={node.file.filename}
        path={node.file.filepath}
        depth={depth}
        selected={selectedPath === node.file.filepath}
        disabled={currentPath === node.file.filepath}
        onSelect={() => onSelect(node.file.filepath)}
        expanded={node.expanded}
        hasChildren={node.children === null || node.children.length > 0}
        onToggle={() => onToggle(node)}
        loading={node.loading}
      />
      {node.expanded && node.children?.map(child => (
        <FolderTreeNode
          key={child.file.id}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          currentPath={currentPath}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}

function FolderRow({
  label, path: _path, depth, selected, disabled, onSelect, expanded, hasChildren, onToggle, loading,
}: {
  label: string;
  path: string;
  depth: number;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  expanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  loading?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  void _path;

  return (
    <div
      onClick={disabled ? undefined : onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 8px',
        paddingLeft: depth * 20 + 8,
        borderRadius: 'var(--radius-sm)',
        cursor: disabled ? 'default' : 'pointer',
        background: selected ? 'var(--amber-dim)' : hovered && !disabled ? 'var(--surface-hover)' : 'transparent',
        color: disabled ? 'var(--text-muted)' : selected ? 'var(--amber)' : 'var(--text)',
        fontSize: '0.8125rem',
        opacity: disabled ? 0.5 : 1,
        transition: 'background var(--transition-fast)',
      }}
    >
      {/* Expand toggle */}
      <button
        onClick={e => { e.stopPropagation(); onToggle(); }}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 0, display: 'flex', alignItems: 'center',
          color: 'inherit', width: 16, height: 16, flexShrink: 0,
          visibility: hasChildren ? 'visible' : 'hidden',
        }}
      >
        {loading ? (
          <span style={{ fontSize: '0.625rem' }}>...</span>
        ) : expanded ? (
          <ChevronDown size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
      </button>

      <FolderOpen size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
    </div>
  );
}
