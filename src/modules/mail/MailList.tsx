import { useMemo } from 'react';
import { Mail } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { MailListToolbar } from './MailListToolbar';
import { MailListItem } from './MailListItem';
import type { Email } from './types';

interface MailListProps {
  emails: Email[];
  loading: boolean;
  error: string | null;
  selectedEmailId: string | null;
  onSelectEmail: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  search: string;
  onSearchChange: (val: string) => void;
  activeLabels: Set<string>;
  onToggleLabel: (label: string) => void;
  onRefresh: () => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onSnooze: (id: string, el: HTMLElement) => void;
  onToggleStar: (id: string) => void;
  onBatchRead: () => void;
  onBatchUnread: () => void;
  onBatchArchive: () => void;
  onBatchDelete: () => void;
  accounts: { id: string; color: string }[];
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
        height: 68,
        boxSizing: 'border-box',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={barStyle('14px', 14)} />
        <div style={barStyle('30%', 12)} />
        <div style={{ marginLeft: 'auto', ...barStyle('50px', 10) }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, paddingLeft: 20 }}>
        <div style={barStyle('70%', 12)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 20 }}>
        <div style={barStyle('40px', 10)} />
        <div style={barStyle('50px', 10)} />
      </div>
    </div>
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
  activeLabels,
  onToggleLabel,
  onRefresh,
  onArchive,
  onDelete,
  onSnooze,
  onToggleStar,
  onBatchRead,
  onBatchUnread,
  onBatchArchive,
  onBatchDelete,
  accounts,
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
        activeLabels={activeLabels}
        onToggleLabel={onToggleLabel}
        onRefresh={onRefresh}
        selectedCount={selectedIds.size}
        onBatchRead={onBatchRead}
        onBatchUnread={onBatchUnread}
        onBatchArchive={onBatchArchive}
        onBatchDelete={onBatchDelete}
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
          emails.map((email) => (
            <MailListItem
              key={email.id}
              email={email}
              selected={selectedIds.has(email.id)}
              active={email.id === selectedEmailId}
              onSelect={() => onToggleSelection(email.id)}
              onClick={() => onSelectEmail(email.id)}
              accountColor={email.account_id ? accountColorMap.get(email.account_id) : undefined}
              onArchive={() => onArchive(email.id)}
              onDelete={() => onDelete(email.id)}
              onSnooze={(el) => onSnooze(email.id, el)}
              onToggleStar={() => onToggleStar(email.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
