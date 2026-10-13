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

import { useState } from 'react';
import { X, Loader2, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import { startChannel, type StartedChannel } from '@/services/messages.service';

type StartChatKind = 'phone' | 'username' | 'phone_or_username';

interface NewChatDialogProps {
  platform: string;
  platformLabel: string;
  /** Qué identificador pedir (de `capability.start_chat.kind`). */
  kind: StartChatKind;
  onClose: () => void;
  /** El chat creado + observado; el caller lo abre/selecciona. */
  onStarted: (channel: StartedChannel) => void;
}

const KIND_COPY: Record<StartChatKind, { placeholder: string; help: string }> = {
  phone: {
    placeholder: '+34 600 123 456',
    help: 'Escribe el número en formato internacional. Se creará el chat aunque no lo tengas guardado.',
  },
  username: {
    placeholder: '@usuario',
    help: 'Escribe el nombre de usuario.',
  },
  phone_or_username: {
    placeholder: '@usuario  ·  +34 600 123 456',
    help: 'Escribe el @usuario (o un teléfono que tengas en tus contactos).',
  },
};

/**
 * "Escribir a un contacto nuevo": input de número/usuario → crea el chat (portal
 * en matrix-bridge / número en Signal), lo deja observado y lo devuelve al caller.
 * Compartido por el selector de Messages y el de Settings → Channel Observers.
 */
export function NewChatDialog({ platform, platformLabel, kind, onClose, onStarted }: NewChatDialogProps) {
  const [identifier, setIdentifier] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = KIND_COPY[kind];

  async function handleStart() {
    const value = identifier.trim();
    if (!value || starting) return;
    setError(null);
    setStarting(true);
    try {
      const channel = await startChannel(platform, value);
      toast.success('Chat creado');
      onStarted(channel);
    } catch (err) {
      setError((err as Error)?.message || 'No se pudo crear el chat');
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      <div
        onClick={starting ? undefined : onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 210 }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 400,
        background: 'var(--glass-modal)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        boxShadow: '0 16px 64px rgba(0,0,0,0.5)', zIndex: 211,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            <MessageSquarePlus size={16} style={{ color: 'var(--amber)' }} />
            Escribir a un contacto nuevo
          </div>
          <button
            onClick={onClose}
            disabled={starting}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: starting ? 'default' : 'pointer', padding: 4, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {platformLabel} · {copy.help}
          </div>
          <input
            autoFocus
            type="text"
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
            placeholder={copy.placeholder}
            disabled={starting}
            style={{
              width: '100%', padding: '10px 12px',
              background: 'var(--surface)', border: `1px solid ${error ? 'var(--danger, #ef4444)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              fontFamily: 'var(--font-sans)', fontSize: '0.875rem',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          {error && (
            <div style={{ fontSize: '0.75rem', color: 'var(--danger, #ef4444)', lineHeight: 1.4 }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 16px', borderTop: '1px solid var(--border)',
        }}>
          <button
            onClick={onClose}
            disabled={starting}
            style={{
              padding: '8px 16px', background: 'none', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-dim)', cursor: starting ? 'default' : 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleStart}
            disabled={starting || !identifier.trim()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', background: 'var(--amber)', border: 'none',
              borderRadius: 'var(--radius-md)', color: '#000', fontWeight: 600,
              cursor: starting || !identifier.trim() ? 'default' : 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
              opacity: starting || !identifier.trim() ? 0.6 : 1,
            }}
          >
            {starting ? (<><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creando…</>) : 'Crear chat'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
