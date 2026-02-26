import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ChevronLeft, Mail, Phone, MapPin, FileText, Tag,
  Globe, Edit3, Trash2, PhoneCall,
} from 'lucide-react';
import { RelatedItemsPanel } from '@/components/shared/RelatedItemsPanel';
import type { Contact } from './types';
import type { LinkedRecord } from '@/types/links';

interface ContactDetailProps {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
  onBack?: () => void;
  linkedRecords: LinkedRecord[];
  linkedRecordsLoading: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  return (name.trim().slice(0, 2) || '??').toUpperCase();
}

function LabelBadge({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      borderRadius: 'var(--radius-sm)',
      fontSize: '0.625rem',
      fontWeight: 500,
      fontFamily: 'var(--font-sans)',
      textTransform: 'capitalize',
      background: 'var(--surface-hover)',
      color: 'var(--text-dim)',
      border: '1px solid var(--border)',
    }}>
      {label}
    </span>
  );
}

function formatAddress(addr: Contact['addresses'][number]): string {
  const parts: string[] = [];
  if (addr.city) parts.push(addr.city);
  if (addr.state) parts.push(addr.state);
  if (addr.country) parts.push(addr.country);
  return parts.join(', ') || 'Address';
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
  fontFamily: 'var(--font-sans)',
};

const sectionItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 0',
  fontSize: '0.8125rem',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
};

const actionButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  transition: 'background var(--transition-fast), border-color var(--transition-fast)',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-dim)',
  fontWeight: 500,
};

export function ContactDetail({
  contact, onEdit, onDelete, onBack, linkedRecords, linkedRecordsLoading,
}: ContactDetailProps) {
  const navigate = useNavigate();
  const [deleteHover, setDeleteHover] = useState(false);
  const initials = getInitials(contact.display_name);
  const primaryEmail = contact.emails?.find(e => e.primary)?.address || contact.emails?.[0]?.address;
  const primaryPhone = contact.phones?.find(p => p.primary)?.number || contact.phones?.[0]?.number;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg)',
      overflowY: 'auto',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Back button (mobile) */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '8px 12px',
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <ChevronLeft size={16} />
          Back
        </button>
      )}

      {/* Header */}
      <div style={{ padding: '24px 24px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'var(--amber-dim)',
          color: 'var(--amber)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.25rem',
          fontWeight: 600,
          flexShrink: 0,
          letterSpacing: '0.02em',
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {contact.display_name}
          </div>
          {(contact.job_title || contact.company) && (
            <div style={{
              fontSize: '0.8125rem',
              color: 'var(--text-dim)',
              marginTop: 2,
            }}>
              {contact.job_title}
              {contact.job_title && contact.company && ' @ '}
              {contact.company}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 24px 24px', flex: 1 }}>
        {/* Emails */}
        {(contact.emails?.length ?? 0) > 0 && (
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <Mail size={12} />
              Emails
            </div>
            {contact.emails.map((email, i) => (
              <div key={i} style={sectionItemStyle}>
                <a
                  href={`mailto:${email.address}`}
                  style={{ color: 'var(--amber)', textDecoration: 'none', fontSize: '0.8125rem' }}
                >
                  {email.address}
                </a>
                <LabelBadge label={email.label} />
                {email.primary && (
                  <span style={{ fontSize: '0.625rem', color: 'var(--amber)', fontWeight: 600 }}>
                    PRIMARY
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Phones */}
        {(contact.phones?.length ?? 0) > 0 && (
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <Phone size={12} />
              Phones
            </div>
            {contact.phones.map((phone, i) => (
              <div key={i} style={sectionItemStyle}>
                <a
                  href={`tel:${phone.number}`}
                  style={{ color: 'var(--amber)', textDecoration: 'none', fontSize: '0.8125rem' }}
                >
                  {phone.number}
                </a>
                <LabelBadge label={phone.label} />
                {phone.primary && (
                  <span style={{ fontSize: '0.625rem', color: 'var(--amber)', fontWeight: 600 }}>
                    PRIMARY
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Addresses */}
        {(contact.addresses?.length ?? 0) > 0 && (
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <MapPin size={12} />
              Addresses
            </div>
            {contact.addresses.map((addr, i) => (
              <div key={i} style={sectionItemStyle}>
                <span style={{ color: 'var(--text)', fontSize: '0.8125rem' }}>
                  {formatAddress(addr)}
                </span>
                <LabelBadge label={addr.label} />
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {contact.notes && (
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <FileText size={12} />
              Notes
            </div>
            <p style={{
              fontSize: '0.8125rem',
              color: 'var(--text)',
              lineHeight: 1.5,
              margin: 0,
              whiteSpace: 'pre-wrap',
            }}>
              {contact.notes}
            </p>
          </div>
        )}

        {/* Tags */}
        {(contact.tags?.length ?? 0) > 0 && (
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <Tag size={12} />
              Tags
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {contact.tags.map(tag => (
                <span
                  key={tag}
                  onClick={() => {
                    onBack?.();
                    navigate(`/contacts?tag=${encodeURIComponent(tag)}`);
                  }}
                  style={{
                    padding: '2px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-sans)',
                    background: 'var(--amber-dim)',
                    border: '1px solid var(--amber)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--amber)'; e.currentTarget.style.color = '#06060a'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--amber-dim)'; e.currentTarget.style.color = 'var(--text)'; }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Source badge */}
        {contact.source !== 'local' && (
          <div style={{ marginBottom: 16 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-sans)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
            }}>
              <Globe size={10} />
              {contact.source}
            </span>
          </div>
        )}

        {/* Related items */}
        <RelatedItemsPanel links={linkedRecords} loading={linkedRecordsLoading} onNavigate={onBack} />

        {/* Quick actions */}
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          paddingTop: 16,
          marginTop: 16,
          borderTop: '1px solid var(--border)',
        }}>
          {primaryEmail && (
            <button
              onClick={() => { window.location.href = `mailto:${primaryEmail}`; }}
              style={actionButtonStyle}
            >
              <Mail size={14} />
              Email
            </button>
          )}
          {primaryPhone && (
            <button
              onClick={() => { window.location.href = `tel:${primaryPhone}`; }}
              style={actionButtonStyle}
            >
              <PhoneCall size={14} />
              Call
            </button>
          )}
          <button
            onClick={onEdit}
            style={actionButtonStyle}
          >
            <Edit3 size={14} />
            Edit
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Delete "${contact.display_name}"? This action can be undone.`)) {
                onDelete();
              }
            }}
            onMouseEnter={() => setDeleteHover(true)}
            onMouseLeave={() => setDeleteHover(false)}
            style={{
              ...actionButtonStyle,
              color: deleteHover ? '#ef4444' : 'var(--text-muted)',
              borderColor: deleteHover ? '#ef4444' : 'var(--border)',
            }}
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
