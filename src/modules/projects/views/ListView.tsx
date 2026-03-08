import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { ArrowUpDown, ChevronDown, ChevronRight, CheckSquare } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import { PriorityBadge } from '../components/PriorityDot';
import { PRIORITY_COLORS } from '../utils/design-tokens';
import type { Card, CustomFieldDef } from '../types';

type SortField = 'title' | 'priority' | 'due_date' | 'column' | 'card_number' | 'created_at' | 'updated_at';
type GroupBy = 'none' | 'column' | 'priority' | 'assignee';
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

interface EditingCell {
  cardId: string;
  field: string;
}

export function ListView() {
  const columns = useProjectsStore((s) => s.columns);
  const cards = useProjectsStore((s) => s.cards);
  const labels = useProjectsStore((s) => s.labels);
  const cardLabelIds = useProjectsStore((s) => s.cardLabelIds);
  const selectCard = useProjectsStore((s) => s.selectCard);
  const updateCard = useProjectsStore((s) => s.updateCard);
  const activeBoardId = useProjectsStore((s) => s.activeBoardId);
  const customFieldDefs = useProjectsStore((s) => s.customFieldDefs);

  const visibleFieldDefs = useMemo(
    () => Object.values(customFieldDefs).filter(fd => fd.show_on_card).sort((a, b) => a.position - b.position),
    [customFieldDefs],
  );

  const [sortField, setSortField] = useState<SortField>('column');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [groupBy, setGroupBy] = useState<GroupBy>('column');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  const columnMap = useMemo(() => new Map(Object.values(columns).map((c) => [c.id, c])), [columns]);
  const allCards = useMemo(() => Object.values(cards).filter(c => !c.archived), [cards]);

  const sortedCards = useMemo(() => {
    const sorted = [...allCards].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'priority':
          cmp = (PRIORITY_ORDER[a.priority ?? 'none'] ?? 4) - (PRIORITY_ORDER[b.priority ?? 'none'] ?? 4);
          break;
        case 'due_date':
          if (!a.due_date && !b.due_date) cmp = 0;
          else if (!a.due_date) cmp = 1;
          else if (!b.due_date) cmp = -1;
          else cmp = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          break;
        case 'column': {
          const colA = columnMap.get(a.column_id);
          const colB = columnMap.get(b.column_id);
          cmp = (colA?.position ?? 0) - (colB?.position ?? 0);
          break;
        }
        case 'card_number':
          cmp = (a.card_number ?? 0) - (b.card_number ?? 0);
          break;
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'updated_at':
          cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [allCards, sortField, sortDir, columnMap]);

  // Group cards
  const grouped = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: 'All Cards', cards: sortedCards }];

    const groups = new Map<string, { label: string; cards: Card[] }>();
    for (const card of sortedCards) {
      let key: string;
      let label: string;
      switch (groupBy) {
        case 'column': {
          const col = columnMap.get(card.column_id);
          key = card.column_id;
          label = col?.title ?? 'Unknown';
          break;
        }
        case 'priority': {
          key = card.priority ?? 'none';
          label = key.charAt(0).toUpperCase() + key.slice(1);
          break;
        }
        case 'assignee': {
          if (!card.assignee_ids || card.assignee_ids.length === 0) {
            key = 'unassigned';
            label = 'Unassigned';
          } else {
            key = card.assignee_ids[0];
            label = key;
          }
          break;
        }
      }
      if (!groups.has(key)) groups.set(key, { label, cards: [] });
      groups.get(key)!.cards.push(card);
    }
    return Array.from(groups.entries()).map(([key, val]) => ({ key, ...val }));
  }, [sortedCards, groupBy, columnMap]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startEdit = useCallback((cardId: string, field: string, currentValue: string) => {
    setEditing({ cardId, field });
    setEditValue(currentValue);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editing || !activeBoardId) return;
    const { cardId, field } = editing;
    const card = cards[cardId];
    if (!card) { setEditing(null); return; }

    let value: unknown = editValue;
    if (field === 'priority') value = editValue || null;
    if (field === 'due_date') value = editValue || null;

    if (String(value) !== String((card as Record<string, unknown>)[field] ?? '')) {
      updateCard(activeBoardId, cardId, { [field]: value });
    }
    setEditing(null);
  }, [editing, editValue, activeBoardId, cards, updateCard]);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') setEditing(null);
  }, [saveEdit]);

  if (allCards.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 14 }}>
        No cards yet. Add cards from the Board view.
      </div>
    );
  }

  const colHeaders: { field: SortField; label: string; width?: number }[] = [
    { field: 'card_number', label: '#', width: 50 },
    { field: 'title', label: 'Title' },
    { field: 'column', label: 'Status', width: 120 },
    { field: 'priority', label: 'Priority', width: 100 },
    { field: 'due_date', label: 'Due Date', width: 110 },
    { field: 'updated_at', label: 'Updated', width: 100 },
  ];

  return (
    <div style={{ overflow: 'auto', height: '100%', padding: 16 }}>
      {/* Group selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Group by:</span>
        {(['none', 'column', 'priority', 'assignee'] as GroupBy[]).map((g) => (
          <button
            key={g}
            onClick={() => setGroupBy(g)}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: groupBy === g ? 'var(--amber-dim)' : 'transparent',
              color: groupBy === g ? 'var(--amber)' : 'var(--text-dim)',
              fontSize: 11,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {g === 'none' ? 'None' : g}
          </button>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
        <thead>
          <tr>
            {colHeaders.map(({ field, label, width }) => (
              <th
                key={field}
                onClick={() => toggleSort(field)}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text-dim)',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  userSelect: 'none',
                  width: width ?? undefined,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {label}
                  {sortField === field && <ArrowUpDown size={10} />}
                </span>
              </th>
            ))}
            <th style={thStyle}>Labels</th>
            <th style={thStyle}>Tags</th>
            {visibleFieldDefs.map(fd => (
              <th key={fd.id} style={{ ...thStyle, width: 100 }}>{fd.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grouped.map((group) => (
            <GroupRows
              key={group.key}
              group={group}
              showGroupHeader={groupBy !== 'none'}
              collapsed={collapsedGroups.has(group.key)}
              toggleGroup={toggleGroup}
              columnMap={columnMap}
              labels={labels}
              cardLabelIds={cardLabelIds}
              selectCard={selectCard}
              editing={editing}
              editValue={editValue}
              setEditValue={setEditValue}
              editRef={editRef}
              startEdit={startEdit}
              saveEdit={saveEdit}
              handleKeyDown={handleKeyDown}
              visibleFieldDefs={visibleFieldDefs}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({ group, showGroupHeader, collapsed, toggleGroup, columnMap, labels, cardLabelIds, selectCard, editing, editValue, setEditValue, editRef, startEdit, saveEdit, handleKeyDown, visibleFieldDefs = [] }: {
  group: { key: string; label: string; cards: Card[] };
  showGroupHeader: boolean;
  collapsed: boolean;
  toggleGroup: (key: string) => void;
  columnMap: Map<string, { title: string; color: string | null; position: number }>;
  labels: Record<string, { id: string; name: string; color: string }>;
  cardLabelIds: Record<string, string[]>;
  selectCard: (id: string) => void;
  editing: EditingCell | null;
  editValue: string;
  setEditValue: (v: string) => void;
  editRef: React.RefObject<HTMLInputElement | null>;
  startEdit: (cardId: string, field: string, value: string) => void;
  saveEdit: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  visibleFieldDefs?: CustomFieldDef[];
}) {
  return (
    <>
      {showGroupHeader && (
        <tr>
          <td
            colSpan={8 + visibleFieldDefs.length}
            onClick={() => toggleGroup(group.key)}
            style={{
              padding: '8px 12px',
              background: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontSize: 12, fontWeight: 600 }}>
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              {group.label}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({group.cards.length})</span>
            </span>
          </td>
        </tr>
      )}
      {!collapsed && group.cards.map((card) => {
        const col = columnMap.get(card.column_id);
        const checklist = card.checklist ?? [];
        const checked = checklist.filter(c => c.checked).length;
        const isEditingTitle = editing?.cardId === card.id && editing.field === 'title';
        const cardLabelsArr = (cardLabelIds[card.id] ?? []).map(id => labels[id]).filter(Boolean);

        return (
          <tr
            key={card.id}
            onClick={() => !editing && selectCard(card.id)}
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
          >
            {/* # */}
            <td style={cellStyle}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                {card.card_number != null ? `#${card.card_number}` : '—'}
              </span>
            </td>

            {/* Title (editable) */}
            <td style={cellStyle}>
              {isEditingTitle ? (
                <input
                  ref={editRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  style={editInputStyle}
                />
              ) : (
                <span
                  onDoubleClick={(e) => { e.stopPropagation(); startEdit(card.id, 'title', card.title); }}
                  style={{ color: 'var(--text)', fontWeight: 500 }}
                >
                  {card.title}
                  {checklist.length > 0 && (
                    <span style={{ marginLeft: 6, color: checked === checklist.length ? 'var(--success)' : 'var(--text-muted)', fontSize: 11 }}>
                      <CheckSquare size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                      {checked}/{checklist.length}
                    </span>
                  )}
                </span>
              )}
            </td>

            {/* Status */}
            <td style={cellStyle}>
              <span style={{
                color: col?.color || 'var(--text-dim)',
                fontSize: 12,
                background: col?.color ? col.color + '18' : undefined,
                padding: '2px 6px',
                borderRadius: 4,
              }}>
                {col?.title ?? '—'}
              </span>
            </td>

            {/* Priority */}
            <td style={cellStyle}>
              <PriorityBadge priority={card.priority ?? 'none'} />
            </td>

            {/* Due Date */}
            <td style={cellStyle}>
              <span style={{
                color: card.due_date && !card.completed_at && new Date(card.due_date) < new Date()
                  ? 'var(--error)'
                  : 'var(--text-dim)',
                fontSize: 12,
              }}>
                {card.due_date ? new Date(card.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
              </span>
            </td>

            {/* Updated */}
            <td style={cellStyle}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                {new Date(card.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </td>

            {/* Labels */}
            <td style={cellStyle}>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {cardLabelsArr.slice(0, 3).map((l) => (
                  <span key={l.id} style={{ background: l.color + '22', color: l.color, fontSize: 10, padding: '1px 5px', borderRadius: 3 }}>
                    {l.name}
                  </span>
                ))}
              </div>
            </td>

            {/* Tags */}
            <td style={cellStyle}>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {(card.tags ?? []).slice(0, 3).map((tag) => (
                  <span key={tag} style={{ background: 'var(--surface)', color: 'var(--text-dim)', fontSize: 10, padding: '1px 5px', borderRadius: 3 }}>
                    {tag}
                  </span>
                ))}
              </div>
            </td>

            {/* Custom fields */}
            {visibleFieldDefs.map(fd => {
              const cf = card.custom_fields as Record<string, unknown> | null;
              const val = cf?.[fd.id];
              return (
                <td key={fd.id} style={cellStyle}>
                  <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                    {val == null || val === '' ? '—' :
                     fd.type === 'checkbox' ? (val ? '✓' : '✗') :
                     fd.type === 'date' ? new Date(String(val)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) :
                     String(val)}
                  </span>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--border)',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const editInputStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--amber)',
  borderRadius: 4,
  padding: '2px 6px',
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  width: '100%',
};
