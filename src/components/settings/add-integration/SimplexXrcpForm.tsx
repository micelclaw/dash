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
 * SimpleX · tu móvil (XRCP) — usa la identidad del TELÉFONO (chats REALES).
 *
 * NO es el perfil dedicado (eso es SimplexOwnForm). Aquí MicelclawOS actúa como
 * "escritorio" del móvil vía el puente XRCP (sidecar). La primera página deja MUY
 * claro que SOLO funciona UNA de las dos a la vez (móvil O escritorio), que hace
 * falta la MISMA red local, y que el control se suelta solo tras X horas.
 * Flujo: explain → deploy(sidecar) → pair(QR + código de sesión) → ready → chats.
 */

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Loader2, Check, Container, Copy, ShieldAlert, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ApiError } from '@/services/api';
import * as syncSvc from '@/services/sync.service';
import * as messagingCli from '@/services/messaging-cli.service';
import { Field, FormActions } from './shared';

type Step = 'explain' | 'deploy' | 'pair' | 'ready';

const CALLOUT: React.CSSProperties = {
  display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-md)',
  fontSize: '0.6875rem', lineHeight: 1.45, alignItems: 'flex-start',
};

const AUTO_RELEASE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export function SimplexXrcpForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<Step>('explain');
  const [submitting, setSubmitting] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [autoReleaseHours, setAutoReleaseHours] = useState(4);
  const [running, setRunning] = useState(false);

  // Emparejamiento
  const [invitation, setInvitation] = useState<string | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [qrDataUri, setQrDataUri] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const [hostName, setHostName] = useState<string | null>(null);

  // ¿Ya corre el sidecar? (estado del backend, sobrevive a F5).
  useEffect(() => {
    (async () => {
      try {
        const status = await messagingCli.getSimplexXrcpStatus();
        if (status.running) setRunning(true);
      } catch { /* sidecar no disponible aún */ }
    })();
  }, []);

  // Render del QR a partir del enlace xrcp://… (lo escanea el móvil). La invitación
  // XRCP es LARGA (~650 chars) → QR muy denso: usar corrección de errores 'L' (menos
  // módulos, el móvil está cerca de la pantalla), tamaño grande y quiet-zone amplia
  // para que la cámara lo detecte.
  useEffect(() => {
    if (!invitation) { setQrDataUri(null); return; }
    QRCode.toDataURL(invitation, { errorCorrectionLevel: 'L', margin: 3, width: 320, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQrDataUri)
      .catch(() => setQrDataUri(null));
  }, [invitation]);

  // Poll del emparejamiento mientras se espera al móvil (solo en `pair`, sin
  // comando en vuelo). Solo APLICA el resultado si conectó (no clobbea el paso).
  useEffect(() => {
    if (step !== 'pair' || submitting || paired) return;
    const t = setInterval(async () => {
      try {
        const st = await messagingCli.pairStatusSimplexXrcp();
        if (st.pairing?.session_code && !sessionCode) setSessionCode(st.pairing.session_code);
        // El emparejamiento se considera COMPLETO en cuanto el escritorio persiste el host
        // (`paired`, del evento newRemoteHost) o conoce su nombre (`host_name`) o hay sesión
        // viva (`connected`). La sesión XRCP puede caerse tras emparejar (modelo por-toma: se
        // «toma el control» al sincronizar), así que NO exigimos `connected` sostenido — el
        // sidecar resetea paired/host_name en cada pair_start, así que no hay falso positivo.
        if (st.paired || st.connected || st.host_name) {
          if (st.host_name) setHostName(st.host_name);
          setPaired(true);
        }
      } catch { /* sidecar aún arrancando */ }
    }, 5_000);
    return () => clearInterval(t);
  }, [step, submitting, paired, sessionCode]);

  async function handleDeploy() {
    setSubmitting(true);
    try {
      const status = await messagingCli.startSimplexXrcp();
      if (!status.running) {
        toast.error('El puente XRCP arrancó pero no está sano — reintenta.');
        return;
      }
      setRunning(true);
      // SIEMPRE emparejamiento fresco con QR + verificación del código. NUNCA auto-conectar
      // desde un emparejamiento guardado (eso sería el fallo de seguridad: mostrar el móvil
      // como conectado sin re-escanear/re-verificar). Conectar = re-escanear + verificar en
      // el móvil, cada vez.
      await startPairing();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo desplegar el puente XRCP');
    } finally {
      setSubmitting(false);
    }
  }

  async function startPairing() {
    setSubmitting(true);
    try {
      const res = await messagingCli.pairStartSimplexXrcp();
      setInvitation(res.invitation);
      setSessionCode(res.session_code);
      setPaired(false);
      setHostName(null);
      setStep('pair');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo iniciar el emparejamiento');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinish() {
    setSubmitting(true);
    try {
      await syncSvc.createConnector({
        connector_type: 'simplex-remote-observer',
        display_name: 'SimpleX (tu móvil)',
        config: { auto_release_hours: autoReleaseHours },
      });
      onComplete();
    } catch (err) {
      // Un solo connector XRCP por usuario → 409 = "ya existe" → al selector.
      if (err instanceof ApiError && err.status === 409) { onComplete(); return; }
      toast.error(err instanceof Error ? err.message : 'No se pudo crear el canal');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render por paso ───────────────────────────────────────────────

  if (step === 'explain') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          Ves y respondes tus chats <strong>REALES</strong> de SimpleX del teléfono, desde MicelclawOS.
        </p>
        <div style={{ ...CALLOUT, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
          <ShieldAlert size={13} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            <strong>Solo funciona UNA de las dos a la vez:</strong> mientras MicelclawOS controla,
            tu SimpleX del móvil queda «en uso» y no lo puedes usar.
            <br />• Requiere la <strong>MISMA red local</strong>.
            <br />• Abre <strong>«Usar desde escritorio»</strong> en el móvil para cada sincronización.
            <br />• El control se <strong>suelta solo</strong> tras las horas que configures.
          </span>
        </div>
        <Field label="Auto-soltar el control tras" hint="Pasado ese tiempo, tu móvil vuelve a quedar libre (1–8 h).">
          <select
            value={autoReleaseHours}
            onChange={(e) => setAutoReleaseHours(Number(e.target.value))}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-md)',
              background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
              fontFamily: 'var(--font-sans)', fontSize: '0.75rem',
            }}
          >
            {AUTO_RELEASE_OPTIONS.map((h) => (
              <option key={h} value={h}>{h} {h === 1 ? 'hora' : 'horas'}</option>
            ))}
          </select>
        </Field>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.6875rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
          <Checkbox checked={understood} onCheckedChange={(v) => setUnderstood(v === true)} style={{ marginTop: 1 }} />
          <span>Entiendo cómo funciona el control compartido.</span>
        </label>
        <FormActions
          onBack={onCancel}
          saving={false}
          disabled={!understood}
          onConfirm={() => (running ? void startPairing() : setStep('deploy'))}
          submitLabel="Continuar"
        />
      </div>
    );
  }

  if (step === 'deploy') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          Preparando el puente de control SimpleX en tu servidor (solo la primera vez).
        </p>
        <Button onClick={handleDeploy} disabled={submitting} className="w-full">
          {submitting
            ? <><Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} /> Iniciando…</>
            : <><Container size={14} style={{ marginRight: 6 }} /> Iniciar el puente</>}
        </Button>
        {submitting && (
          <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Construyendo e iniciando el contenedor… puede tardar un minuto la primera vez.
          </p>
        )}
        <Button variant="outline" onClick={onCancel} className="w-full">Cancelar</Button>
      </div>
    );
  }

  if (step === 'pair') {
    if (paired) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...CALLOUT, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
            <Check size={13} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>Emparejado con <strong>{hostName ?? 'tu móvil'}</strong>.</span>
          </div>
          <div style={{ ...CALLOUT, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
            <Smartphone size={13} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>Para ver tus chats, el ordenador debe <strong>tomar el control</strong> del móvil. Abre ahora en el teléfono <strong>SimpleX → «Usar desde escritorio»</strong> (misma WiFi) y luego pulsa «Elegir chats» — tardará unos segundos en conectar.</span>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => { setPaired(false); setHostName(null); void startPairing(); }}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer', alignSelf: 'flex-start', padding: 0 }}
          >
            ¿No es tu móvil o falla la sincronización? Volver a emparejar
          </button>
          <FormActions onBack={onCancel} saving={submitting} onConfirm={handleFinish} submitLabel="Elegir chats" />
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          En el móvil: <strong>SimpleX → Ajustes → «Usar desde escritorio» → Escanear código</strong>.
        </p>
        {/* QR GRANDE: la invitación XRCP es densa → cuanto más grande en pantalla,
            más fácil de escanear. `image-rendering: pixelated` evita que el navegador
            emborrone los módulos al escalar. */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {qrDataUri
            ? <img src={qrDataUri} alt="SimpleX XRCP QR" style={{ width: '100%', maxWidth: 300, aspectRatio: '1', borderRadius: 8, background: '#fff', padding: 10, imageRendering: 'pixelated' }} />
            : <div style={{ width: '100%', maxWidth: 300, aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
              </div>}
        </div>
        {sessionCode && (
          <Field label="Verifica que estos 4 grupos coinciden con los del móvil">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.9375rem', letterSpacing: '0.08em', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', wordBreak: 'break-all' }}>
                {/* El móvil muestra solo los primeros 23 caracteres (4 grupos de 5 dígitos);
                    el protocolo compara el código completo, el resto es truncado de UI. Mostramos
                    exactamente esos 23 chars para que coincida visualmente con el teléfono. */}
                {sessionCode.slice(0, 23)}
              </div>
              <Button variant="ghost" size="sm" onClick={() => { void navigator.clipboard.writeText(sessionCode.slice(0, 23)); toast.success('Código copiado'); }}>
                <Copy size={13} />
              </Button>
            </div>
          </Field>
        )}
        <div style={{ ...CALLOUT, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
          <Smartphone size={13} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>Esperando a que conectes en el móvil… esta pantalla se comprueba sola cada pocos segundos. El móvil debe estar en la <strong>misma WiFi</strong> y <strong>sin VPN activa</strong> (una VPN que bloquee la red local corta la conexión).</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" className="flex-1" disabled={submitting} onClick={() => void startPairing()}>
            Nuevo QR
          </Button>
          <Button variant="outline" className="flex-1" disabled={submitting} onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // ready (no se usa directamente — el paso `pair` con paired hace de "ready")
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <FormActions onBack={() => setStep('pair')} saving={submitting} onConfirm={handleFinish} submitLabel="Elegir chats" />
    </div>
  );
}
