import { useMemo } from 'react';
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
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { MailSidebarItem } from './MailSidebarItem';
import type { EmailAccount, Email } from './types';

interface MailSidebarProps {
  activeAccount: string | null;
  activeFolder: string;
  onAccountChange: (id: string | null) => void;
  onFolderChange: (folder: string) => void;
  collapsed: boolean;
  onCompose: () => void;
  accounts: EmailAccount[];
  emails: Email[];
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
  accounts,
  emails,
}: MailSidebarProps) {
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
    <button
      onClick={onCompose}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '0.9';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1';
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        height: 36,
        padding: collapsed ? '0' : '0 12px',
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
      <Pencil size={collapsed ? 24 : 16} />
      {!collapsed && <span>Compose</span>}
    </button>
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
          {accounts.map((acc) => (
            <MailSidebarItem
              key={acc.id}
              icon={
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 'var(--radius-full)',
                    background: acc.color,
                    display: 'inline-block',
                  }}
                />
              }
              label={acc.name}
              count={accountUnread[acc.id]}
              active={activeAccount === acc.id}
              collapsed={collapsed}
              onClick={() => onAccountChange(acc.id)}
              colorDot={acc.color}
            />
          ))}
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
    </nav>
  );
}
