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
 * Carcasa COMÚN de los wizards de bridge del hub Matrix (cuentas REALES, no bots).
 *
 * Extraída de WhatsAppMatrixForm al entrar el 3er bridge (mautrix-meta). El
 * reparto no es estético, es el que marca la realidad medida: los seis bridges
 * del hub comparten la máquina de pasos, el alta de instancia, el connector y la
 * pantalla final — y NO comparten nada del panel de login (WhatsApp pide un
 * teléfono y devuelve un código para el móvil; Messenger pide las cookies de la
 * sesión web; IRC pedirá servidor y contraseña). Por eso el panel de login lo
 * aporta cada bridge como `renderLogin`, en vez de intentar un formulario
 * universal que acabaría siendo un `switch` disfrazado.
 *
 * REGLAS DEL PROYECTO conservadas tal cual (venían del wizard de WhatsApp):
 *  - El paso se DERIVA del backend (`bridges.<id>.ready_for_login` + el `state`
 *    del bridge), nunca de un `useState('connecting')`.
 *  - Los useState son inputs + `submitting` + el disclaimer (informativo).
 *  - El mensaje LITERAL del bridge se muestra siempre (incluido `unknown`).
 *  - Disclaimer de riesgo ANTES de conectar (requisito playbook §A.6).
 */

import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Loader2, Check, Lock, MessageCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuthStore } from '@/stores/auth.store';
import { ApiError } from '@/services/api';
import * as hub from '@/services/matrix-hub.service';
import * as syncSvc from '@/services/sync.service';
import { FormActions } from './shared';

/** Paso DERIVADO — no hay setStep para el estado "largo". */
export type BridgeStep =
  | 'loading' | 'hub-setup' | 'hub-unavailable' | 'disclaimer' | 'login' | 'awaiting-pair' | 'ready';

export const CALLOUT: React.CSSProperties = {
  display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-md)',
  fontSize: '0.6875rem', lineHeight: 1.45, alignItems: 'flex-start',
};

/** Lo que la carcasa presta al panel de login de cada bridge. */
export interface LoginPaneContext {
  login: hub.LoginResult | null;
  submitting: boolean;
  /** Manda un paso al bot y refleja su respuesta. Devuelve null si no contestó. */
  send: (step: hub.LoginStep, value?: string) => Promise<hub.LoginResult | null>;
  /** ¿Ya está vinculado? (el éxito puede llegar como mensaje no solicitado). */
  checkLinked: (silent: boolean) => Promise<boolean>;
  /** El texto LITERAL del bot, ya maquetado. Píntalo: es la red anti-fallo mudo. */
  bridgeMessage: ReactNode;
  onCancel: () => void;
}

export interface MatrixBridgeConfig {
  bridgeId: hub.BridgeId;
  /** Nombre del servicio de cara al usuario ("WhatsApp", "Messenger"). */
  serviceLabel: string;
  /** Nombre del connector que se crea al terminar. */
  connectorDisplayName: string;
  /** Explicación del alta de instancia (solo admin, solo si el bridge no existe). */
  hubSetupBlurb: ReactNode;
  /**
   * Disclaimer de riesgo. `null` = este bridge no lo necesita (playbook §A.6 lo
   * exige donde el servicio puede sancionar la cuenta; forzarlo donde no aplica
   * solo entrena al usuario a aceptar avisos sin leerlos).
   */
  disclaimer: { body: ReactNode; warning: ReactNode } | null;
  /** Panel de login propio del bridge (pasos `login` y `awaiting-pair`). */
  renderLogin: (ctx: LoginPaneContext, step: 'login' | 'awaiting-pair') => ReactNode;
  /** Copy de la pantalla final, antes de elegir chats. */
  readyBlurb: ReactNode;
}

function deriveStep(
  cfg: MatrixBridgeConfig,
  status: hub.MatrixHubStatus | null,
  login: hub.LoginResult | null,
  isAdmin: boolean,
  riskAccepted: boolean,
): BridgeStep {
  if (!status) return 'loading';
  const br = status.bridges?.[cfg.bridgeId];
  if (!br?.ready_for_login) return isAdmin ? 'hub-setup' : 'hub-unavailable';
  if (!login) return 'loading';
  switch (login.state) {
    case 'done': return 'ready';
    case 'awaiting_pair': return 'awaiting-pair';
    default: return cfg.disclaimer && !riskAccepted ? 'disclaimer' : 'login';
  }
}

export function MatrixBridgeForm({
  config, onComplete, onCancel,
}: { config: MatrixBridgeConfig; onComplete: () => void; onCancel: () => void }) {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin' || role === 'owner';

  // Estado del BACKEND (la verdad).
  const [status, setStatus] = useState<hub.MatrixHubStatus | null>(null);
  const [login, setLogin] = useState<hub.LoginResult | null>(null);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { bridgeId, serviceLabel } = config;

  const refresh = useCallback(async () => {
    try {
      const s = await hub.getMatrixHubStatus();
      setStatus(s);
      if (s.bridges?.[bridgeId]?.ready_for_login) {
        try {
          setLogin(await hub.advanceLogin('status', undefined, bridgeId));
        } catch (err) {
          // Si el bridge no contesta NO nos quedamos en el spinner: 'unknown'
          // deja intentar el login y enseña el motivo.
          setLogin({
            state: 'unknown',
            message: err instanceof Error ? err.message : `The ${serviceLabel} bridge did not answer.`,
            hint: null,
          });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not read the ${serviceLabel} bridge status`);
    }
  }, [bridgeId, serviceLabel]);

  useEffect(() => { void refresh(); }, [refresh]);

  const step = deriveStep(config, status, login, isAdmin, riskAccepted);

  async function handleSetupHub() {
    setSubmitting(true);
    try {
      toast.info(`Setting up the ${serviceLabel} bridge — this can take a few minutes the first time.`);
      await hub.startMatrixHub(bridgeId);
      await refresh();
      toast.success(`${serviceLabel} bridge is running`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not set up the bridge');
    } finally {
      setSubmitting(false);
    }
  }

  const send = useCallback(async (loginStep: hub.LoginStep, value?: string) => {
    setSubmitting(true);
    try {
      const r = await hub.advanceLogin(loginStep, value, bridgeId);
      setLogin(r);
      if (r.state === 'error') toast.error(r.hint ?? r.message);
      else if (r.state === 'unknown') toast.warning('Unexpected reply from the bridge — see the message below');
      return r;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `The ${serviceLabel} bridge did not respond`);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [bridgeId, serviceLabel]);

  /** ¿Ya está vinculado? El éxito puede llegar como mensaje NO solicitado. */
  const checkLinked = useCallback(async (silent: boolean) => {
    try {
      const r = await hub.advanceLogin('status', undefined, bridgeId);
      if (r.state === 'done') { setLogin(r); return true; }
      if (!silent) toast.info('Not linked yet — finish the remaining steps and try again.');
    } catch {
      if (!silent) toast.error(`The ${serviceLabel} bridge did not respond`);
    }
    return false;
  }, [bridgeId, serviceLabel]);

  // Poll suave SOLO mientras se espera una acción fuera del dash. Nunca clobbea
  // el paso (solo aplica el resultado si es `done`). PAUSADO mientras hay un
  // comando en vuelo (`submitting`): así el poll no compite por la respuesta del
  // bot con un botón que el usuario acabe de pulsar. El core además serializa por
  // bridge, pero pausar aquí evita encolar pings redundantes.
  useEffect(() => {
    if (step !== 'awaiting-pair' || submitting) return;
    const t = setInterval(() => { void checkLinked(true); }, 5_000);
    return () => clearInterval(t);
  }, [step, submitting, checkLinked]);

  /** Tras el login: crear (o REUSAR) el connector del hub y saltar al selector. */
  async function handleChooseChats() {
    setSubmitting(true);
    try {
      await syncSvc.createConnector({
        connector_type: 'gateway-observer',
        display_name: config.connectorDisplayName,
        config: { channel_type: 'matrix', account_id: 'default', agent_mode: 'observe' },
      });
      onComplete();
    } catch (err) {
      // El connector del hub Matrix es COMPARTIDO (otro bridge pudo crearlo
      // antes): el 409 significa "ya existe" → seguir al selector con normalidad.
      if (err instanceof ApiError && err.status === 409) {
        onComplete();
        return;
      }
      toast.error(err instanceof Error ? err.message : `Could not create the ${serviceLabel} channel`);
    } finally {
      setSubmitting(false);
    }
  }

  // Mensaje literal del bridge — se ve SIEMPRE que haya uno.
  const bridgeMessage = login?.message ? (
    <div style={{ ...CALLOUT, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
      <MessageCircle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
      <div>
        <div style={{ whiteSpace: 'pre-wrap' }}>{login.message}</div>
        {login.hint && <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>{login.hint}</div>}
      </div>
    </div>
  ) : null;

  if (step === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 32 }}>
        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>
          Checking your {serviceLabel} bridge…
        </p>
      </div>
    );
  }

  // ─── (A) Instancia — solo admin, solo si el bridge no está listo ───────────
  if (step === 'hub-setup') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {config.hubSetupBlurb}
        </p>
        <div style={{ ...CALLOUT, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
          <MessageCircle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>Setting up restarts the internal Matrix server for a few seconds — channels you already connected keep working (they reconnect automatically).</span>
        </div>
        <FormActions
          onBack={onCancel}
          saving={submitting}
          onConfirm={handleSetupHub}
          submitLabel={submitting ? 'Setting up…' : 'Set up bridge'}
        />
        {submitting && (
          <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Downloading and starting the {serviceLabel} bridge. First run can take a few minutes.
          </p>
        )}
      </div>
    );
  }

  if (step === 'hub-unavailable') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...CALLOUT, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          <Lock size={13} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            {serviceLabel} (personal account) isn&apos;t enabled on this server yet. Ask an
            administrator to set up the {serviceLabel} bridge in Settings → Channel Observers.
          </span>
        </div>
        <Button variant="outline" onClick={onCancel} className="w-full">Close</Button>
      </div>
    );
  }

  // ─── Disclaimer de riesgo (playbook §A.6) — ANTES de conectar ─────────────
  if (step === 'disclaimer' && config.disclaimer) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {config.disclaimer.body}
        </p>
        <div style={{ ...CALLOUT, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
          <ShieldAlert size={13} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{config.disclaimer.warning}</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.6875rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
          <Checkbox checked={riskAccepted} onCheckedChange={(v) => setRiskAccepted(v === true)} style={{ marginTop: 1 }} />
          <span>I understand and accept the risk of linking my personal {serviceLabel} account.</span>
        </label>
        <FormActions
          onBack={onCancel}
          saving={false}
          disabled={!riskAccepted}
          onConfirm={() => { /* el paso se re-deriva con riskAccepted=true */ setRiskAccepted(true); }}
          submitLabel="Continue"
        />
      </div>
    );
  }

  // ─── (B) Login: lo aporta el bridge ───────────────────────────────────────
  if (step === 'login' || step === 'awaiting-pair') {
    return <>{config.renderLogin({ login, submitting, send, checkLinked, bridgeMessage, onCancel }, step)}</>;
  }

  // ─── Vinculado → elegir chats ─────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...CALLOUT, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
        <Check size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>{login?.message ?? `Linked to ${serviceLabel}.`}</span>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        {config.readyBlurb}
      </p>
      <FormActions
        onBack={onCancel}
        saving={submitting}
        onConfirm={handleChooseChats}
        submitLabel="Choose chats"
      />
    </div>
  );
}
