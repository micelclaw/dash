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
 * WhatsApp con tu CUENTA REAL — vía el hub Matrix (mautrix-whatsapp, "dispositivo
 * vinculado" como WhatsApp Web).
 *
 * Desde 2026-08-05 este fichero es SOLO su panel de login: la carcasa (máquina de
 * pasos derivada del backend, alta de instancia, disclaimer, connector compartido
 * y pantalla final) vive en `MatrixBridgeForm` y la comparten los bridges del hub.
 * El copy y el comportamiento son los mismos de antes, a propósito: la extracción
 * no debía cambiar nada de lo que ya estaba verificado en vivo.
 *
 * Flujo INVERSO al de Telegram: aquí el bridge genera un CÓDIGO de 8 caracteres
 * (o un QR) y el usuario lo introduce/escanea EN SU MÓVIL. El éxito llega como
 * mensaje no solicitado del bot → lo descubre el poll de `status` de la carcasa.
 */

import { useState } from 'react';
import { Copy, QrCode, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FormActions } from './shared';
import { MatrixBridgeForm, CALLOUT, type LoginPaneContext } from './MatrixBridgeForm';
import { useI18n } from '@/i18n';

function WhatsAppLoginPane({
  ctx, step,
}: { ctx: LoginPaneContext; step: 'login' | 'awaiting-pair' }) {
  const { login, submitting, send, checkLinked, bridgeMessage, onCancel } = ctx;
  const { t } = useI18n();
  // El teléfono es un input del panel, así que su estado vive aquí — no en la
  // carcasa, que no tiene por qué saber que este bridge pide un número.
  const [phone, setPhone] = useState('');

  /** `start` (= `login phone`) arma el flujo; el bot pide entonces el número. */
  async function requestCode() {
    const started = await send('start');
    if (started && (started.state === 'awaiting_phone' || started.state === 'unknown')) {
      await send('phone', phone.trim());
    }
  }

  if (step === 'login') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('settings.whatsapp.intro')}
        </p>
        {bridgeMessage}
        <Field
          label={t('settings.whatsapp.phone')}
          hint={t('settings.whatsapp.phoneHint')}
        >
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 123 456" inputMode="tel" />
        </Field>
        <FormActions
          onBack={onCancel}
          saving={submitting}
          disabled={!phone.trim()}
          onConfirm={requestCode}
          submitLabel={t('settings.whatsapp.getCode')}
        />
        <Button variant="outline" className="w-full" disabled={submitting} onClick={() => void send('qr')}>
          <QrCode size={13} style={{ marginRight: 6 }} /> {t('settings.whatsapp.useQrInstead')}
        </Button>
      </div>
    );
  }

  // ─── El usuario actúa EN SU MÓVIL (código o QR) ───────────────────────────
  const code = login?.pairing_code ?? null;
  const qr = login?.qr ?? null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {code && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              fontFamily: 'monospace', fontSize: '1.75rem', letterSpacing: '0.15em',
              padding: '10px 18px', borderRadius: 'var(--radius-md)',
              background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
            }}
          >
            {code}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { void navigator.clipboard.writeText(code); toast.success(t('settings.whatsapp.codeCopied')); }}
          >
            <Copy size={12} style={{ marginRight: 5 }} /> {t('settings.whatsapp.copyCode')}
          </Button>
        </div>
      )}
      {qr && !code && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img src={qr} alt={t('settings.whatsapp.qrAlt')} style={{ width: 220, height: 220, borderRadius: 8, background: '#fff', padding: 8 }} />
        </div>
      )}
      <div style={{ ...CALLOUT, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
        <KeyRound size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          <strong>{t('settings.whatsapp.phoneSteps')}</strong>
          {code ? <> → <strong>{t('settings.whatsapp.phoneCodeSteps')}</strong></> : <> {t('settings.whatsapp.phoneQrSteps')}</>}
          {' '}{t('settings.whatsapp.expires')}
        </span>
      </div>
      {bridgeMessage}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          variant="outline"
          className="flex-1"
          disabled={submitting}
          onClick={async () => {
            // Regenerar: re-arma el flujo con el mismo número (o pide QR nuevo).
            if (code && phone.trim()) await requestCode();
            else await send('qr');
          }}
        >
          {code ? t('settings.whatsapp.newCode') : t('settings.whatsapp.newQr')}
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          disabled={submitting}
          onClick={() => void send(code ? 'qr' : 'start').then(async (r) => {
            // Cambiar de método: código↔QR.
            if (!code && r && (r.state === 'awaiting_phone' || r.state === 'unknown') && phone.trim()) {
              await send('phone', phone.trim());
            }
          })}
        >
          {code ? <><QrCode size={13} style={{ marginRight: 5 }} /> {t('settings.whatsapp.useQr')}</> : <><KeyRound size={13} style={{ marginRight: 5 }} /> {t('settings.whatsapp.useCode')}</>}
        </Button>
      </div>
      <FormActions
        onBack={() => void send('cancel')}
        saving={submitting}
        onConfirm={() => void checkLinked(false)}
        submitLabel={t('settings.whatsapp.linked')}
      />
      <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        {t('settings.whatsapp.autoCheck')}
      </p>
    </div>
  );
}

export function WhatsAppMatrixForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  return (
    <MatrixBridgeForm
      onComplete={onComplete}
      onCancel={onCancel}
      config={{
        bridgeId: 'whatsapp',
        serviceLabel: 'WhatsApp',
        connectorDisplayName: 'WhatsApp',
        hubSetupBlurb: (
          <>
            {t('settings.whatsapp.bridgeSetup')}
          </>
        ),
        disclaimer: {
          body: (
            <>
              {t('settings.whatsapp.disclaimer')}
            </>
          ),
          warning: (
            <>
              {t('settings.whatsapp.warning')}
            </>
          ),
        },
        renderLogin: (ctx, step) => <WhatsAppLoginPane ctx={ctx} step={step} />,
        readyBlurb: (
          <>
            {t('settings.whatsapp.ready')}
          </>
        ),
      }}
    />
  );
}
