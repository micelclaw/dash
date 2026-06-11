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

import { useState, useEffect } from 'react';
import { X, Mail, Link2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import type { ApiResponse } from '@/types/api';
import type { FileRecord } from '@/types/files';

interface ShareEmailModalProps {
  open: boolean;
  file: FileRecord;
  onClose: () => void;
}

interface EmailShareResult {
  url: string;
  email_sent: boolean;
  email_error?: string | null;
}

const EXPIRY_OPTIONS: { label: string; hours: number | null }[] = [
  { label: 'Never expires', hours: null },
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
];

/**
 * Share a file by email (D4): POST /files/:id/share/email creates a public
 * link and sends it through the system SMTP relay (best-effort). Optional
 * message, password and expiry.
 */
export function ShareEmailModal({ open, file, onClose }: ShareEmailModalProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [expiresInHours, setExpiresInHours] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<EmailShareResult | null>(null);

  useEffect(() => {
    if (open) {
      setEmail('');
      setMessage('');
      setPassword('');
      setExpiresInHours(null);
      setResult(null);
    }
  }, [open]);

  if (!open) return null;

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const handleSend = async () => {
    if (!emailValid) return;
    setSending(true);
    try {
      const res = await api.post<ApiResponse<EmailShareResult>>(`/files/${file.id}/share/email`, {
        email: email.trim(),
        message: message.trim() || undefined,
        password: password || undefined,
        expires_in_hours: expiresInHours ?? undefined,
      });
      setResult(res.data);
      if (res.data.email_sent) {
        toast.success(`Link emailed to ${email.trim()}`);
      } else {
        toast.warning('Link created, but the email could not be sent (no SMTP relay?). Copy it manually.');
      }
    } catch {
      toast.error('Could not create the share link');
    }
    setSending(false);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          width: 440, maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{
            margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)',
            display: 'flex', alignItems: 'center', gap: 8,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <Mail size={15} style={{ flexShrink: 0, color: 'var(--mod-drive)' }} />
            Share &quot;{file.filename}&quot; by email
          </h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', padding: 2, flexShrink: 0, display: 'flex',
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Recipient email *">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="someone@example.com"
              autoFocus
              style={inputStyle}
            />
          </Field>

          <Field label="Message (optional)">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Here's the file we talked about…"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
            />
          </Field>

          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="Password (optional)" style={{ flex: 1 }}>
              <input
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="None"
                style={inputStyle}
              />
            </Field>
            <Field label="Expires" style={{ flex: 1 }}>
              <select
                value={expiresInHours ?? ''}
                onChange={e => setExpiresInHours(e.target.value === '' ? null : Number(e.target.value))}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {EXPIRY_OPTIONS.map(opt => (
                  <option key={opt.label} value={opt.hours ?? ''}>{opt.label}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Result link */}
          {result && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}>
              <Link2 size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <span style={{
                flex: 1, fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {result.url}
              </span>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(result.url);
                  toast.success('Link copied');
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  background: 'transparent', color: 'var(--text-dim)',
                  fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <Copy size={12} />
                Copy
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: '1px solid var(--border)',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
              fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={() => { void handleSend(); }}
              disabled={!emailValid || sending}
              style={{
                padding: '6px 14px',
                background: (!emailValid || sending) ? 'var(--surface)' : 'var(--amber)',
                border: 'none', borderRadius: 'var(--radius-sm)',
                color: (!emailValid || sending) ? 'var(--text-muted)' : '#000',
                fontSize: '0.8125rem', fontWeight: 600,
                cursor: (!emailValid || sending) ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {sending ? 'Sending…' : 'Create link & send'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      <span style={{
        fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 10px',
  fontSize: '0.8125rem',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};
