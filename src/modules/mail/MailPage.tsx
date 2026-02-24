import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { Mail, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';
import { EmptyState } from '@/components/shared/EmptyState';
import { useMailState } from './hooks/use-mail-state';
import { useEmails } from './hooks/use-emails';
import { useEmailAccounts } from './hooks/use-email-accounts';
import { MailSidebar } from './MailSidebar';
import { MailList } from './MailList';
import { MailReadingPane } from './MailReadingPane';
import { MailComposer } from './MailComposer';
import { MailSnoozeMenu } from './MailSnoozeMenu';
import type { ComposeData } from './types';

function useIsTablet() {
  const [isTablet, setIsTablet] = useState(window.innerWidth <= 1024);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const handler = () => setIsTablet(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isTablet;
}

export function Component() {
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  const {
    activeAccount, setActiveAccount,
    activeFolder, setActiveFolder,
    selectedEmailId, setSelectedEmailId,
    selectedIds, toggleSelection, selectAll, clearSelection,
    composerData, openComposer, closeComposer,
  } = useMailState();

  // Filters
  const [search, setSearch] = useState('');
  const [activeLabels, setActiveLabels] = useState<Set<string>>(new Set());

  const {
    emails, loading, error, fetchEmails,
    markRead, markUnread, toggleStar,
    archiveEmail, moveToFolder, deleteEmail, snoozeEmail,
    sendEmail, batchAction,
  } = useEmails({
    folder: activeFolder,
    account_id: activeAccount || undefined,
    search: search || undefined,
    label: activeLabels.size === 1 ? [...activeLabels][0] : undefined,
  });

  const { accounts } = useEmailAccounts();

  // Collapsible list
  const [listCollapsed, setListCollapsed] = useState(false);

  // Snooze menu
  const [snoozeTarget, setSnoozeTarget] = useState<{ id: string; el: HTMLElement } | null>(null);

  // URL sync
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) setSelectedEmailId(id);
  }, [searchParams, setSelectedEmailId]);

  const handleToggleLabel = useCallback((label: string) => {
    setActiveLabels(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const handleCompose = useCallback(() => {
    openComposer({ mode: 'new' });
  }, [openComposer]);

  const handleReply = useCallback((data: Partial<ComposeData>) => {
    openComposer({ mode: 'reply', ...data } as ComposeData);
  }, [openComposer]);

  const handleForward = useCallback((data: Partial<ComposeData>) => {
    openComposer({ mode: 'forward', ...data } as ComposeData);
  }, [openComposer]);

  const handleSnooze = useCallback((id: string, el: HTMLElement) => {
    setSnoozeTarget({ id, el });
  }, []);

  const handleSnoozeConfirm = useCallback((until: string) => {
    if (snoozeTarget) {
      snoozeEmail(snoozeTarget.id, until);
      setSnoozeTarget(null);
    }
  }, [snoozeTarget, snoozeEmail]);

  // Keyboard shortcuts
  const composerOpen = !!composerData;
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (composerOpen) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      switch (e.key) {
        case 'c':
          e.preventDefault();
          handleCompose();
          break;
        case 'e':
          if (selectedEmailId) { e.preventDefault(); archiveEmail(selectedEmailId); setSelectedEmailId(null); }
          break;
        case '#':
          if (selectedEmailId) { e.preventDefault(); deleteEmail(selectedEmailId); setSelectedEmailId(null); }
          break;
        case 'r':
          // Reply handled by reading pane
          break;
        case 's':
          if (selectedEmailId) { e.preventDefault(); toggleStar(selectedEmailId); }
          break;
        case 'u':
          if (selectedEmailId) { e.preventDefault(); markUnread(selectedEmailId); }
          break;
        case 'Escape':
          if (selectedEmailId) { e.preventDefault(); setSelectedEmailId(null); }
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [composerOpen, selectedEmailId, handleCompose, archiveEmail, deleteEmail, toggleStar, markUnread, setSelectedEmailId]);

  const accountColorMap = accounts.map(a => ({ id: a.id, color: a.color }));

  // Mobile: single column stack
  if (isMobile) {
    if (selectedEmailId) {
      return (
        <div style={{ height: '100%' }}>
          <MailReadingPane
            emailId={selectedEmailId}
            onBack={() => setSelectedEmailId(null)}
            onReply={handleReply}
            onForward={handleForward}
          />
          {composerData && (
            <MailComposer data={composerData} onClose={closeComposer} onSend={sendEmail} accounts={accounts} />
          )}
        </div>
      );
    }
    return (
      <div style={{ height: '100%' }}>
        <MailList
          emails={emails}
          loading={loading}
          error={error}
          selectedEmailId={selectedEmailId}
          onSelectEmail={setSelectedEmailId}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          search={search}
          onSearchChange={setSearch}
          activeLabels={activeLabels}
          onToggleLabel={handleToggleLabel}
          onRefresh={fetchEmails}
          onArchive={archiveEmail}
          onDelete={deleteEmail}
          onSnooze={handleSnooze}
          onToggleStar={toggleStar}
          onMarkRead={markRead}
          onMarkUnread={markUnread}
          onMoveToFolder={moveToFolder}
          onBatchRead={() => batchAction([...selectedIds], 'read')}
          onBatchUnread={() => batchAction([...selectedIds], 'unread')}
          onBatchArchive={() => batchAction([...selectedIds], 'archive')}
          onBatchDelete={() => batchAction([...selectedIds], 'delete')}
          accounts={accountColorMap}
        />
        {composerData && (
          <MailComposer data={composerData} onClose={closeComposer} onSend={sendEmail} accounts={accounts} />
        )}
        {snoozeTarget && (
          <MailSnoozeMenu
            open
            onClose={() => setSnoozeTarget(null)}
            onSnooze={handleSnoozeConfirm}
            anchorEl={snoozeTarget.el}
          />
        )}
      </div>
    );
  }

  // Desktop / Tablet: 3-column grid
  const listWidth = listCollapsed ? '0px' : isTablet ? '1fr' : '340px';
  return (
    <div
      style={{
        display: 'grid',
        height: '100%',
        gridTemplateColumns: isTablet ? `56px ${listWidth} 1fr` : `200px ${listWidth} 1fr`,
        overflow: 'hidden',
      }}
    >
      <MailSidebar
        activeAccount={activeAccount}
        activeFolder={activeFolder}
        onAccountChange={setActiveAccount}
        onFolderChange={setActiveFolder}
        collapsed={isTablet}
        onCompose={handleCompose}
        accounts={accounts}
        emails={emails}
      />

      <div style={{
        borderRight: listCollapsed ? 'none' : '1px solid var(--border)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--transition-fast)',
      }}>
        {!listCollapsed && <MailList
          emails={emails}
          loading={loading}
          error={error}
          selectedEmailId={selectedEmailId}
          onSelectEmail={setSelectedEmailId}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          search={search}
          onSearchChange={setSearch}
          activeLabels={activeLabels}
          onToggleLabel={handleToggleLabel}
          onRefresh={fetchEmails}
          onArchive={archiveEmail}
          onDelete={deleteEmail}
          onSnooze={handleSnooze}
          onToggleStar={toggleStar}
          onMarkRead={markRead}
          onMarkUnread={markUnread}
          onMoveToFolder={moveToFolder}
          onBatchRead={() => batchAction([...selectedIds], 'read')}
          onBatchUnread={() => batchAction([...selectedIds], 'unread')}
          onBatchArchive={() => batchAction([...selectedIds], 'archive')}
          onBatchDelete={() => batchAction([...selectedIds], 'delete')}
          accounts={accountColorMap}
        />}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Collapse/expand toggle */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '4px 8px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setListCollapsed(prev => !prev)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28,
              border: 'none', borderRadius: 'var(--radius-sm)',
              background: 'transparent', color: 'var(--text-dim)',
              cursor: 'pointer', transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title={listCollapsed ? 'Show email list' : 'Hide email list'}
          >
            {listCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {selectedEmailId ? (
            <MailReadingPane
              emailId={selectedEmailId}
              onReply={handleReply}
              onForward={handleForward}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg)' }}>
              <EmptyState
                icon={Mail}
                title="Select an email"
                description="Choose an email from the list to read"
              />
            </div>
          )}
        </div>
      </div>

      {/* Composer floats above everything */}
      {composerData && (
        <MailComposer data={composerData} onClose={closeComposer} onSend={sendEmail} accounts={accounts} />
      )}

      {/* Snooze menu */}
      {snoozeTarget && (
        <MailSnoozeMenu
          open
          onClose={() => setSnoozeTarget(null)}
          onSnooze={handleSnoozeConfirm}
          anchorEl={snoozeTarget.el}
        />
      )}
    </div>
  );
}
