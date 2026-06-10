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

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  ChevronLeft, Mail, Phone, MapPin, FileText, Tag,
  Globe, Edit3, Trash2, PhoneCall, Camera, Upload, FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { RelatedItemsPanel } from '@/components/shared/RelatedItemsPanel';
import { TagChip } from '@/components/shared/TagChip';
import { SimilarContentPanel } from '@/components/shared/SimilarContentPanel';
import { GraphProximityContactPanel } from '@/components/shared/GraphProximityContactPanel';
import { AvatarCropModal } from '@/components/shared/AvatarCropModal';
import { useCoNavigation } from '@/hooks/use-co-navigation';
import { useMailState } from '@/modules/mail/hooks/use-mail-state';
import { useAuthStore } from '@/stores/auth.store';
import type { Contact } from './types';
import type { LinkedRecord } from '@/types/links';

interface ContactDetailProps {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
  onBack?: () => void;
  onContactUpdated?: (updated?: Contact) => void;
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
  contact, onEdit, onDelete, onBack, onContactUpdated, linkedRecords, linkedRecordsLoading,
}: ContactDetailProps) {
  useCoNavigation('contact', contact.id);
  const navigate = useNavigate();
  const [deleteHover, setDeleteHover] = useState(false);
  const [avatarErr, setAvatarErr] = useState(false);
  const [avatarMenu, setAvatarMenu] = useState(false);
  const [cloudSearch, setCloudSearch] = useState<string | null>(null);
  const [cloudResults, setCloudResults] = useState<Array<{ id: string; filename: string }>>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cloudDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const token = useAuthStore(s => s.tokens?.accessToken);
  const initials = getInitials(contact.display_name);

  const buildAvatarUrl = (path: string) =>
    path.startsWith('/api/') ? `${path}${path.includes('?') ? '&' : '?'}token=${token}` : `/api/v1/contacts/${contact.id}/avatar?token=${token}`;
  const avatarSrc = contact.avatar_path && !avatarErr ? buildAvatarUrl(contact.avatar_path) : null;

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
    setAvatarMenu(false);
  }, []);

  const handleCloudSearch = useCallback((q: string) => {
    setCloudSearch(q);
    clearTimeout(cloudDebounceRef.current);
    if (!q.trim()) { setCloudResults([]); return; }
    cloudDebounceRef.current = setTimeout(async () => {
      setCloudLoading(true);
      try {
        const res = await api.get<{ data: Array<{ id: string; filename: string }> }>('/files', {
          search: q, mime_type: 'image/', limit: 8,
        });
        setCloudResults(res.data ?? []);
      } catch { setCloudResults([]); }
      finally { setCloudLoading(false); }
    }, 300);
  }, []);

  const handleCloudPick = useCallback(async (fileId: string) => {
    setAvatarMenu(false);
    setCloudSearch(null);
    setCloudResults([]);
    // Fetch the image as data URL for the crop modal
    try {
      const imgUrl = `/api/v1/files/${fileId}/preview?token=${token}&width=512`;
      const resp = await fetch(imgUrl);
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onload = () => setCropSrc(reader.result as string);
      reader.readAsDataURL(blob);
    } catch {
      toast.error('Failed to load image');
    }
  }, [token]);

  const handleCropConfirm = useCallback(async (blob: Blob) => {
    setCropSrc(null);
    try {
      const formData = new FormData();
      formData.append('file', blob, 'avatar.webp');
      const res = await api.upload<{ data: Contact }>(`/contacts/${contact.id}/avatar`, formData);
      const updated = (res as any).data ?? res;
      setAvatarErr(false);
      onContactUpdated?.(updated);
      toast.success('Avatar updated');
    } catch {
      toast.error('Failed to upload avatar');
    }
  }, [contact.id, onContactUpdated]);
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
        {/* Clickable avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            style={{ cursor: 'pointer', position: 'relative' }}
            onClick={() => setAvatarMenu(prev => !prev)}
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt=""
                onError={() => setAvatarErr(true)}
                style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--amber-dim)', color: 'var(--amber)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.25rem', fontWeight: 600, letterSpacing: '0.02em',
              }}>
                {initials}
              </div>
            )}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,0,0,0.4)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              opacity: avatarMenu ? 1 : 0,
              transition: 'opacity 0.15s',
            }}>
              <Camera size={20} style={{ color: '#fff' }} />
            </div>
          </div>

          {/* Dropdown menu — closes on backdrop click, not on mouse leave */}
          {avatarMenu && (
            <>
              <div
                onClick={() => { setAvatarMenu(false); setCloudSearch(null); setCloudResults([]); }}
                style={{ position: 'fixed', inset: 0, zIndex: 9 }}
              />
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4,
                background: 'rgba(17,17,24,0.92)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                backdropFilter: 'blur(8px)', padding: '4px 0', minWidth: 220,
                zIndex: 10,
              }}>
                <button
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); setAvatarMenu(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '8px 12px', background: 'transparent', border: 'none',
                    color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Upload size={14} /> Upload from device
                </button>
                {contact.avatar_path && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      setAvatarMenu(false);
                      try {
                        await api.patch(`/contacts/${contact.id}`, { avatar_path: null });
                        onContactUpdated?.();
                        toast.success('Avatar removed');
                      } catch { toast.error('Failed to remove avatar'); }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '8px 12px', background: 'transparent', border: 'none',
                      color: 'var(--error)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Trash2 size={14} /> Remove avatar
                  </button>
                )}
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <div style={{ padding: '4px 12px 8px' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6,
                  }}>
                    <FolderOpen size={12} /> Choose from Cloud
                  </div>
                  <input
                    value={cloudSearch ?? ''}
                    onChange={e => handleCloudSearch(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    placeholder="Search images..."
                    autoFocus
                    style={{
                      width: '100%', padding: '6px 8px', fontSize: '0.75rem',
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                      fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  {cloudLoading && (
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '6px 0' }}>Searching...</div>
                  )}
                  {cloudResults.length > 0 && (
                    <div style={{ maxHeight: 160, overflowY: 'auto', marginTop: 4 }}>
                      {cloudResults.map(f => (
                        <button
                          key={f.id}
                          onClick={(e) => { e.stopPropagation(); handleCloudPick(f.id); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                            padding: '5px 4px', background: 'transparent', border: 'none',
                            color: 'var(--text)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
                            cursor: 'pointer', textAlign: 'left', borderRadius: 'var(--radius-sm)',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <img
                            src={`/api/v1/files/${f.id}/preview?token=${token}&width=32`}
                            alt=""
                            style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.filename}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>

        {/* Crop modal */}
        <AvatarCropModal
          open={!!cropSrc}
          imageSrc={cropSrc ?? ''}
          onConfirm={handleCropConfirm}
          onClose={() => setCropSrc(null)}
        />
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
                <TagChip
                  key={tag}
                  tag={tag}
                  onClick={() => {
                    onBack?.();
                    navigate(`/contacts?tag=${encodeURIComponent(tag)}`);
                  }}
                />
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
        <SimilarContentPanel sourceType="contact" sourceId={contact.id} />
        <GraphProximityContactPanel contactId={contact.id} />

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
              onClick={() => {
                useMailState.getState().openComposer({
                  mode: 'new',
                  to: [{ address: primaryEmail, name: contact.display_name || undefined }],
                });
                navigate('/mail');
              }}
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
