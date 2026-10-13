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
 * IRC — vía el hub Matrix (mautrix-irc). Sale del Gateway por el §A.0 del
 * playbook, igual que WhatsApp.
 *
 * Su login es CONVERSACIONAL, y eso no es una limitación del wizard sino la
 * forma honesta de tratarlo: el bridge usa `LoginProcessUserInput` (verificado
 * contra el binario: campos network / nick / password / username / realname) y
 * el ORDEN en que los pide lo decide él, no está documentado y puede cambiar
 * entre builds — más aún siendo un build de desarrollo. Codificar aquí una
 * secuencia fija sería inventarse un contrato ajeno.
 *
 * Así que el panel enseña el PROMPT LITERAL del bot y manda lo que el usuario
 * teclee. Sirve para IRC hoy y para cualquier otro bridge de la misma familia
 * sin escribir código nuevo.
 */

import { useState } from 'react';
import { Terminal, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Field, FormActions } from './shared';
import { MatrixBridgeForm, CALLOUT, type LoginPaneContext } from './MatrixBridgeForm';

/** Las cuatro redes que trae preconfiguradas la imagen (verificado en su config). */
const PRESET_NETWORKS = ['libera', 'oftc', 'ircnet', 'ergo'];

function IrcLoginPane({ ctx, step }: { ctx: LoginPaneContext; step: 'login' | 'awaiting-pair' }) {
  const { login, submitting, send, bridgeMessage, onCancel } = ctx;
  const [value, setValue] = useState('');

  if (step === 'login') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          IRC asks for its details one at a time — network, nickname, and a password if the network
          needs one. Start the login and answer whatever it asks.
        </p>
        <div style={{ ...CALLOUT, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <Info size={13} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            Networks ready to use: <strong>{PRESET_NETWORKS.join(', ')}</strong>. IRC keeps no
            server-side history, so you&apos;ll only see messages from the moment you connect.
          </span>
        </div>
        {bridgeMessage}
        <FormActions
          onBack={onCancel}
          saving={submitting}
          onConfirm={() => void send('start')}
          submitLabel={submitting ? 'Starting…' : 'Start login'}
        />
      </div>
    );
  }

  // El bot ha preguntado algo: se enseña su texto tal cual y se responde.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...CALLOUT, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
        <Terminal size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>The bridge is asking for something — its exact words are below. Type your answer.</span>
      </div>
      {bridgeMessage}
      <Field label="Your answer" hint={`If it's asking for the network, one of: ${PRESET_NETWORKS.join(', ')}.`}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={login?.hint ?? '…'}
          autoFocus
        />
      </Field>
      <FormActions
        onBack={() => void send('cancel')}
        saving={submitting}
        disabled={!value.trim()}
        onConfirm={async () => {
          await send('input', value.trim());
          setValue(''); // el siguiente campo empieza en blanco
        }}
        submitLabel="Send"
      />
    </div>
  );
}

export function IrcMatrixForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  return (
    <MatrixBridgeForm
      onComplete={onComplete}
      onCancel={onCancel}
      config={{
        bridgeId: 'irc',
        serviceLabel: 'IRC',
        connectorDisplayName: 'IRC',
        hubSetupBlurb: (
          <>
            IRC connects through a private Matrix bridge that runs on your own server. Set it up
            once — everyone on this instance can then connect their own nickname.
          </>
        ),
        // Sin disclaimer de riesgo: IRC no sanciona clientes de terceros, es un
        // protocolo abierto. Poner un aviso donde no lo hay solo entrena al
        // usuario a aceptarlos sin leerlos (playbook §A.6).
        disclaimer: null,
        renderLogin: (ctx, step) => <IrcLoginPane ctx={ctx} step={step} />,
        readyBlurb: (
          <>
            You&apos;re connected to IRC. Next, choose which channels Micelclaw should observe.
            Remember there&apos;s no history: you&apos;ll see messages from now on.
          </>
        ),
      }}
    />
  );
}
