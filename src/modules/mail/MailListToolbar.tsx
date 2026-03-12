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

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  X,
  RotateCw,
  BookOpen,
  Mail,
  Archive,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface MailListToolbarProps {
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  search: string;
  onSearchChange: (val: string) => void;
  onRefresh: () => void;
  selectedCount: number;
  onBatchRead: () => void;
  onBatchUnread: () => void;
  onBatchArchive: () => void;
  onBatchDelete: () => void;
  // Pagination
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function MailListToolbar({
  allSelected,
  someSelected,
  onSelectAll,
  onDeselectAll,
  search,
  onSearchChange,
  onRefresh,
  selectedCount,
  onBatchRead,
  onBatchUnread,
  onBatchArchive,
  onBatchDelete,
  page,
  pageSize,
  total,
  onPageChange,
}: MailListToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const [refreshHovered, setRefreshHovered] = useState(false);
  const [hoveredBatch, setHoveredBatch] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external search changes into local state
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounced search
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

  const handleCheckboxClick = useCallback(() => {
    if (allSelected || someSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  }, [allSelected, someSelected, onDeselectAll, onSelectAll]);

  const selectionMode = selectedCount > 0;

  const batchActions = [
    { key: 'read', label: 'Mark read', icon: BookOpen, onClick: onBatchRead },
    { key: 'unread', label: 'Mark unread', icon: Mail, onClick: onBatchUnread },
    { key: 'archive', label: 'Archive', icon: Archive, onClick: onBatchArchive },
    { key: 'delete', label: 'Delete', icon: Trash2, onClick: onBatchDelete },
  ];

  // Pagination
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;

  const pagerBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 24, height: 24, border: 'none', borderRadius: 'var(--radius-sm)',
    background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer',
    padding: 0, flexShrink: 0,
  };

  return (
    <div style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      {/* Top row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
        }}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected && !allSelected;
          }}
          onChange={handleCheckboxClick}
          style={{
            width: 14,
            height: 14,
            accentColor: 'var(--amber)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        />

        {selectionMode ? (
          /* Selection mode */
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                color: 'var(--text)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {selectedCount} selected
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
              {batchActions.map(({ key, label, icon: Icon, onClick }) => (
                <button
                  key={key}
                  onClick={onClick}
                  onMouseEnter={() => setHoveredBatch(key)}
                  onMouseLeave={() => setHoveredBatch(null)}
                  title={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: hoveredBatch === key ? 'var(--surface-hover)' : 'transparent',
                    color: 'var(--text-dim)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    transition: 'background var(--transition-fast)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Normal mode */
          <>
            {/* Search input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                minWidth: 0,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '0 10px',
              }}
            >
              <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search mail..."
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

            {/* Refresh button */}
            <button
              onClick={onRefresh}
              onMouseEnter={() => setRefreshHovered(true)}
              onMouseLeave={() => setRefreshHovered(false)}
              title="Refresh"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: refreshHovered ? 'var(--surface-hover)' : 'transparent',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background var(--transition-fast)',
              }}
            >
              <RotateCw size={14} />
            </button>
          </>
        )}
      </div>

      {/* Pagination row */}
      {total > pageSize && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 6,
            padding: '2px 12px 6px',
          }}
        >
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
            {from}–{to} of {total}
          </span>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPrev}
            style={{ ...pagerBtnStyle, opacity: hasPrev ? 1 : 0.3, cursor: hasPrev ? 'pointer' : 'default' }}
            title="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNext}
            style={{ ...pagerBtnStyle, opacity: hasNext ? 1 : 0.3, cursor: hasNext ? 'pointer' : 'default' }}
            title="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
