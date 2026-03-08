import { useState } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import { PRIORITY_COLORS } from '../utils/design-tokens';
import type { CardFilters } from '../types';

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;

export function FilterBar() {
  const filters = useProjectsStore((s) => s.filters);
  const setFilters = useProjectsStore((s) => s.setFilters);
  const labels = useProjectsStore((s) => s.labels);
  const [expanded, setExpanded] = useState(false);

  const hasActive = !!(
    filters.search || filters.priority || filters.assignee_id ||
    filters.tag || filters.label_id || filters.due_before ||
    filters.due_after || filters.has_dependencies || filters.is_blocked
  );

  const updateFilter = (key: keyof CardFilters, value: unknown) => {
    setFilters({ ...filters, [key]: value || undefined });
  };

  const clearAll = () => setFilters({});

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 16px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
      flexWrap: 'wrap',
    }}>
      {/* Search */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '4px 8px',
        minWidth: 180,
      }}>
        <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Filter cards..."
          value={filters.search ?? ''}
          onChange={(e) => updateFilter('search', e.target.value)}
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontSize: 12,
            fontFamily: 'var(--font-sans)',
            width: '100%',
          }}
        />
        {filters.search && (
          <button
            onClick={() => updateFilter('search', '')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Filter toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: hasActive ? 'var(--amber-dim)' : 'none',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '4px 8px',
          color: hasActive ? 'var(--amber)' : 'var(--text-dim)',
          fontSize: 12,
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
        }}
      >
        <Filter size={12} />
        Filters
        {hasActive && <span style={{ fontWeight: 600 }}>*</span>}
      </button>

      {/* Priority chips */}
      {expanded && (
        <>
          {PRIORITIES.map((p) => (
            <FilterChip
              key={p}
              label={p}
              active={filters.priority === p}
              color={PRIORITY_COLORS[p]}
              onClick={() => updateFilter('priority', filters.priority === p ? undefined : p)}
            />
          ))}

          {/* Label chips */}
          {Object.values(labels).map((label) => (
            <FilterChip
              key={label.id}
              label={label.name}
              active={filters.label_id === label.id}
              color={label.color}
              onClick={() => updateFilter('label_id', filters.label_id === label.id ? undefined : label.id)}
            />
          ))}

          {/* Dependencies filter */}
          <FilterChip
            label="Has deps"
            active={!!filters.has_dependencies}
            onClick={() => updateFilter('has_dependencies', !filters.has_dependencies || undefined)}
          />

          <FilterChip
            label="Blocked"
            active={!!filters.is_blocked}
            color="var(--error)"
            onClick={() => updateFilter('is_blocked', !filters.is_blocked || undefined)}
          />
        </>
      )}

      {/* Clear all */}
      {hasActive && (
        <button
          onClick={clearAll}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            textDecoration: 'underline',
          }}
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function FilterChip({ label, active, color, onClick }: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 12,
        border: active ? `1px solid ${color ?? 'var(--amber)'}` : '1px solid var(--border)',
        background: active ? `${color ?? 'var(--amber)'}22` : 'transparent',
        color: active ? (color ?? 'var(--amber)') : 'var(--text-dim)',
        fontSize: 11,
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
        fontWeight: active ? 500 : 400,
        textTransform: 'capitalize',
      }}
    >
      {color && (
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
        }} />
      )}
      {label}
    </button>
  );
}
