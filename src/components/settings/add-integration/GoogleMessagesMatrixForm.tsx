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

function GoogleMessagesLoginPane({
  ctx, step,
}: { ctx: LoginPaneContext; step: 'login' | 'awaiting-pair' }) {
  const { login, submitting, send, checkLinked, bridgeMessage, onCancel } = ctx;

  if (step === 'login') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          This pairs with the Messages app on your Android phone, the same way the web version
          does. You&apos;ll scan a QR code and then confirm an emoji.
        </p>
        {bridgeMessage}
        <FormActions
          onBack={onCancel}
          saving={submitting}
          onConfirm={() => void send('start')}
          submitLabel={submitting ? 'Getting QR…' : 'Show QR code'}
        />
      </div>
    );
  }

  const qr = login?.qr ?? null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {qr && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img src={qr} alt="Google Messages pairing QR" style={{ width: 220, height: 220, borderRadius: 8, background: '#fff', padding: 8 }} />
        </div>
      )}
      <div style={{ ...CALLOUT, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
        <Smartphone size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          On your phone: <strong>Messages → menu → Device pairing → Pair device</strong>, scan the
          QR, then check that the emoji shown on the phone matches the one here. The QR expires
          after a couple of minutes.
        </span>
      </div>
      <div style={{ ...CALLOUT, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <BatteryWarning size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          Your phone does the actual sending. If it&apos;s off or out of data, messages won&apos;t
          go through — that&apos;s how Messages for web works, not a Micelclaw failure.
        </span>
      </div>
      {bridgeMessage}
      <Button variant="outline" className="w-full" disabled={submitting} onClick={() => void send('qr')}>
        New QR code
      </Button>
      <FormActions
        onBack={() => void send('cancel')}
        saving={submitting}
        onConfirm={() => void checkLinked(false)}
        submitLabel="I've paired it"
      />
      <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        This screen checks automatically every few seconds while you pair.
      </p>
    </div>
  );
}

export function GoogleMessagesMatrixForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
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
            Your phone&apos;s SMS and RCS connect through a private Matrix bridge that runs on your
            own server. Set it up once — everyone on this instance can then pair their own phone.
            Your messages never leave your server.
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
            Your phone is paired and the bridge is importing your conversations. Next, choose which
            ones Micelclaw should observe — you don&apos;t have to sync everything.
          </>
        ),
      }}
    />
  );
}
