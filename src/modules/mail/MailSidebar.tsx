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

import { useMemo, useState, useRef, useEffect } from 'react';
import {
  Pencil,
  Mail,
  Inbox,
  Star,
  Clock,
  Send,
  FileText,
  Archive,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Type,
  Unplug,
  Palette,
  Download,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ContextMenu, type ContextMenuItem } from '@/components/shared/ContextMenu';
import { MailSidebarItem } from './MailSidebarItem';
import type { EmailAccount, Email } from './types';

const ACCOUNT_COLORS: Array<{ value: string; name: string }> = [
  { value: '#d4a017', name: 'Gold' },
  { value: '#3B82F6', name: 'Blue' },
  { value: '#EF4444', name: 'Red' },
  { value: '#10B981', name: 'Green' },
  { value: '#8B5CF6', name: 'Purple' },
  { value: '#F97316', name: 'Orange' },
  { value: '#EC4899', name: 'Pink' },
  { value: '#06B6D4', name: 'Cyan' },
  { value: '#84CC16', name: 'Lime' },
  { value: '#F59E0B', name: 'Amber' },
];

// Persist renames in localStorage so they survive page reloads
const RENAME_KEY = 'claw:mail:account-names';
function loadRenames(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(RENAME_KEY) || '{}'); } catch { return {}; }
}
function saveRenames(map: Record<string, string>) {
  localStorage.setItem(RENAME_KEY, JSON.stringify(map));
}

interface MailSidebarProps {
  activeAccount: string | null;
  activeFolder: string;
  onAccountChange: (id: string | null) => void;
  onFolderChange: (folder: string) => void;
  collapsed: boolean;
  onCompose: () => void;
  onSync?: () => void;
  syncing?: boolean;
  accounts: EmailAccount[];
  emails: Email[];
  onUnsyncAccount?: (id: string) => void;
  onChangeAccountColor?: (id: string, color: string) => void;
  onExport?: (accountId: string | null, folders: string[]) => void;
}

const FOLDERS = [
  { key: 'INBOX', label: 'Inbox', icon: Inbox },
  { key: 'STARRED', label: 'Starred', icon: Star },
  { key: 'SNOOZED', label: 'Snoozed', icon: Clock },
  { key: 'SENT', label: 'Sent', icon: Send },
  { key: 'DRAFTS', label: 'Drafts', icon: FileText },
  { key: 'ARCHIVE', label: 'Archive', icon: Archive },
  { key: 'TRASH', label: 'Trash', icon: Trash2 },
  { key: 'SPAM', label: 'Spam', icon: AlertTriangle },
] as const;

export function MailSidebar({
  activeAccount,
  activeFolder,
  onAccountChange,
  onFolderChange,
  collapsed,
  onCompose,
  onSync,
  syncing,
  accounts,
  emails,
  onUnsyncAccount,
  onChangeAccountColor,
  onExport,
}: MailSidebarProps) {
  // ─── Export modal state ───
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFolders, setExportFolders] = useState<Set<string>>(new Set(['INBOX', 'SENT']));

  function toggleExportFolder(key: string) {
    setExportFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleExportConfirm() {
    if (exportFolders.size === 0) return;
    onExport?.(activeAccount, [...exportFolders]);
    setExportOpen(false);
  }
  // ─── Rename state (frontend-only, persisted in localStorage) ───
  const [renames, setRenames] = useState<Record<string, string>>(loadRenames);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  function startRename(acc: EmailAccount) {
    setRenamingId(acc.id);
    setRenameValue(renames[acc.id] || acc.name);
  }

  function commitRename() {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    const updated = { ...renames };
    if (trimmed && trimmed !== accounts.find(a => a.id === renamingId)?.name) {
      updated[renamingId] = trimmed;
    } else {
      delete updated[renamingId];
    }
    setRenames(updated);
    saveRenames(updated);
    setRenamingId(null);
  }

  // ─── Color picker state ───
  const [colorPickerTarget, setColorPickerTarget] = useState<string | null>(null);

  function getAccountMenuItems(acc: EmailAccount): ContextMenuItem[] {
    return [
      { label: 'Rename', icon: Type, onClick: () => startRename(acc) },
      { label: 'Change color', icon: Palette, onClick: () => setColorPickerTarget(acc.id) },
      { label: '', onClick: () => {}, separator: true },
      { label: 'Unsync account', icon: Unplug, onClick: () => onUnsyncAccount?.(acc.id), variant: 'danger' as const },
    ];
  }

  const totalUnread = useMemo(
    () => emails.filter((e) => !e.is_read && e.folder === 'INBOX').length,
    [emails],
  );

  const accountUnread = useMemo(() => {
    const map: Record<string, number> = {};
    for (const acc of accounts) {
      map[acc.id] = emails.filter(
        (e) => !e.is_read && e.folder === 'INBOX' && e.account_id === acc.id,
      ).length;
    }
    return map;
  }, [emails, accounts]);

  const folderUnread = useMemo(() => {
    const map: Record<string, number> = {};
    for (const folder of FOLDERS) {
      map[folder.key] = emails.filter(
        (e) =>
          !e.is_read &&
          e.folder === folder.key &&
          (activeAccount ? e.account_id === activeAccount : true),
      ).length;
    }
    return map;
  }, [emails, activeAccount]);

  const composeButton = (
    <div style={{ display: 'flex', gap: 4 }}>
      <button
        onClick={onCompose}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          flex: 1,
          height: 32,
          padding: collapsed ? '0' : '0 10px',
          background: 'var(--amber)',
          color: '#06060a',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          fontSize: '0.8125rem',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          transition: 'opacity var(--transition-fast)',
        }}
      >
        <Pencil size={collapsed ? 18 : 14} />
        {!collapsed && <span>Compose</span>}
      </button>
      {onSync && (
        <button
          onClick={onSync}
          disabled={syncing}
          title="Sync emails"
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            background: 'var(--amber)',
            color: '#06060a',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: syncing ? 'not-allowed' : 'pointer',
            transition: 'opacity var(--transition-fast)',
            flexShrink: 0,
          }}
        >
          <RefreshCw size={14} style={syncing ? { animation: 'spin 1s linear infinite' } : undefined} />
        </button>
      )}
    </div>
  );

  return (
    <nav
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: collapsed ? '12px 6px' : '12px',
        width: '100%',
        height: '100%',
        overflow: 'auto',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Compose button */}
      <div style={{ marginBottom: 8 }}>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>{composeButton}</TooltipTrigger>
            <TooltipContent side="right">Compose</TooltipContent>
          </Tooltip>
        ) : (
          composeButton
        )}
      </div>

      {/* All / unified inbox */}
      <MailSidebarItem
        icon={<Mail size={18} />}
        label="All"
        count={totalUnread}
        active={activeAccount === null}
        collapsed={collapsed}
        onClick={() => onAccountChange(null)}
      />

      {/* Accounts section */}
      {accounts.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {!collapsed && (
            <div
              style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '4px 12px',
                marginBottom: 2,
              }}
            >
              Accounts
            </div>
          )}
          {accounts.map((acc) => {
            const displayName = renames[acc.id] || acc.name;

            if (renamingId === acc.id) {
              return (
                <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', height: 32 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', background: acc.color, flexShrink: 0 }} />
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onBlur={commitRename}
                    style={{
                      flex: 1,
                      background: 'var(--surface)',
                      border: '1px solid var(--amber)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text)',
                      fontSize: '0.8125rem',
                      fontFamily: 'var(--font-sans)',
                      padding: '2px 6px',
                      height: 24,
                      outline: 'none',
                    }}
                  />
                </div>
              );
            }

            return (
              <ContextMenu key={acc.id} items={getAccountMenuItems(acc)} trigger={
                <MailSidebarItem
                  icon={
                    <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', background: acc.color, display: 'inline-block' }} />
                  }
                  label={displayName}
                  count={accountUnread[acc.id]}
                  active={activeAccount === acc.id}
                  collapsed={collapsed}
                  onClick={() => onAccountChange(acc.id)}
                  colorDot={acc.color}
                />
              } />
            );
          })}
        </div>
      )}

      {/* Folders section */}
      <div style={{ marginTop: 12 }}>
        {!collapsed && (
          <div
            style={{
              fontSize: '0.625rem',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '4px 12px',
              marginBottom: 2,
            }}
          >
            Folders
          </div>
        )}
        {FOLDERS.map((folder) => {
          const FolderIcon = folder.icon;
          return (
            <MailSidebarItem
              key={folder.key}
              icon={<FolderIcon size={18} />}
              label={folder.label}
              count={folderUnread[folder.key]}
              active={activeFolder === folder.key}
              collapsed={collapsed}
              onClick={() => onFolderChange(folder.key)}
            />
          );
        })}
      </div>

      {/* Export button */}
      {!collapsed && onExport && (
        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setExportOpen(true)}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              height: 32,
              padding: '4px 12px',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              transition: 'background var(--transition-fast)',
            }}
          >
            <Download size={16} />
            Export emails
          </button>
        </div>
      )}

      {/* Color picker popup */}
      {colorPickerTarget && (
        <>
          <div
            onClick={() => setColorPickerTarget(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-dropdown)' as any }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 'var(--z-dropdown)' as any,
              background: 'rgba(17, 17, 24, 0.95)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              boxShadow: 'var(--shadow-lg)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'var(--font-sans)' }}>
              Pick a color
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {ACCOUNT_COLORS.map((c) => {
                const currentColor = accounts.find(a => a.id === colorPickerTarget)?.color;
                const isActive = c.value === currentColor;
                return (
                  <button
                    key={c.value}
                    title={c.name}
                    onClick={() => {
                      onChangeAccountColor?.(colorPickerTarget, c.value);
                      setColorPickerTarget(null);
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--radius-full)',
                      background: c.value,
                      border: isActive ? '2px solid var(--text)' : '2px solid transparent',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'transform 100ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Export modal */}
      {exportOpen && (
        <>
          <div
            onClick={() => setExportOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal-backdrop)' as any, background: 'rgba(0,0,0,0.4)' }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 'var(--z-modal)' as any,
              width: 320,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              boxShadow: 'var(--shadow-lg)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Export emails
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              {activeAccount
                ? `Account: ${renames[activeAccount] || accounts.find(a => a.id === activeAccount)?.name || 'Selected'}`
                : 'All accounts'}
            </div>

            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Folders to export
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {FOLDERS.map((f) => (
                <label
                  key={f.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 0',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    color: 'var(--text)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={exportFolders.has(f.key)}
                    onChange={() => toggleExportFolder(f.key)}
                    style={{ accentColor: 'var(--amber)' }}
                  />
                  {f.label}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setExportOpen(false)}
                style={{
                  padding: '6px 14px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text)',
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExportConfirm}
                disabled={exportFolders.size === 0}
                style={{
                  padding: '6px 14px',
                  background: exportFolders.size > 0 ? 'var(--amber)' : 'var(--surface-hover)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: exportFolders.size > 0 ? '#06060a' : 'var(--text-muted)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  cursor: exportFolders.size > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                Export CSV
              </button>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
