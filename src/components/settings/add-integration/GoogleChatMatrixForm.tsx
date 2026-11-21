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
 * Google Chat con tu CUENTA REAL — vía el hub Matrix (mautrix-googlechat).
 *
 * Sale del Gateway por el §A.0 del playbook, igual que IRC y WhatsApp.
 *
 * Su login es de UN disparo: el bridge no abre diálogo, acepta las cookies como
 * argumento del comando (`login-cookie <json>`, leído del código de la imagen).
 * Por eso este panel no tiene paso previo: pegas y envías.
 *
 * A diferencia de Messenger, aquí el formato SÍ importa — el bridge hace
 * `json.loads` y rechaza cualquier cosa que no sea un objeto JSON.
 */

import { useState } from 'react';
import { Cookie, ExternalLink } from 'lucide-react';
import { Field, FormActions } from './shared';
import { MatrixBridgeForm, CALLOUT, type LoginPaneContext } from './MatrixBridgeForm';
import { useI18n } from '@/i18n';

function GoogleChatLoginPane({ ctx }: { ctx: LoginPaneContext }) {
  const { submitting, send, bridgeMessage, onCancel } = ctx;
  const { t } = useI18n();
  const [cookies, setCookies] = useState('');

  // El bridge hace json.loads: avisar ANTES de mandar evita un viaje de ida y
  // vuelta para que conteste "Invalid JSON".
  const looksLikeJson = (() => {
    const t = cookies.trim();
    if (!t) return true;
    try { const v = JSON.parse(t); return typeof v === 'object' && v !== null && !Array.isArray(v); }
    catch { return false; }
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        {t('settings.matrix.googleChatIntro')}
      </p>
      <div style={{ ...CALLOUT, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
        <ExternalLink size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          {t('settings.matrix.googleChatCookies')}
        </span>
      </div>
      {bridgeMessage}
      <Field
        label={t('settings.matrix.googleChatLabel')}
        hint={looksLikeJson
          ? t('settings.matrix.jsonValid')
          : t('settings.matrix.jsonInvalid')}
      >
        <textarea
          value={cookies}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCookies(e.target.value)}
          placeholder='{"COMPASS":"…","SSID":"…","SID":"…"}'
          rows={5}
          style={{
            width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.6875rem',
            padding: '8px 10px', borderRadius: 'var(--radius-md)',
            border: `1px solid ${looksLikeJson ? 'var(--border)' : 'rgba(245,158,11,0.5)'}`,
            background: 'var(--input, var(--bg))', color: 'var(--text)', lineHeight: 1.5,
          }}
        />
      </Field>
      <div style={{ ...CALLOUT, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <Cookie size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          {t('settings.matrix.googleCookiesStored')}
        </span>
      </div>
      <FormActions
        onBack={onCancel}
        saving={submitting}
        disabled={!cookies.trim() || !looksLikeJson}
        // Un solo disparo: no hay `start` que abrir.
        onConfirm={() => void send('cookies', cookies.trim())}
        submitLabel={submitting ? t('settings.matrix.googleLinking') : t('settings.matrix.linkGoogleChat')}
      />
    </div>
  );
}

export function GoogleChatMatrixForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  return (
    <MatrixBridgeForm
      onComplete={onComplete}
      onCancel={onCancel}
      config={{
        bridgeId: 'googlechat',
        serviceLabel: 'Google Chat',
        connectorDisplayName: 'Google Chat',
        hubSetupBlurb: (
          <>
            {t('settings.matrix.googleChatSetup')}
          </>
        ),
        // Sin disclaimer de baneo: reusar tu propia sesión web de Google Workspace
        // no es un cliente no autorizado como en WhatsApp o Messenger.
        disclaimer: null,
        renderLogin: (ctx) => <GoogleChatLoginPane ctx={ctx} />,
        readyBlurb: (
          <>
            {t('settings.matrix.googleChatReady')}
          </>
        ),
      }}
    />
  );
}
