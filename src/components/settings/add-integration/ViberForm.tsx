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
 * Viber — modelo BOT (una identidad aparte, no tu cuenta personal: Viber no
 * expone las cuentas de usuario a terceros).
 *
 * Es el único canal del repo que necesita que ALGUIEN DE FUERA pueda llamar a tu
 * servidor: su API de bots solo entrega por webhook (no hay polling, verificado
 * contra su documentación). Por eso el aviso de abajo no es un detalle técnico,
 * es la condición para que reciba mensajes — y el servidor lo comprueba: si no
 * hay URL pública configurada, el alta falla con ese motivo en vez de quedarse
 * "conectada" sin recibir nada.
 */

import { useState } from 'react';
import { Globe, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import * as syncSvc from '@/services/sync.service';
import { Field, FormActions } from './shared';

const CALLOUT: React.CSSProperties = {
  display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-md)',
  fontSize: '0.6875rem', lineHeight: 1.45, alignItems: 'flex-start',
};

export function ViberForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Viber connects as a <strong>bot</strong>, not as your personal account — Viber doesn&apos;t
        let anything else in. You&apos;ll see conversations people start with your bot, not your own
        chats.
      </p>
      <div style={{ ...CALLOUT, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
        <Bot size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          Create a bot at <strong>partners.viber.com</strong> and copy its authentication token.
        </span>
      </div>
      <div style={{ ...CALLOUT, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
        <Globe size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          <strong>Viber needs to reach your server from the internet.</strong> Unlike every other
          channel here, it only delivers messages by calling you — there&apos;s no way to ask it for
          new ones. Sending works either way; receiving needs a public HTTPS address.
        </span>
      </div>
      <Field label="Bot authentication token" hint="From partners.viber.com → your bot → Keys. It's stored encrypted.">
        <Input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="4f8b1c…-…-…"
          autoComplete="off"
        />
      </Field>
      <FormActions
        onBack={onCancel}
        saving={submitting}
        disabled={!token.trim()}
        onConfirm={async () => {
          setSubmitting(true);
          try {
            await syncSvc.createConnector({
              connector_type: 'viber-observer',
              display_name: 'Viber',
              config: { auth_token: token.trim() },
            });
            onComplete();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not connect Viber');
          } finally {
            setSubmitting(false);
          }
        }}
        submitLabel="Connect Viber"
      />
    </div>
  );
}
