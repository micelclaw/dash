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
 * Facebook Messenger con tu CUENTA REAL — vía el hub Matrix (mautrix-meta,
 * configurado en modo `messenger`).
 *
 * Su login NO es QR ni teléfono: se reusa la sesión web pegando las cookies de
 * messenger.com. Se verificó contra el binario v26.07 (el único flujo que trae es
 * `MetaCookieLogin`); la ficha de plataforma decía "qr" y era una suposición, así
 * que un wizard de QR habría esperado una imagen que el bridge no manda nunca.
 *
 * Es UN campo y no varios (c_user, xs, datr…) a propósito: el bridge ya sabe leer
 * tanto el JSON de un exportador como la cadena cruda de `document.cookie`.
 * Partirlo obligaría al dash a parsear un formato ajeno y a romperse cada vez que
 * Meta añada una cookie.
 */

import { useState } from 'react';
import { Cookie, ExternalLink } from 'lucide-react';
import { Field, FormActions } from './shared';
import { MatrixBridgeForm, CALLOUT, type LoginPaneContext } from './MatrixBridgeForm';

function MessengerLoginPane({ ctx }: { ctx: LoginPaneContext }) {
  const { submitting, send, bridgeMessage, onCancel } = ctx;
  const [cookies, setCookies] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Messenger has no pairing code and no QR: the bridge reuses the session your browser
        already has. You&apos;ll copy that session&apos;s cookies once and paste them here.
      </p>
      <div style={{ ...CALLOUT, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
        <ExternalLink size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          Open <strong>messenger.com</strong> in your browser while logged in, open the developer
          tools (<strong>F12</strong>) → <strong>Application → Cookies → https://www.messenger.com</strong>,
          and copy them. A cookie-export extension works too — paste whatever it gives you.
        </span>
      </div>
      {bridgeMessage}
      <Field
        label="Messenger cookies"
        hint="Paste the whole thing — JSON from an exporter or the raw document.cookie string. It must include c_user and xs."
      >
        {/* `<textarea>` crudo con los tokens del tema, igual que el wizard de
            Session: no hay primitivo Textarea en components/ui/ y crear uno para
            un solo campo iría contra la regla de no inventar primitives. */}
        <textarea
          value={cookies}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCookies(e.target.value)}
          placeholder='[{"name":"c_user","value":"…"}, …]   or   c_user=…; xs=…; datr=…'
          rows={5}
          style={{
            width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.6875rem',
            padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
            background: 'var(--input, var(--bg))', color: 'var(--text)', lineHeight: 1.5,
          }}
        />
      </Field>
      <div style={{ ...CALLOUT, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <Cookie size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          These cookies stay on your server. Logging out of messenger.com in that browser also
          disconnects this bridge — use a browser profile you don&apos;t log out of.
        </span>
      </div>
      <FormActions
        onBack={onCancel}
        saving={submitting}
        disabled={!cookies.trim()}
        onConfirm={async () => {
          // `start` abre el flujo de cookies; el bot pide entonces el blob.
          const started = await send('start');
          if (started && started.state !== 'error') {
            await send('cookies', cookies.trim());
          }
        }}
        submitLabel={submitting ? 'Linking…' : 'Link Messenger'}
      />
    </div>
  );
}

export function MessengerMatrixForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  return (
    <MatrixBridgeForm
      onComplete={onComplete}
      onCancel={onCancel}
      config={{
        bridgeId: 'meta',
        serviceLabel: 'Messenger',
        connectorDisplayName: 'Messenger',
        hubSetupBlurb: (
          <>
            Personal Messenger accounts connect through a private Matrix bridge that runs on your own
            server. Set it up once — everyone on this instance can then link their own account. Your
            messages never leave your server.
          </>
        ),
        disclaimer: {
          body: (
            <>
              This links your personal Facebook Messenger account by reusing your web session, through
              an unofficial bridge that runs on your server.
            </>
          ),
          warning: (
            <>
              <strong>Meta may flag or lock accounts that connect from unofficial clients.</strong>{' '}
              To keep the risk low: don&apos;t send bulk messages from Micelclaw, and expect to paste
              fresh cookies if you change your password or log out of that browser.
            </>
          ),
        },
        // Meta no tiene un paso "hazlo en el móvil": pegar las cookies es el paso
        // final, así que el panel es el mismo en 'login' y en 'awaiting-pair'.
        renderLogin: (ctx) => <MessengerLoginPane ctx={ctx} />,
        readyBlurb: (
          <>
            Your Messenger account is linked and the bridge is importing your conversations. Next,
            choose which chats Micelclaw should observe — you don&apos;t have to sync everything.
          </>
        ),
      }}
    />
  );
}
