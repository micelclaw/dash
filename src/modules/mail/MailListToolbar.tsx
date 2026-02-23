import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  X,
  RotateCw,
  BookOpen,
  Mail,
  Archive,
  Trash2,
} from 'lucide-react';
import { SMART_CATEGORIES } from './types';

interface MailListToolbarProps {
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  search: string;
  onSearchChange: (val: string) => void;
  activeLabels: Set<string>;
  onToggleLabel: (label: string) => void;
  onRefresh: () => void;
  selectedCount: number;
  onBatchRead: () => void;
  onBatchUnread: () => void;
  onBatchArchive: () => void;
  onBatchDelete: () => void;
}

export function MailListToolbar({
  allSelected,
  someSelected,
  onSelectAll,
  onDeselectAll,
  search,
  onSearchChange,
  activeLabels,
  onToggleLabel,
  onRefresh,
  selectedCount,
  onBatchRead,
  onBatchUnread,
  onBatchArchive,
  onBatchDelete,
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

      {/* Smart category chips row (always visible) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px 8px',
          overflowX: 'auto',
        }}
      >
        {SMART_CATEGORIES.map((cat) => {
          const isActive = activeLabels.has(cat);
          return (
            <button
              key={cat}
              onClick={() => onToggleLabel(cat)}
              style={{
                padding: '3px 10px',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                border: isActive ? '1px solid var(--amber)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-full)',
                background: isActive ? 'var(--amber-dim)' : 'var(--surface)',
                color: isActive ? 'var(--amber)' : 'var(--text-dim)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all var(--transition-fast)',
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}
