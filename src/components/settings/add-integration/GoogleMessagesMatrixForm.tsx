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
 * Google Messages (SMS/RCS del móvil Android) — vía el hub Matrix
 * (mautrix-gmessages), emparejado como "Mensajes para web".
 *
 * Su login SÍ es un QR (verificado contra el binario v26.05, que registra
 * `QRLoginProcess`), a diferencia de Messenger, donde el 'qr' de la ficha era una
 * suposición falsa. Tras escanear hay un segundo paso propio de este servicio:
 * confirmar que el EMOJI del teléfono coincide con el de la pantalla.
 *
 * Solo aporta el panel de login: la carcasa está en `MatrixBridgeForm`.
 */

import { Smartphone, BatteryWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormActions } from './shared';
import { MatrixBridgeForm, CALLOUT, type LoginPaneContext } from './MatrixBridgeForm';
import { useI18n } from '@/i18n';

function GoogleMessagesLoginPane({
  ctx, step,
}: { ctx: LoginPaneContext; step: 'login' | 'awaiting-pair' }) {
  const { login, submitting, send, checkLinked, bridgeMessage, onCancel } = ctx;
  const { t } = useI18n();

  if (step === 'login') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('settings.matrix.googleMessagesIntro')}
        </p>
        {bridgeMessage}
        <FormActions
          onBack={onCancel}
          saving={submitting}
          onConfirm={() => void send('start')}
          submitLabel={submitting ? t('settings.matrix.gettingQr') : t('settings.matrix.showQr')}
        />
      </div>
    );
  }

  const qr = login?.qr ?? null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {qr && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img src={qr} alt={t('settings.matrix.qrAltGoogleMessages')} style={{ width: 220, height: 220, borderRadius: 8, background: '#fff', padding: 8 }} />
        </div>
      )}
      <div style={{ ...CALLOUT, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
        <Smartphone size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          {t('settings.matrix.phoneInstruction', { steps: 'Messages → menu → Device pairing → Pair device' })} {t('settings.matrix.expiringQr')}
        </span>
      </div>
      <div style={{ ...CALLOUT, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <BatteryWarning size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          {t('settings.matrix.phoneOffline')}
        </span>
      </div>
      {bridgeMessage}
      <Button variant="outline" className="w-full" disabled={submitting} onClick={() => void send('qr')}>
        {t('settings.matrix.newQr')}
      </Button>
      <FormActions
        onBack={() => void send('cancel')}
        saving={submitting}
        onConfirm={() => void checkLinked(false)}
        submitLabel={t('settings.matrix.paired')}
      />
      <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        {t('settings.matrix.autoPairCheck')}
      </p>
    </div>
  );
}

export function GoogleMessagesMatrixForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  return (
    <MatrixBridgeForm
      onComplete={onComplete}
      onCancel={onCancel}
      config={{
        bridgeId: 'gmessages',
        serviceLabel: 'Google Messages',
        connectorDisplayName: 'Google Messages',
        hubSetupBlurb: (
          <>
            {t('settings.matrix.googleMessagesSetup')}
          </>
        ),
        // Sin disclaimer de riesgo: emparejar un dispositivo web es una función
        // OFICIAL de Google Messages, no un cliente no oficial como en
        // WhatsApp/Messenger. Poner un aviso de baneo donde no lo hay solo
        // entrena al usuario a aceptar avisos sin leerlos (playbook §A.6).
        disclaimer: null,
        renderLogin: (ctx, step) => <GoogleMessagesLoginPane ctx={ctx} step={step} />,
        readyBlurb: (
          <>
            {t('settings.matrix.googleMessagesReady')}
          </>
        ),
      }}
    />
  );
}
