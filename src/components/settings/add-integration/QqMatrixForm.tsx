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
 * QQ — vía el hub Matrix (matrix-qq). Sale del Gateway por el §A.0 del playbook.
 *
 * Login por QR con la app del móvil (verificado en el binario: solo trae
 * `QRLogin`; la ficha decía 'token' y era falso).
 *
 * El aviso de los servidores de firma NO es decorativo: el protocolo de QQ exige
 * firmar el handshake con algo que Tencent no publica, y el puente usa servidores
 * comunitarios de terceros. En una caja autoalojada eso es una decisión del
 * usuario, así que se dice ANTES de conectar y no en la documentación.
 */

import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormActions } from './shared';
import { MatrixBridgeForm, CALLOUT, type LoginPaneContext } from './MatrixBridgeForm';
import { useI18n } from '@/i18n';

function QqLoginPane({ ctx, step }: { ctx: LoginPaneContext; step: 'login' | 'awaiting-pair' }) {
  const { login, submitting, send, checkLinked, bridgeMessage, onCancel } = ctx;
  const { t } = useI18n();

  if (step === 'login') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('settings.qq.scan')}
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
          <img src={qr} alt={t('settings.qq.qrAlt')} style={{ width: 220, height: 220, borderRadius: 8, background: '#fff', padding: 8 }} />
        </div>
      )}
      <div style={{ ...CALLOUT, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
        <Smartphone size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>{t('settings.qq.scan')} {t('settings.matrix.expiringQr')}</span>
      </div>
      {bridgeMessage}
      <Button variant="outline" className="w-full" disabled={submitting} onClick={() => void send('qr')}>
        {t('settings.matrix.newQr')}
      </Button>
      <FormActions
        onBack={() => void send('cancel')}
        saving={submitting}
        onConfirm={() => void checkLinked(false)}
        submitLabel={t('settings.matrix.scanned')}
      />
    </div>
  );
}

export function QqMatrixForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  return (
    <MatrixBridgeForm
      onComplete={onComplete}
      onCancel={onCancel}
      config={{
        bridgeId: 'qq',
        serviceLabel: 'QQ',
        connectorDisplayName: 'QQ',
        hubSetupBlurb: (
          <>
            {t('settings.qq.setup')}
          </>
        ),
        // El "riesgo" aquí no es un baneo sino una dependencia de terceros, así
        // que el disclaimer dice eso y no lo genérico de las otras plataformas.
        disclaimer: {
          body: (
            <>
              {t('settings.qq.signingServers')}
            </>
          ),
          warning: (
            <>
              {t('settings.qq.thirdPartyWarning', { servers: 'sign.lagrangecore.org and sign.0w0.ing' })}
            </>
          ),
        },
        renderLogin: (ctx, step) => <QqLoginPane ctx={ctx} step={step} />,
        readyBlurb: (
          <>
            {t('settings.qq.ready')}
          </>
        ),
      }}
    />
  );
}
