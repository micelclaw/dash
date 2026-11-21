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

import { useRef, useState } from 'react';
import { Loader2, Check, Info, AlertTriangle, Copy, KeyRound, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/services/api';
import * as syncSvc from '@/services/sync.service';
import * as messagingCli from '@/services/messaging-cli.service';
import { QrImage } from '@/components/shared/QrImage';
import { Field, FormActions } from './shared';
import { useI18n } from '@/i18n';

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
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
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
      toast.error(err instanceof Error ? err.message : tRef.current('settings.session.identityFailed'));
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
      toast.error(err instanceof Error ? err.message : tRef.current('settings.session.channelFailed'));
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
              {t('settings.session.identityOwn')}
            </p>
            <div style={{ ...CALLOUT, background: 'rgba(0,247,130,0.07)', border: '1px solid rgba(0,247,130,0.25)', color: '#34d399' }}>
              <Info size={13} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>
                {t('settings.session.ownWarning')}
              </span>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              {t('settings.session.importIntro')}
            </p>
            <div style={{ ...CALLOUT, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
              <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>
                {t('settings.session.importWarning')}
              </span>
            </div>
          </>
        )}
        <FormActions onBack={onCancel} saving={false} onConfirm={() => setStep('identity')} submitLabel={t('settings.matrix.continue')} />
      </div>
    );
  }

  // ─── identity (crear / importar) ───────────────────────────────────

  if (step === 'identity') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label={t('settings.session.displayNameOptional')} hint={t('settings.session.displayNameHint')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Víctor (MicelclawOS)" />
        </Field>
        {variant === 'link' && (
          <Field label={t('settings.session.recoveryPhrase')} hint={t('settings.session.recoveryHint')}>
            <textarea
              value={mnemonicIn}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMnemonicIn(e.target.value)}
              placeholder={t('settings.session.mnemonicPlaceholder')}
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
            {t('settings.session.preparing')}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" onClick={() => setStep('explain')} disabled={submitting} className="flex-1">{t('settings.forms.back')}</Button>
          <Button
            onClick={handleCreateIdentity}
            disabled={submitting || (variant === 'link' && !mnemonicIn.trim())}
            className="flex-1"
          >
            {submitting
              ? <><Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} /> {t('settings.session.preparingShort')}</>
              : variant === 'link'
                ? <><KeyRound size={14} style={{ marginRight: 6 }} /> {t('settings.session.import')}</>
                : <><UserPlus size={14} style={{ marginRight: 6 }} /> {t('settings.session.create')}</>}
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
        <span>{variant === 'link' ? t('settings.session.imported') : t('settings.session.created')} {t('settings.session.id')}</span>
      </div>

      <Field label={t('settings.session.id')} hint={variant === 'own' ? t('settings.session.ownIdHint') : t('settings.session.realIdHint')}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Input readOnly value={identity?.session_id ?? ''} style={{ fontFamily: 'monospace', fontSize: '0.625rem' }} />
          <Button variant="ghost" size="sm" aria-label={t('settings.session.copyId')} disabled={!identity}
            onClick={() => { if (identity) { void navigator.clipboard.writeText(identity.session_id); toast.success(t('settings.session.idCopied')); } }}>
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
            <KeyRound size={12} /> {t('settings.session.savePhrase')}
          </span>
          <code style={{ fontSize: '0.625rem', wordBreak: 'break-word', color: 'var(--text)' }}>{identity.mnemonic}</code>
          <span style={{ opacity: 0.85 }}>{t('settings.session.recoveryHelp')}</span>
        </div>
      )}

      <FormActions onBack={() => setStep('identity')} saving={submitting} onConfirm={handleFinish} submitLabel={t('settings.session.chooseChats')} />
    </div>
  );
}
