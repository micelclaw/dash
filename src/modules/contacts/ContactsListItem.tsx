import { EntityContextMenu } from '@/components/shared/EntityContextMenu';
import type { Contact } from './types';

interface ContactsListItemProps {
  contact: Contact;
  selected: boolean;
  onClick: () => void;
  onDelete?: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  return (name.trim().slice(0, 2) || '??').toUpperCase();
}

function getSubtitle(contact: Contact): string | null {
  const parts: string[] = [];
  if (contact.job_title) parts.push(contact.job_title);
  if (contact.company) parts.push(contact.company);
  if (parts.length === 0) return null;
  return parts.join(' \u00B7 ');
}

export function ContactsListItem({ contact, selected, onClick, onDelete }: ContactsListItemProps) {
  const initials = getInitials(contact.display_name);
  const subtitle = getSubtitle(contact);

  return (
    <EntityContextMenu
      entityType="contact"
      entityId={contact.id}
      entityTitle={contact.display_name}
      onEdit={onClick}
      onDelete={onDelete}
      trigger={
        <div
          onClick={onClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            cursor: 'pointer',
            borderLeft: selected ? '2px solid var(--amber)' : '2px solid transparent',
            background: selected ? 'var(--surface-hover)' : 'transparent',
            transition: 'background var(--transition-fast), border-color var(--transition-fast)',
          }}
          onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
        >
          {/* Avatar */}
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--amber-dim)',
            color: 'var(--amber)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.6875rem',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            flexShrink: 0,
            letterSpacing: '0.02em',
          }}>
            {initials}
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: 'var(--font-sans)',
            }}>
              {contact.display_name}
            </div>
            {subtitle && (
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-dim)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: 1,
                fontFamily: 'var(--font-sans)',
              }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>
      }
    />
  );
}
