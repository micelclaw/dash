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
 * SimpleX · identidad propia — perfil dedicado que vive en el servidor.
 *
 * NO son los chats de tu móvil (eso es SimplexXrcpForm). Es una identidad SEPARADA:
 * creas un perfil, compartes tu dirección para que te añadan, o pegas el enlace de
 * invitación de otra persona. Flujo:
 *   explain → deploy → profile → connect (dirección + auto-aceptar + pegar enlace) → ready
 */

import { useState, useEffect } from 'react';
import { Loader2, Check, Container, Copy, UserPlus, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ApiError } from '@/services/api';
import * as syncSvc from '@/services/sync.service';
import * as messagingCli from '@/services/messaging-cli.service';
import { QrImage } from '@/components/shared/QrImage';
import { QrScanButton } from '@/components/shared/QrScanButton';
import { Field, FormActions } from './shared';

type Step = 'explain' | 'deploy' | 'profile' | 'connect' | 'ready';

const CALLOUT: React.CSSProperties = {
  display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-md)',
  fontSize: '0.6875rem', lineHeight: 1.45, alignItems: 'flex-start',
};

export function SimplexOwnForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<Step>('explain');
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState<string | null>(null);
  const [autoAccept, setAutoAccept] = useState(true);
  const [link, setLink] = useState('');

  // ¿Ya corre el contenedor? (estado derivado del backend, sobrevive a F5).
  useEffect(() => {
    (async () => {
      try {
        const status = await messagingCli.getSimplexStatus();
        if (status.running && status.url) setApiUrl(status.url);
      } catch { /* servicio no disponible aún */ }
    })();
  }, []);

  async function handleDeploy() {
    setSubmitting(true);
    try {
      const status = await messagingCli.startSimplex();
      if (status.running && status.url) {
        setApiUrl(status.url);
        setStep('profile');
      } else {
        toast.error('SimpleX arrancó pero la API no está sana — reintenta.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo desplegar SimpleX');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveProfile() {
    setSubmitting(true);
    try {
      if (name.trim()) await messagingCli.setSimplexProfile(name.trim());
      const res = await messagingCli.getSimplexAddress();
      setAddress(res.address);
      setStep('connect');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el perfil');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConnectLink() {
    if (!link.trim()) return;
    setSubmitting(true);
    try {
      await messagingCli.connectSimplexLink(link.trim());
      toast.success('Conectando… aparecerá en tus contactos en unos segundos.');
      setLink('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo conectar con ese enlace');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleAutoAccept(v: boolean) {
    setAutoAccept(v);
    try { await messagingCli.setSimplexAutoAccept(v); } catch { /* best-effort */ }
  }

  async function handleFinish() {
    if (!apiUrl) return;
    setSubmitting(true);
    try {
      await syncSvc.createConnector({ connector_type: 'simplex-observer', config: { api_url: apiUrl } });
      onComplete();
    } catch (err) {
      // Un solo connector por usuario → 409 = "ya existe" → seguir al selector.
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
          Crea una identidad SimpleX <strong>nueva y separada</strong> que vive en tu servidor.
        </p>
        <div style={{ ...CALLOUT, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
          <Info size={13} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            <strong>NO son los chats de tu teléfono.</strong> Es una cuenta aparte. Para hablar con
            alguien: comparte tu dirección (para que te añadan) o pega su enlace de invitación.
            ¿Quieres tus chats reales del móvil? Usa la tarjeta «SimpleX · tu móvil».
          </span>
        </div>
        <FormActions
          onBack={onCancel}
          saving={false}
          onConfirm={() => setStep(apiUrl ? 'profile' : 'deploy')}
          submitLabel="Continuar"
        />
      </div>
    );
  }

  if (step === 'deploy') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          Preparando el servicio SimpleX en tu servidor (solo la primera vez).
        </p>
        <Button onClick={handleDeploy} disabled={submitting} className="w-full">
          {submitting
            ? <><Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} /> Desplegando…</>
            : <><Container size={14} style={{ marginRight: 6 }} /> Desplegar SimpleX</>}
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

  if (step === 'profile') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Nombre para mostrar" hint="Es como te verán tus contactos en SimpleX.">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Víctor (MicelclawOS)" />
        </Field>
        <FormActions onBack={onCancel} saving={submitting} onConfirm={handleSaveProfile} submitLabel="Continuar" />
      </div>
    );
  }

  if (step === 'connect') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Tu dirección SimpleX" hint="Compártela (o deja que escaneen el QR) para que te añadan.">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Input readOnly value={address ?? ''} placeholder="(sin dirección)"
              style={{ fontFamily: 'monospace', fontSize: '0.6875rem' }} />
            <Button variant="ghost" size="sm" disabled={!address}
              onClick={() => { if (address) { void navigator.clipboard.writeText(address); toast.success('Dirección copiada'); } }}>
              <Copy size={13} />
            </Button>
          </div>
        </Field>
        {address && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <QrImage value={address} size={160} />
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.6875rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
          <Checkbox checked={autoAccept} onCheckedChange={(v) => void toggleAutoAccept(v === true)} />
          <span>Aceptar automáticamente a quien me añada</span>
        </label>
        <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
        <Field label="¿Tienes el enlace de invitación de alguien?" hint="Pega su enlace simplex:/… o escanea su QR con la cámara.">
          <div style={{ display: 'flex', gap: 6 }}>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="simplex:/invitation#…"
              style={{ fontFamily: 'monospace', fontSize: '0.6875rem' }} />
            <QrScanButton onScan={(t) => setLink(t.trim())} title="Escanear el QR de invitación" />
            <Button variant="outline" size="sm" disabled={submitting || !link.trim()} onClick={handleConnectLink} title="Conectar con el enlace">
              <UserPlus size={13} />
            </Button>
          </div>
        </Field>
        <FormActions onBack={() => setStep('profile')} saving={submitting} onConfirm={() => setStep('ready')} submitLabel="Continuar" />
      </div>
    );
  }

  // ready
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...CALLOUT, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
        <Check size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>Perfil listo. Elige qué chats sincronizar.</span>
      </div>
      <FormActions onBack={() => setStep('connect')} saving={submitting} onConfirm={handleFinish} submitLabel="Elegir chats" />
    </div>
  );
}
