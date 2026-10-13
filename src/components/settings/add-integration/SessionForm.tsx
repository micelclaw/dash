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
 * Session (Oxen) — DOS variantes en un mismo wizard (comparten el sidecar Bun):
 *   - variant='own'  → «Session · identidad propia»: crea una identidad DEDICADA
 *     nueva en el servidor. El servidor NUNCA guarda tu clave maestra. NO son los
 *     chats de tu móvil: compartes tu Session ID/QR para que te añadan.
 *   - variant='link' → «Session · tu móvil»: IMPORTA tu frase de recuperación =
 *     espejo REAL de tus chats (Session es multi-dispositivo por la frase). Aviso:
 *     tu clave maestra vive en el servidor (irrevocable si se compromete).
 *
 * Flujo: explain → identity (crear/importar) → ready (Session ID + QR) → elegir chats.
 */

import { useState } from 'react';
import { Loader2, Check, Info, AlertTriangle, Copy, KeyRound, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/services/api';
import * as syncSvc from '@/services/sync.service';
import * as messagingCli from '@/services/messaging-cli.service';
import { QrImage } from '@/components/shared/QrImage';
import { Field, FormActions } from './shared';

type Step = 'explain' | 'identity' | 'ready';
type Variant = 'own' | 'link';

const CALLOUT: React.CSSProperties = {
  display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-md)',
  fontSize: '0.6875rem', lineHeight: 1.45, alignItems: 'flex-start',
};

export function SessionForm({
  variant,
  onComplete,
  onCancel,
}: {
  variant: Variant;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>('explain');
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [mnemonicIn, setMnemonicIn] = useState('');
  const [identity, setIdentity] = useState<messagingCli.SessionIdentity | null>(null);

  const connectorType = variant === 'link' ? 'session-link-observer' : 'session-observer';

  async function handleCreateIdentity() {
    if (variant === 'link' && !mnemonicIn.trim()) return;
    setSubmitting(true);
    try {
      const res = await messagingCli.createSessionIdentity(
        variant === 'link' ? 'import' : 'create',
        name.trim() || undefined,
        variant === 'link' ? mnemonicIn.trim() : undefined,
      );
      setIdentity(res);
      setStep('ready');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear la identidad de Session');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinish() {
    if (!identity) return;
    setSubmitting(true);
    try {
      await syncSvc.createConnector({
        connector_type: connectorType,
        config: {
          session_id: identity.session_id,
          private_key: identity.mnemonic,
          display_name: name.trim() || undefined,
        },
      });
      onComplete();
    } catch (err) {
      // Un connector por usuario → 409 = "ya existe" → seguir al selector.
      if (err instanceof ApiError && err.status === 409) { onComplete(); return; }
      toast.error(err instanceof Error ? err.message : 'No se pudo crear el canal');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── explain ───────────────────────────────────────────────────────

  if (step === 'explain') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {variant === 'own' ? (
          <>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Crea una identidad de Session <strong>nueva y separada</strong> que vive en tu servidor.
            </p>
            <div style={{ ...CALLOUT, background: 'rgba(0,247,130,0.07)', border: '1px solid rgba(0,247,130,0.25)', color: '#34d399' }}>
              <Info size={13} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>
                <strong>NO son los chats de tu móvil.</strong> Es una cuenta aparte. El servidor
                <strong> nunca</strong> guarda la clave maestra de tu cuenta real. Para hablar con
                alguien: comparte tu Session ID/QR para que te añadan. ¿Quieres el espejo de tu móvil?
                Usa la tarjeta «Session · tu móvil».
              </span>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Conecta <strong>tu cuenta real</strong> de Session pegando tu <strong>frase de
              recuperación</strong> — verás y responderás tus chats REALES del móvil.
            </p>
            <div style={{ ...CALLOUT, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
              <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>
                <strong>No pierdes nada en el móvil</strong> — Session es multi-dispositivo por la
                frase; ambos funcionan a la vez. Pero pones tu <strong>clave maestra</strong> en un
                servidor always-on: si lo comprometen, tu identidad no se puede revocar (la frase no
                rota). Si prefieres cero riesgo, usa «Session · identidad propia».
              </span>
            </div>
          </>
        )}
        <FormActions onBack={onCancel} saving={false} onConfirm={() => setStep('identity')} submitLabel="Continuar" />
      </div>
    );
  }

  // ─── identity (crear / importar) ───────────────────────────────────

  if (step === 'identity') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Nombre para mostrar (opcional)" hint="Es como te verán tus contactos en Session.">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Víctor (MicelclawOS)" />
        </Field>
        {variant === 'link' && (
          <Field label="Frase de recuperación" hint="Session → Ajustes → Frase de recuperación (13 palabras). Se guarda cifrada.">
            <textarea
              value={mnemonicIn}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMnemonicIn(e.target.value)}
              placeholder="palabra1 palabra2 palabra3 …"
              rows={3}
              style={{
                width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.6875rem',
                padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                background: 'var(--input, var(--bg))', color: 'var(--text)', lineHeight: 1.5,
              }}
            />
          </Field>
        )}
        {submitting && (
          <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Preparando el puente de Session… la primera vez puede tardar un minuto en construirse.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" onClick={() => setStep('explain')} disabled={submitting} className="flex-1">Atrás</Button>
          <Button
            onClick={handleCreateIdentity}
            disabled={submitting || (variant === 'link' && !mnemonicIn.trim())}
            className="flex-1"
          >
            {submitting
              ? <><Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} /> Preparando…</>
              : variant === 'link'
                ? <><KeyRound size={14} style={{ marginRight: 6 }} /> Importar mi cuenta</>
                : <><UserPlus size={14} style={{ marginRight: 6 }} /> Crear identidad</>}
          </Button>
        </div>
      </div>
    );
  }

  // ─── ready (Session ID + QR) ───────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...CALLOUT, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
        <Check size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>{variant === 'link' ? 'Cuenta importada.' : 'Identidad creada.'} Este es tu Session ID.</span>
      </div>

      <Field label="Tu Session ID" hint={variant === 'own' ? 'Compártelo (o deja que escaneen el QR) para que te añadan.' : 'Es el ID de tu cuenta real.'}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Input readOnly value={identity?.session_id ?? ''} style={{ fontFamily: 'monospace', fontSize: '0.625rem' }} />
          <Button variant="ghost" size="sm" disabled={!identity}
            onClick={() => { if (identity) { void navigator.clipboard.writeText(identity.session_id); toast.success('Session ID copiado'); } }}>
            <Copy size={13} />
          </Button>
        </div>
      </Field>

      {identity?.session_id && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <QrImage value={identity.session_id} size={160} />
        </div>
      )}

      {variant === 'own' && identity?.mnemonic && (
        <div style={{ ...CALLOUT, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24', flexDirection: 'column' }}>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600 }}>
            <KeyRound size={12} /> Guarda esta frase de recuperación
          </span>
          <code style={{ fontSize: '0.625rem', wordBreak: 'break-word', color: 'var(--text)' }}>{identity.mnemonic}</code>
          <span style={{ opacity: 0.85 }}>Es la única forma de recuperar esta identidad. Guárdala en un sitio seguro.</span>
        </div>
      )}

      <FormActions onBack={() => setStep('identity')} saving={submitting} onConfirm={handleFinish} submitLabel="Elegir chats" />
    </div>
  );
}
