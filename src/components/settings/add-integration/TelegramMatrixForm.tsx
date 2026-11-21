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
 * Telegram con tu CUENTA REAL (no un bot) — vía el hub Matrix.
 *
 * Dos niveles:
 *  (A) Setup de instancia (admin, una vez): credencial de app de my.telegram.org
 *      + levantar Synapse y el bridge. Si ya está listo, este paso NO se ve.
 *  (B) Login per-usuario: teléfono → código → 2FA opcional.
 *
 * REGLAS DEL PROYECTO aplicadas aquí:
 *  - El paso actual se DERIVA del backend (`GET /sync/matrix/status` + el `state`
 *    que devuelve el bridge), nunca de un `useState('connecting')`. Un F5 a mitad
 *    del login restaura el paso exacto porque el estado real vive en el bridge.
 *  - Los únicos useState son los valores de los inputs + un `submitting` transitorio.
 *  - El mensaje LITERAL del bridge se muestra siempre (incluido `state:'unknown'`):
 *    si un release cambia un texto, el usuario ve qué pasó en vez de un fallo mudo.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Check, ExternalLink, ShieldAlert, Info, Lock, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth.store';
import { ApiError } from '@/services/api';
import * as hub from '@/services/matrix-hub.service';
import * as syncSvc from '@/services/sync.service';
import { Field, FormActions } from './shared';
import { useI18n } from '@/i18n';

/** Paso DERIVADO — no hay setStep para el estado "largo". */
type Step = 'loading' | 'hub-setup' | 'hub-unavailable' | 'login-phone' | 'login-code' | 'login-2fa' | 'ready';

function deriveStep(
  status: hub.MatrixHubStatus | null,
  login: hub.LoginResult | null,
  isAdmin: boolean,
): Step {
  if (!status) return 'loading';
  if (!status.ready_for_login) return isAdmin ? 'hub-setup' : 'hub-unavailable';
  // Con el hub listo pero SIN respuesta aún del bridge no sabemos si hay sesión:
  // seguir en "comprobando". Si no, a quien YA está vinculado se le enseñaba un
  // instante "escribe tu teléfono" antes de corregirse — confuso y falso.
  if (!login) return 'loading';
  switch (login.state) {
    case 'awaiting_code': return 'login-code';
    case 'awaiting_password': return 'login-2fa';
    case 'done': return 'ready';
    default: return 'login-phone';
  }
}

const CALLOUT: React.CSSProperties = {
  display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-md)',
  fontSize: '0.6875rem', lineHeight: 1.45, alignItems: 'flex-start',
};

export function TelegramMatrixForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin' || role === 'owner';

  // Estado del BACKEND (la verdad).
  const [status, setStatus] = useState<hub.MatrixHubStatus | null>(null);
  const [login, setLogin] = useState<hub.LoginResult | null>(null);

  // Solo valores de input + un submitting transitorio.
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await hub.getMatrixHubStatus();
      setStatus(s);
      if (s.ready_for_login) {
        // El bridge sabe si ya hay sesión → el paso se restaura tras un F5.
        try {
          setLogin(await hub.advanceLogin('status'));
        } catch (err) {
          // Si el bridge no contesta NO nos quedamos en el spinner (deriveStep
          // espera a `login`): se marca 'unknown' → el wizard deja intentar el
          // login y enseña el motivo, en vez de girar para siempre.
          setLogin({
            state: 'unknown',
            message: err instanceof Error ? err.message : tRef.current('settings.matrix.bridgeDidNotAnswer', { service: 'Telegram' }),
            hint: null,
          });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tRef.current('settings.telegram.readStatusFailed'));
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const step = deriveStep(status, login, isAdmin);

  async function handleSetupHub() {
    setSubmitting(true);
    try {
      if (!status?.telegram_app_configured || apiId || apiHash) {
        if (!apiId.trim() || !apiHash.trim()) {
          toast.error(t('settings.telegram.needApiKeys'));
          return;
        }
        await hub.saveTelegramApp(apiId.trim(), apiHash.trim());
      }
      toast.info(t('settings.matrix.settingUp', { service: 'Telegram' }));
      await hub.startMatrixHub();
      setApiHash('');
      await refresh();
      toast.success(t('settings.matrix.running', { service: 'Telegram' }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.matrix.setupFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function send(step: hub.LoginStep, value?: string) {
    setSubmitting(true);
    try {
      const r = await hub.advanceLogin(step, value);
      setLogin(r);
      if (r.state === 'error') toast.error(r.hint ?? r.message);
      else if (r.state === 'unknown') toast.warning(t('settings.matrix.unexpectedReply'));
      return r;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.matrix.bridgeDidNotRespond', { service: 'Telegram' }));
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  /** Tras el login: crear el observer y saltar al selector de chats. */
  async function handleChooseChats() {
    setSubmitting(true);
    try {
      await syncSvc.createConnector({
        connector_type: 'gateway-observer',
        display_name: 'Telegram',
        config: { channel_type: 'matrix', account_id: 'default', agent_mode: 'observe' },
      });
      onComplete();
    } catch (err) {
      // El connector del hub Matrix es COMPARTIDO (WhatsApp pudo crearlo antes):
      // el 409 significa "ya existe" → seguir al selector de chats con normalidad.
      if (err instanceof ApiError && err.status === 409) {
        onComplete();
        return;
      }
      toast.error(err instanceof Error ? err.message : t('settings.matrix.createChannelFailed', { service: 'Telegram' }));
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

  // "Nunca un spinner ciego": comprobar el hub tarda ~2 s (inspección de Docker),
  // así que el spinner DICE qué está haciendo en vez de girar sin explicación.
  if (step === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 32 }}>
        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>
          {t('settings.matrix.checkingBridge', { service: 'Telegram' })}
        </p>
      </div>
    );
  }

  // ─── (A) Instancia — solo admin, solo si el hub no está listo ──────────────
  if (step === 'hub-setup') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('settings.telegram.setup')}
        </p>

        {status?.telegram_app_configured && (
          <div style={{ ...CALLOUT, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
            <Check size={13} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>{t('settings.telegram.credentialsSaved')}</span>
          </div>
        )}

        <Field
          label={t('settings.telegram.apiId')}
          hint={t('settings.telegram.apiIdHint')}
        >
          <Input
            value={apiId}
            onChange={(e) => setApiId(e.target.value)}
            placeholder={status?.telegram_app_configured ? t('settings.telegram.savedKeep') : t('settings.telegram.exampleId')}
            inputMode="numeric"
          />
        </Field>

        <a
          href="https://my.telegram.org"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem',
            color: 'var(--amber)', textDecoration: 'none', marginTop: -6,
          }}
        >
          {t('settings.telegram.openApi')} <ExternalLink size={11} />
        </a>

        <Field label={t('settings.telegram.apiHash')} hint={t('settings.telegram.apiHashHint')}>
          <Input
            type="password"
            value={apiHash}
            onChange={(e) => setApiHash(e.target.value)}
            placeholder={status?.telegram_app_configured ? t('settings.telegram.savedKeep') : t('settings.telegram.hashPlaceholder')}
          />
        </Field>

        <div style={{ ...CALLOUT, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
          <ShieldAlert size={13} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            {t('settings.telegram.hashWarning')}
          </span>
        </div>

        <FormActions
          onBack={onCancel}
          saving={submitting}
          onConfirm={handleSetupHub}
          submitLabel={submitting ? t('settings.matrix.settingUpLabel') : t('settings.matrix.setUpBridge')}
        />
        {submitting && (
          <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            {t('settings.telegram.downloadSetup')}
          </p>
        )}
      </div>
    );
  }

  // ─── Hub apagado y no eres admin ──────────────────────────────────────────
  if (step === 'hub-unavailable') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...CALLOUT, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          <Lock size={13} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            {t('settings.telegram.unavailable')}
          </span>
        </div>
        <Button variant="outline" onClick={onCancel} className="w-full">{t('settings.telegram.close')}</Button>
      </div>
    );
  }

  // ─── (B) Login per-usuario ────────────────────────────────────────────────
  if (step === 'login-phone') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('settings.telegram.loginIntro')}
        </p>
        {bridgeMessage}
        <Field
          label={t('settings.whatsapp.phone')}
          hint={t('settings.telegram.phoneHint')}
        >
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 123 456" inputMode="tel" />
        </Field>
        <FormActions
          onBack={onCancel}
          saving={submitting}
          disabled={!phone.trim()}
          onConfirm={async () => {
            // `start` arma el flujo en el bridge; luego va el teléfono.
            const started = await send('start');
            if (started && started.state === 'awaiting_phone') await send('phone', phone.trim());
          }}
          submitLabel={t('settings.telegram.sendCode')}
        />
        <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {t('settings.telegram.codeNotice')}
        </p>
      </div>
    );
  }

  if (step === 'login-code') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('settings.telegram.enterCode')}
        </p>
        <div style={{ ...CALLOUT, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
          <Info size={13} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            {t('settings.telegram.checkApp')}
          </span>
        </div>
        {bridgeMessage}
        <Field label={t('settings.telegram.loginCode')} hint={t('settings.telegram.loginCodeHint')}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="1 2 3 4 5" inputMode="numeric" />
        </Field>
        <FormActions
          onBack={() => void send('cancel')}
          saving={submitting}
          disabled={!code.trim()}
          onConfirm={() => void send('code', code.trim())}
          submitLabel={t('settings.telegram.verify')}
        />
      </div>
    );
  }

  if (step === 'login-2fa') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('settings.telegram.twoStep')}
        </p>
        {bridgeMessage}
        <Field
          label={t('settings.telegram.twoStepPassword')}
          hint={t('settings.telegram.passwordHint')}
        >
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('settings.telegram.passwordPlaceholder')} />
        </Field>
        <FormActions
          onBack={() => void send('cancel')}
          saving={submitting}
          disabled={!password.trim()}
          onConfirm={async () => { await send('password', password); setPassword(''); }}
          submitLabel={t('settings.telegram.logIn')}
        />
      </div>
    );
  }

  // ─── Logueado → elegir chats ──────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...CALLOUT, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
        <Check size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>{login?.message ?? t('settings.telegram.loggedIn')}</span>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        {t('settings.telegram.ready')}
      </p>
      <FormActions
        onBack={onCancel}
        saving={submitting}
        onConfirm={handleChooseChats}
        submitLabel={t('settings.telegram.chooseChats')}
      />
    </div>
  );
}
