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

// La barra que explica por qué un correo no se ve entero. Vive con
// `mail-html.ts` porque es su cara: la política de bloqueo y su explicación
// tienen que cambiar juntas (los DOS sitios que pintan correo la comparten; el
// bug original de este módulo fue precisamente tener la política duplicada).
//
// El módulo de correo del dash NO usa Tailwind: estilos en línea con variables CSS.

import { ShieldCheck, ShieldAlert, Paperclip } from 'lucide-react';

interface Props {
  /** Imágenes remotas distintas que trae el correo. */
  remotas: number;
  /** Hosts a los que se avisaría al mostrarlas. */
  hosts: string[];
  /** Imágenes `cid:` (adjuntos del propio correo) que hoy no se pintan. */
  cid: number;
  /** true = ya se están pidiendo por el servidor. */
  mostrando: boolean;
  /** true = el remitente está en la lista permitida (no hay nada que decidir). */
  recordado: boolean;
  remitente: string;
  onMostrar: () => void;
  onSiempre: () => void;
  /** Dentro de una conversación la barra va más compacta. */
  compacto?: boolean;
}

export function RemoteContentBanner({
  remotas, hosts, cid, mostrando, recordado, remitente, onMostrar, onSiempre, compacto,
}: Props) {
  // Nada remoto y nada `cid` → no hay nada que explicar. Y si el remitente ya
  // está permitido, tampoco: la barra solo aparece cuando hay una decisión.
  if (remotas === 0 && cid === 0) return null;
  if (recordado && cid === 0) return null;

  const fs = compacto ? '0.6875rem' : '0.75rem';
  const pad = compacto ? '5px 8px' : '8px 10px';

  return (
    <div
      data-testid="mail-remote-banner"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap',
        padding: pad, marginBottom: 8,
        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
        background: 'var(--surface)', fontFamily: 'var(--font-sans)', fontSize: fs,
      }}
    >
      {mostrando
        ? <ShieldCheck size={14} style={{ color: 'var(--success, #22c55e)', flexShrink: 0, marginTop: 1 }} />
        : <ShieldAlert size={14} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />}

      <div style={{ flex: 1, minWidth: 160 }}>
        {remotas > 0 && (
          <div style={{ color: 'var(--text)' }}>
            {mostrando
              ? `Imágenes cargadas por tu servidor (${remotas})`
              : `Imágenes bloqueadas (${remotas})`}
          </div>
        )}
        {remotas > 0 && !compacto && (
          <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
            {mostrando
              ? 'Las pide Micelclaw, no tu navegador: el remitente no ve tu IP.'
              : `Cargarlas avisaría a ${hosts.length === 1 ? hosts[0] : `${hosts.length} servidores del remitente`} de que has abierto el correo.`}
          </div>
        )}
        {cid > 0 && (
          <div style={{ color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Paperclip size={11} style={{ flexShrink: 0 }} />
            {cid} {cid === 1 ? 'imagen incrustada del propio correo' : 'imágenes incrustadas del propio correo'} — todavía no se muestran
          </div>
        )}
      </div>

      {remotas > 0 && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {!mostrando && (
            <button data-testid="mail-remote-show" onClick={onMostrar} style={botonStyle(true)}>
              Mostrar
            </button>
          )}
          {!recordado && remitente && (
            <button data-testid="mail-remote-always" onClick={onSiempre} style={botonStyle(false)} title={`Permitir siempre las imágenes de ${remitente}`}>
              Siempre de este remitente
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function botonStyle(primario: boolean): React.CSSProperties {
  return {
    border: `1px solid ${primario ? 'var(--amber)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: primario ? 'var(--amber)' : 'var(--text-dim)',
    fontSize: '0.75rem',
    fontFamily: 'var(--font-sans)',
    padding: '3px 9px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}
