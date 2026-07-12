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

/** Opciones de caducidad del enlace (horas; '' = nunca). */
const EXPIRY_OPTIONS: { label: string; hours: number | '' }[] = [
  { label: 'Nunca', hours: '' },
  { label: '1 hora', hours: 1 },
  { label: '24 horas', hours: 24 },
  { label: '7 días', hours: 168 },
  { label: '30 días', hours: 720 },
];

interface PublicLinkSectionProps {
  fileId: string;
  links: FileShareLink[];
  onLinksChanged: () => void;
}

export function PublicLinkSection({ fileId, links, onLinksChanged }: PublicLinkSectionProps) {
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
      toast.success('Enlace copiado');
    } catch { toast.error('No se pudo copiar'); }
  }, [primaryDomain]);

  const toggleQr = useCallback(async (token: string) => {
    if (qrToken === token) { setQrToken(null); setQrUrl(null); return; }
    try {
      const { blob } = await api.getBlob(`/share/${token}/qr`);
      setQrToken(token);
      setQrUrl(URL.createObjectURL(blob));
    } catch { toast.error('No se pudo generar el QR'); }
  }, [qrToken]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const link = await createFileLink(fileId, {
        password: password || undefined,
        expires_in_hours: expiryHours || undefined,
      });
      await navigator.clipboard.writeText(buildShareUrl(link.token, primaryDomain)).catch(() => {});
      toast.success('Enlace creado y copiado');
      setPassword('');
      onLinksChanged();
    } catch { toast.error('No se pudo crear el enlace'); }
    setCreating(false);
  }, [fileId, password, expiryHours, primaryDomain, onLinksChanged]);

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
      if (res.email_sent) toast.success(`Enlace enviado a ${email.trim()}`);
      else toast.warning('Enlace creado, pero el email no se pudo enviar (¿sin relay SMTP?). Cópialo a mano.');
      setEmail(''); setMessage(''); setEmailOpen(false);
      onLinksChanged();
    } catch { toast.error('No se pudo crear/enviar el enlace'); }
    setSending(false);
  }, [fileId, email, message, password, expiryHours, onLinksChanged]);

  const handleRevoke = useCallback(async (token: string) => {
    try {
      await revokeFileLink(token);
      toast.success('Enlace revocado');
      if (qrToken === token) { setQrToken(null); setQrUrl(null); }
      onLinksChanged();
    } catch { toast.error('No se pudo revocar'); }
  }, [qrToken, onLinksChanged]);

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
                  <span title={`Caduca ${new Date(l.expires_at).toLocaleString('es-ES')}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.6875rem', color: 'var(--warning, #f59e0b)' }}>
                    <Clock size={11} />
                  </span>
                )}
                {typeof l.download_count === 'number' && l.download_count > 0 && (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    {l.download_count}{l.max_downloads ? `/${l.max_downloads}` : ''}↓
                  </span>
                )}
                <IconBtn title="Copiar enlace" onClick={() => copyLink(l.token)}><Copy size={12} /></IconBtn>
                <IconBtn title="Código QR" onClick={() => void toggleQr(l.token)}><QrCode size={12} /></IconBtn>
                <IconBtn title="Revocar" danger onClick={() => void handleRevoke(l.token)}><Trash2 size={12} /></IconBtn>
              </div>
              {qrToken === l.token && qrUrl && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}>
                  <img src={qrUrl} alt="QR del enlace" style={{ width: 140, height: 140, borderRadius: 'var(--radius-sm)', background: '#fff', padding: 6 }} />
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
            placeholder="Contraseña (opcional)"
            style={{ ...inputStyle, flex: 1, minWidth: 120 }}
          />
          <select
            value={String(expiryHours)}
            onChange={e => setExpiryHours(e.target.value === '' ? '' : Number(e.target.value))}
            title="Caducidad"
            style={selectStyle}
          >
            {EXPIRY_OPTIONS.map(o => (
              <option key={o.label} value={String(o.hours)}>{o.label}</option>
            ))}
          </select>
          <button onClick={() => void handleCreate()} disabled={creating} style={primaryBtnStyle(creating)}>
            {creating ? 'Creando…' : 'Crear enlace'}
          </button>
        </div>

        {/* Enviar por email (colapsado) */}
        <button
          onClick={() => setEmailOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', padding: '2px 0',
          }}
        >
          <Mail size={12} /> {emailOpen ? 'Ocultar envío por email' : 'Enviar el enlace por email…'}
        </button>
        {emailOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="destinatario@ejemplo.com"
              style={inputStyle}
            />
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Mensaje (opcional)"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <button
              onClick={() => void handleEmail()}
              disabled={sending || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())}
              style={primaryBtnStyle(sending)}
            >
              {sending ? 'Enviando…' : 'Crear y enviar'}
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
