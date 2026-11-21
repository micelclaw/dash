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

/**
 * Sección "Enlace público" del modal unificado de compartir (absorbe los
 * legacy ShareModal + ShareEmailModal del Drive): crear enlace con password/
 * caducidad, copiar (buildShareUrl — nunca la url del backend), QR, revocar,
 * y envío del enlace por el relay SMTP del sistema.
 */

import { useState, useCallback } from 'react';
import { Copy, QrCode, Trash2, Mail, Link2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { buildShareUrl } from '@/lib/share-url';
import { useServiceUrlsStore } from '@/stores/service-urls.store';
import {
  createFileLink, emailFileLink, revokeFileLink,
  type FileShareLink,
} from '@/services/shares.service';
import { useI18n } from '@/i18n';

/** Opciones de caducidad del enlace (horas; '' = nunca). */
const EXPIRY_OPTIONS: { key: string; hours: number | '' }[] = [
  { key: 'shared.links.never', hours: '' },
  { key: 'shared.links.hour', hours: 1 },
  { key: 'shared.links.hours', hours: 24 },
  { key: 'shared.links.days7', hours: 168 },
  { key: 'shared.links.days30', hours: 720 },
];

interface PublicLinkSectionProps {
  fileId: string;
  links: FileShareLink[];
  onLinksChanged: () => void;
}

export function PublicLinkSection({ fileId, links, onLinksChanged }: PublicLinkSectionProps) {
  const { t, locale } = useI18n();
  const primaryDomain = useServiceUrlsStore((s) => s.primaryDomain);
  const [password, setPassword] = useState('');
  const [expiryHours, setExpiryHours] = useState<number | ''>('');
  const [creating, setCreating] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const copyLink = useCallback(async (token: string) => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(token, primaryDomain));
      toast.success(t('shared.links.copySuccess'));
    } catch { toast.error(t('shared.links.copyError')); }
  }, [primaryDomain, t]);

  const toggleQr = useCallback(async (token: string) => {
    if (qrToken === token) { setQrToken(null); setQrUrl(null); return; }
    try {
      const { blob } = await api.getBlob(`/share/${token}/qr`);
      setQrToken(token);
      setQrUrl(URL.createObjectURL(blob));
    } catch { toast.error(t('shared.links.qrError')); }
  }, [qrToken, t]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const link = await createFileLink(fileId, {
        password: password || undefined,
        expires_in_hours: expiryHours || undefined,
      });
      await navigator.clipboard.writeText(buildShareUrl(link.token, primaryDomain)).catch(() => {});
      toast.success(t('shared.links.createSuccess'));
      setPassword('');
      onLinksChanged();
    } catch { toast.error(t('shared.links.createError')); }
    setCreating(false);
  }, [fileId, password, expiryHours, primaryDomain, onLinksChanged, t]);

  const handleEmail = useCallback(async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return;
    setSending(true);
    try {
      const res = await emailFileLink(fileId, {
        email: email.trim(),
        message: message.trim() || undefined,
        password: password || undefined,
        expires_in_hours: expiryHours || undefined,
      });
      if (res.email_sent) toast.success(t('shared.links.emailSent', { email: email.trim() }));
      else toast.warning(t('shared.links.emailWarning'));
      setEmail(''); setMessage(''); setEmailOpen(false);
      onLinksChanged();
    } catch { toast.error(t('shared.links.emailError')); }
    setSending(false);
  }, [fileId, email, message, password, expiryHours, onLinksChanged, t]);

  const handleRevoke = useCallback(async (token: string) => {
    try {
      await revokeFileLink(token);
      toast.success(t('shared.links.revokeSuccess'));
      if (qrToken === token) { setQrToken(null); setQrUrl(null); }
      onLinksChanged();
    } catch { toast.error(t('shared.links.revokeError')); }
  }, [qrToken, onLinksChanged, t]);

  return (
    <>
      {/* Enlaces activos */}
      {links.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {links.map(l => (
            <div key={l.token}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
              }}>
                <Link2 size={13} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                <span style={{
                  flex: 1, fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  /share/{l.token.slice(0, 12)}…
                </span>
                {l.expires_at && (
                  <span title={t('shared.links.expires', { date: new Date(l.expires_at).toLocaleString(locale) })}
                    style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.6875rem', color: 'var(--warning, #f59e0b)' }}>
                    <Clock size={11} />
                  </span>
                )}
                {typeof l.download_count === 'number' && l.download_count > 0 && (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    {l.download_count}{l.max_downloads ? `/${l.max_downloads}` : ''}↓
                  </span>
                )}
                <IconBtn title={t('shared.links.copy')} onClick={() => copyLink(l.token)}><Copy size={12} /></IconBtn>
                <IconBtn title={t('shared.links.qr')} onClick={() => void toggleQr(l.token)}><QrCode size={12} /></IconBtn>
                <IconBtn title={t('shared.links.revoke')} danger onClick={() => void handleRevoke(l.token)}><Trash2 size={12} /></IconBtn>
              </div>
              {qrToken === l.token && qrUrl && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}>
                  <img src={qrUrl} alt={t('shared.links.qrAlt')} style={{ width: 140, height: 140, borderRadius: 'var(--radius-sm)', background: '#fff', padding: 6 }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Crear enlace nuevo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={password}
            onChange={e => setPassword(e.target.value)}
            aria-label={t('shared.links.password')}
            placeholder={t('shared.links.password')}
            style={{ ...inputStyle, flex: 1, minWidth: 120 }}
          />
          <select
            value={String(expiryHours)}
            onChange={e => setExpiryHours(e.target.value === '' ? '' : Number(e.target.value))}
            title={t('shared.links.expiry')}
            aria-label={t('shared.links.expiry')}
            style={selectStyle}
          >
            {EXPIRY_OPTIONS.map(o => (
              <option key={o.key} value={String(o.hours)}>{t(o.key)}</option>
            ))}
          </select>
          <button onClick={() => void handleCreate()} disabled={creating} style={primaryBtnStyle(creating)}>
            {creating ? t('shared.links.createBusy') : t('shared.links.create')}
          </button>
        </div>

        {/* Enviar por email (colapsado) */}
        <button
          onClick={() => setEmailOpen(o => !o)}
          aria-expanded={emailOpen}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', padding: '2px 0',
          }}
        >
          <Mail size={12} /> {emailOpen ? t('shared.links.emailHide') : t('shared.links.emailShow')}
        </button>
        {emailOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              type="email"
              aria-label={t('shared.links.emailPlaceholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('shared.links.emailPlaceholder')}
              style={inputStyle}
            />
            <textarea
              value={message}
              aria-label={t('shared.links.message')}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('shared.links.message')}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <button
              onClick={() => void handleEmail()}
              disabled={sending || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())}
              style={primaryBtnStyle(sending)}
            >
              {sending ? t('shared.links.sendBusy') : t('shared.links.send')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function IconBtn({ title, danger, onClick, children }: {
  title: string; danger?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', cursor: 'pointer', padding: 3,
        color: danger ? 'var(--error, #ef4444)' : 'var(--text-dim)', flexShrink: 0,
      }}
    >
      {children}
    </button>
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
};

const selectStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 8px',
  fontSize: '0.75rem',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
};

function primaryBtnStyle(busy: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    background: busy ? 'var(--surface)' : 'var(--amber)',
    border: 'none', borderRadius: 'var(--radius-sm)',
    color: busy ? 'var(--text-muted)' : '#000',
    fontSize: '0.75rem', fontWeight: 600,
    cursor: busy ? 'wait' : 'pointer',
    fontFamily: 'var(--font-sans)', flexShrink: 0,
  };
}
