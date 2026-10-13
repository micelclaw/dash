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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, ChevronDown, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { MailListToolbar } from './MailListToolbar';
import type { MoveTarget } from './lib/move-targets';
import type { MailActionKey } from './lib/mail-actions';
import { MailListItem, MAIL_ROW_MIN_HEIGHT, UNREAD_STRIPE_PX } from './MailListItem';
import { groupEmailsByDate, readCollapsedGroups, writeCollapsedGroups } from './lib/mail-grouping';
import type { Email, MailSortField, MailSortOrder } from './types';

/** Sentinel for the ungrouped list: renders the rows with no header at all. */
const FLAT_GROUP_KEY = '__flat__';

interface MailListProps {
  emails: Email[];
  loading: boolean;
  error: string | null;
  selectedEmailId: string | null;
  onSelectEmail: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string, shiftKey: boolean) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  search: string;
  onSearchChange: (val: string) => void;
  onRefresh: () => void;
  /** A dónde se puede mover (submenú «Move to…»). */
  /** Los destinos de «Mover a…» de UNA cuenta (cada correo recibe los suyos). */
  /** La ÚNICA vía de acción: la comparten la fila, su menú y la barra de arriba. */
  onAction?: (
    key: MailActionKey,
    ids: string[],
    params?: { folder?: string; label?: string; el?: HTMLElement },
  ) => void;
  /** ¿Están todos los seleccionados destacados? Decide destacar vs quitar. */
  allSelectedStarred?: boolean;
  moveTargetsFor?: (accountId: string | null) => MoveTarget[];
  activeFolder?: string;
  accounts: { id: string; color: string }[];
  // Sorting
  sortField: MailSortField;
  sortOrder: MailSortOrder;
  onSortChange: (field: MailSortField, order: MailSortOrder) => void;
  // Starred filter
  starredOnly: boolean;
  onToggleStarredOnly: () => void;
  // Pagination
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Shimmer keyframes injected once */
const SHIMMER_STYLE_ID = 'mail-list-shimmer';

function ensureShimmerStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SHIMMER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SHIMMER_STYLE_ID;
  style.textContent = `
    @keyframes mail-shimmer {
      0% { background-position: -200px 0; }
      100% { background-position: 200px 0; }
    }
  `;
  document.head.appendChild(style);
}

function SkeletonRow() {
  ensureShimmerStyle();
  const barStyle = (width: string, height: number): React.CSSProperties => ({
    width,
    height,
    borderRadius: 'var(--radius-sm)',
    background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface-hover) 50%, var(--surface) 75%)',
    backgroundSize: '400px 100%',
    animation: 'mail-shimmer 1.4s infinite ease-in-out',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 12px',
        height: MAIL_ROW_MIN_HEIGHT,
        boxSizing: 'border-box',
        borderBottom: '1px solid var(--border)',
        // El mismo hueco que reserva la franja de «sin leer» en la fila real: sin
        // esto, al llegar los correos la lista se desplaza cinco píxeles.
        borderLeft: `${UNREAD_STRIPE_PX}px solid transparent`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={barStyle('14px', 14)} />
        <div style={barStyle('30%', 12)} />
        <div style={{ marginLeft: 'auto', ...barStyle('50px', 10) }} />
      </div>
      <div style={{ paddingLeft: 20 }}>
        <div style={barStyle('70%', 12)} />
      </div>
      <div style={{ paddingLeft: 20 }}>
        <div style={barStyle('85%', 12)} />
      </div>
    </div>
  );
}

function GroupHeader({
  groupKey,
  label,
  count,
  collapsed,
  onToggle,
}: {
  groupKey: string;
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const Chevron = collapsed ? ChevronRight : ChevronDown;

  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-expanded={!collapsed}
      // Anclaje estable para las pruebas: `aria-expanded` a secas también casa
      // con el menú de usuario del pie y con cualquier desplegable de la página.
      data-mail-group={groupKey}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        padding: '6px 12px',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--amber)',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        textAlign: 'left',
        cursor: 'pointer',
        boxSizing: 'border-box',
      }}
    >
      <Chevron size={14} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
      <span
        style={{
          flexShrink: 0,
          fontFamily: 'var(--font-mono)',
          fontWeight: 400,
          color: hovered ? 'var(--text-dim)' : 'var(--text-muted)',
        }}
      >
        {count}
      </span>
    </button>
  );
}

export function MailList({
  emails,
  loading,
  error,
  selectedEmailId,
  onSelectEmail,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  search,
  onSearchChange,
  onRefresh,
  onAction,
  allSelectedStarred,
  moveTargetsFor,
  activeFolder,
  accounts,
  sortField,
  sortOrder,
  onSortChange,
  starredOnly,
  onToggleStarredOnly,
  page,
  pageSize,
  total,
  onPageChange,
}: MailListProps) {
  const allIds = useMemo(() => emails.map((e) => e.id), [emails]);
  const allSelected = emails.length > 0 && selectedIds.size === emails.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < emails.length;

  const accountColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accounts) {
      map.set(a.id, a.color);
    }
    return map;
  }, [accounts]);

  // Grouping only makes sense while the list is in date order. Sorted by sender,
  // day buckets would be single-item headers scattered through the list.
  const grouped = sortField === 'received_at';

  const groups = useMemo(
    () => (grouped ? groupEmailsByDate(emails) : [{ key: FLAT_GROUP_KEY, label: '', emails }]),
    [grouped, emails],
  );

  const folderKey = activeFolder ?? 'INBOX';
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() =>
    readCollapsedGroups(folderKey),
  );

  useEffect(() => {
    setCollapsedGroups(readCollapsedGroups(folderKey));
  }, [folderKey]);

  const toggleGroup = useCallback(
    (key: string) => {
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        writeCollapsedGroups(folderKey, next);
        return next;
      });
    },
    [folderKey],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      <MailListToolbar
        allSelected={allSelected}
        someSelected={someSelected}
        onSelectAll={() => onSelectAll(allIds)}
        onDeselectAll={onClearSelection}
        search={search}
        onSearchChange={onSearchChange}
        onRefresh={onRefresh}
        selectedCount={selectedIds.size}
        onAction={onAction}
        selectedIdList={[...selectedIds]}
        allSelectedStarred={allSelectedStarred}
        activeFolder={activeFolder}
        moveTargets={moveTargetsFor?.(null)}
        sortField={sortField}
        sortOrder={sortOrder}
        onSortChange={onSortChange}
        starredOnly={starredOnly}
        onToggleStarredOnly={onToggleStarredOnly}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
      />

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : error ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 12,
              padding: 32,
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontSize: '0.875rem',
                fontFamily: 'var(--font-sans)',
                color: 'var(--error)',
                margin: 0,
              }}
            >
              {error}
            </p>
            <button
              onClick={onRefresh}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                border: 'none',
                background: 'var(--amber)',
                color: '#06060a',
                fontWeight: 600,
                transition: 'background var(--transition-fast)',
              }}
            >
              Retry
            </button>
          </div>
        ) : emails.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No emails"
            description="Try a different filter or folder"
          />
        ) : (
          groups.map((group) => {
            const collapsed = group.key !== FLAT_GROUP_KEY && collapsedGroups.has(group.key);
            return (
              <div key={group.key}>
                {group.key !== FLAT_GROUP_KEY && (
                  <GroupHeader
                    groupKey={group.key}
                    label={group.label}
                    count={group.emails.length}
                    collapsed={collapsed}
                    onToggle={() => toggleGroup(group.key)}
                  />
                )}
                {!collapsed &&
                  group.emails.map((email) => (
                    <MailListItem
                      key={email.id}
                      email={email}
                      selected={selectedIds.has(email.id)}
                      active={email.id === selectedEmailId}
                      onSelect={(shiftKey) => onToggleSelection(email.id, shiftKey)}
                      onClick={() => onSelectEmail(email.id)}
                      accountColor={email.account_id ? accountColorMap.get(email.account_id) : undefined}
                      onAction={onAction}
                      moveTargets={moveTargetsFor?.(email.account_id ?? null)}
                      activeFolder={activeFolder}
                      selectedCount={selectedIds.size}
                      selectedIds={[...selectedIds]}
                      allSelectedStarred={allSelectedStarred}
                    />
                  ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
