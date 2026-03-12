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

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { SourceRoot } from './types';

interface SourceTreeItemProps {
  source: SourceRoot;
  depth: number;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function SourceTreeItem({ source, depth, currentPath, onNavigate }: SourceTreeItemProps) {
  const [expanded, setExpanded] = useState(() => {
    // Auto-expand if current path is within this source or its children
    if (currentPath.startsWith(source.basePath)) return true;
    return source.children?.some(c => currentPath.startsWith(c.basePath)) ?? false;
  });
  const [hovered, setHovered] = useState(false);

  const hasChildren = source.children && source.children.length > 0;
  const isActive = currentPath.startsWith(source.basePath) &&
    // Make sure a more specific child isn't active
    (!source.children || !source.children.some(c => currentPath.startsWith(c.basePath)));

  const Icon = source.icon;

  const handleClick = () => {
    if (hasChildren) {
      setExpanded(prev => !prev);
    }
    onNavigate(source.basePath);
  };

  return (
    <>
      <button
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          height: 30,
          paddingLeft: depth * 16 + 8,
          paddingRight: 8,
          background: isActive ? 'var(--surface-hover)' : hovered ? 'var(--surface-hover)' : 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.8125rem',
          color: isActive ? 'var(--amber)' : 'var(--text)',
          transition: 'background var(--transition-fast)',
          textAlign: 'left',
        }}
      >
        {hasChildren ? (
          <ChevronRight
            size={12}
            style={{
              flexShrink: 0,
              color: 'var(--text-muted)',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform var(--transition-fast)',
            }}
          />
        ) : (
          <span style={{ width: 12, flexShrink: 0 }} />
        )}
        <Icon size={14} style={{ flexShrink: 0, color: isActive ? 'var(--amber)' : 'var(--text-dim)' }} />
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {source.label}
        </span>
        {!source.writable && (
          <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
            RO
          </span>
        )}
      </button>
      {hasChildren && expanded && source.children!.map(child => (
        <SourceTreeItem
          key={child.id}
          source={child}
          depth={depth + 1}
          currentPath={currentPath}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}
