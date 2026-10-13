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

import { EntitySource } from '@/components/shared/SourceBadge';
import { useEffect, useMemo, useState } from 'react';
import { ChevronUp, FileText } from 'lucide-react';
import { formatEmailTime } from '@/lib/date-helpers';
import { downloadAuthed } from '@/lib/file-download';
import { prepararCuerpo, cargarRemitentesPermitidos, recordarRemitente, remitenteNormalizado } from './lib/mail-html';
import { RemoteContentBanner } from './lib/RemoteContentBanner';
import type { Email } from './types';

interface MailThreadMessageProps {
  email: Email;
  collapsed: boolean;
  onToggle: () => void;
  isLatest: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MailThreadMessage({ email, collapsed, onToggle, isLatest: _isLatest }: MailThreadMessageProps) {
  // MISMA política de contenido remoto que el panel de lectura (y el MISMO
  // módulo): una conversación pinta N cuerpos, y cada uno avisaría a su
  // remitente. Este era el segundo punto de pintado que se quedaba fuera.
  const [mostrarRemotas, setMostrarRemotas] = useState(false);
  const [permitidos, setPermitidos] = useState<Set<string> | null>(null);
  const [bajando, setBajando] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    cargarRemitentesPermitidos().then((s) => { if (!cancelado) setPermitidos(s); });
    return () => { cancelado = true; };
  }, []);

  const remitente = remitenteNormalizado(email.from_address);
  const remitenteRecordado = !!(permitidos && remitente && permitidos.has(remitente));
  const mostrandoRemotas = mostrarRemotas || remitenteRecordado;
  const cuerpo = useMemo(
    () => (email.body_html
      ? prepararCuerpo(email.body_html, {
          emailId: email.id,
          bloquearRemotas: !mostrandoRemotas,
          variante: 'hilo',
          adjuntos: email.attachments ?? [],
        })
      : null),
    [email.body_html, email.id, email.attachments, mostrandoRemotas],
  );

  const handleSiempreRemitente = async () => {
    if (!email.from_address) return;
    try {
      setPermitidos(await recordarRemitente(email.from_address));
      setMostrarRemotas(true);
    } catch {
      /* el toast lo da el panel de lectura; aquí no se rompe nada si falla */
    }
  };

  const handleDescargarAdjunto = async (idx: number, filename: string) => {
    setBajando(idx);
    try {
      await downloadAuthed(`/api/v1/emails/${email.id}/attachments/${idx}/download`, filename || `adjunto-${idx + 1}`);
    } finally {
      setBajando(null);
    }
  };

  if (collapsed) {
    return (
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 4,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          transition: 'background var(--transition-fast)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
      >
        <span
          style={{
            fontWeight: 600,
            fontSize: '0.8125rem',
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {email.from_name ?? email.from_address} <EntitySource entity={email} domain="mail" />
        </span>
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0,
          }}
        >
          &mdash; {(email.body_plain ?? '').slice(0, 40)}
        </span>
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {formatEmailTime(email.received_at)}
        </span>
      </div>
    );
  }

  // Expanded view
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 4,
        background: 'var(--surface)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ padding: "8px 12px 0" }}><EntitySource entity={email} domain="mail" detail /></div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          padding: '12px 12px 8px',
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text)' }}>
              {email.from_name ?? email.from_address}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              &lt;{email.from_address}&gt;
            </span>
          </div>
          {/* To / CC */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
            <span>
              To: {(email.to_addresses ?? []).map(a => a.name ?? a.address).join(', ')}
            </span>
            {(email.cc_addresses ?? []).length > 0 && (
              <span style={{ marginLeft: 12 }}>
                CC: {(email.cc_addresses ?? []).map(a => a.name ?? a.address).join(', ')}
              </span>
            )}
          </div>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {formatEmailTime(email.received_at)}
        </span>
        <button
          onClick={onToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ChevronUp size={14} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '0 12px 12px' }}>
        {cuerpo && permitidos !== null && (
          <RemoteContentBanner
            compacto
            remotas={cuerpo.remotas}
            hosts={cuerpo.hosts}
            cid={cuerpo.cid}
            mostrando={mostrandoRemotas}
            recordado={remitenteRecordado}
            remitente={remitente}
            onMostrar={() => setMostrarRemotas(true)}
            onSiempre={handleSiempreRemitente}
          />
        )}
        {cuerpo ? (
          <iframe
            key={`${email.id}:${mostrandoRemotas ? 'show' : 'block'}`}
            title={email.subject || 'Email content'}
            srcDoc={cuerpo.doc}
            // `allow-same-origin` SIN `allow-scripts` (igual que el panel de
            // lectura): un correo con <script> sigue sin ejecutarse, y el padre
            // puede leer `contentDocument` para ajustar el alto — con `sandbox=""`
            // (origen opaco) el onLoad de abajo NUNCA podía medirlo y todo mensaje
            // del hilo se quedaba clavado en 100px.
            sandbox="allow-same-origin"
            style={{ width: '100%', border: 'none', minHeight: 100 }}
            onLoad={(e) => {
              const iframe = e.target as HTMLIFrameElement;
              if (iframe.contentDocument) {
                iframe.style.height = iframe.contentDocument.body.scrollHeight + 'px';
              }
            }}
          />
        ) : (
          <div
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: '0.8125rem',
              color: 'var(--text)',
              lineHeight: 1.6,
            }}
          >
            {email.body_plain}
          </div>
        )}
      </div>

      {/* Attachments */}
      {(email.attachments ?? []).length > 0 && (
        <div style={{ padding: '0 12px 12px' }}>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-dim)',
              marginBottom: 6,
              borderTop: '1px solid var(--border)',
              paddingTop: 8,
            }}
          >
            Attachments ({(email.attachments ?? []).length})
          </div>
          {(email.attachments ?? []).map((att, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 0',
                fontSize: '0.8125rem',
              }}
            >
              <FileText size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <span style={{ color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {att.filename}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>
                {formatFileSize(att.size)}
              </span>
              {att.source_id || (att as { content?: string }).content ? (
                <button
                  data-testid={`thread-att-download-${idx}`}
                  onClick={() => handleDescargarAdjunto(idx, att.filename)}
                  disabled={bajando === idx}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    color: bajando === idx ? 'var(--text-muted)' : 'var(--text)',
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    cursor: bajando === idx ? 'progress' : 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {bajando === idx ? 'Bajando…' : 'Download'}
                </button>
              ) : (
                <span
                  title="De este adjunto solo se guardó el nombre y el tamaño. Vuelve a sincronizar la cuenta."
                  style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}
                >
                  no disponible
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
