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

import { useState, useEffect, useRef } from 'react';
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
import { useI18n } from '@/i18n';

type Step = 'explain' | 'deploy' | 'profile' | 'connect' | 'ready';

const CALLOUT: React.CSSProperties = {
  display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-md)',
  fontSize: '0.6875rem', lineHeight: 1.45, alignItems: 'flex-start',
};

export function SimplexOwnForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
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
        toast.error(t('settings.forms.connectionFailed'));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tRef.current('settings.simplexOwn.deployFailed'));
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
      toast.error(err instanceof Error ? err.message : tRef.current('settings.simplexOwn.profileFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConnectLink() {
    if (!link.trim()) return;
    setSubmitting(true);
    try {
      await messagingCli.connectSimplexLink(link.trim());
      toast.success(t('settings.simplexOwn.connecting'));
      setLink('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tRef.current('settings.simplexOwn.linkFailed'));
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
      toast.error(err instanceof Error ? err.message : tRef.current('settings.matrix.createChannelFailed', { service: 'SimpleX' }));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render por paso ───────────────────────────────────────────────

  if (step === 'explain') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('settings.simplexOwn.explain')}
        </p>
        <div style={{ ...CALLOUT, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
          <Info size={13} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            {t('settings.simplexOwn.warning')}
          </span>
        </div>
        <FormActions
          onBack={onCancel}
          saving={false}
          onConfirm={() => setStep(apiUrl ? 'profile' : 'deploy')}
          submitLabel={t('settings.matrix.continue')}
        />
      </div>
    );
  }

  if (step === 'deploy') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('settings.simplexOwn.prepare')}
        </p>
        <Button onClick={handleDeploy} disabled={submitting} className="w-full">
          {submitting
            ? <><Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} /> {t('settings.simplexOwn.deploying')}</>
            : <><Container size={14} style={{ marginRight: 6 }} /> {t('settings.simplexOwn.deploy')}</>}
        </Button>
        {submitting && (
          <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            {t('settings.simplexOwn.startingContainer')}
          </p>
        )}
        <Button variant="outline" onClick={onCancel} className="w-full">{t('settings.matrix.close')}</Button>
      </div>
    );
  }

  if (step === 'profile') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label={t('settings.simplexOwn.displayName')} hint={t('settings.simplexOwn.displayNameHint')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Víctor (MicelclawOS)" />
        </Field>
        <FormActions onBack={onCancel} saving={submitting} onConfirm={handleSaveProfile} submitLabel={t('settings.matrix.continue')} />
      </div>
    );
  }

  if (step === 'connect') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label={t('settings.simplexOwn.address')} hint={t('settings.simplexOwn.addressHint')}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Input readOnly aria-label={t('settings.simplexOwn.address')} value={address ?? ''} placeholder={t('settings.simplexOwn.noAddress')}
              style={{ fontFamily: 'monospace', fontSize: '0.6875rem' }} />
            <Button variant="ghost" size="sm" aria-label={t('settings.simplexOwn.copyAddress')} disabled={!address}
              onClick={() => { if (address) { void navigator.clipboard.writeText(address); toast.success(t('settings.simplexOwn.addressCopied')); } }}>
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
          <span>{t('settings.simplexOwn.autoAccept')}</span>
        </label>
        <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
        <Field label={t('settings.simplexOwn.invitationQuestion')} hint={t('settings.simplexOwn.invitationHint')}>
          <div style={{ display: 'flex', gap: 6 }}>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="simplex:/invitation#…"
              style={{ fontFamily: 'monospace', fontSize: '0.6875rem' }} />
            <QrScanButton onScan={(t) => setLink(t.trim())} title={t('settings.simplexOwn.scanInvite')} />
            <Button variant="outline" size="sm" aria-label={t('settings.simplexOwn.connectLink')} disabled={submitting || !link.trim()} onClick={handleConnectLink} title={t('settings.simplexOwn.connectLink')}>
              <UserPlus size={13} />
            </Button>
          </div>
        </Field>
        <FormActions onBack={() => setStep('profile')} saving={submitting} onConfirm={() => setStep('ready')} submitLabel={t('settings.matrix.continue')} />
      </div>
    );
  }

  // ready
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...CALLOUT, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
        <Check size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>{t('settings.simplexOwn.profileReady')}</span>
      </div>
      <FormActions onBack={() => setStep('connect')} saving={submitting} onConfirm={handleFinish} submitLabel={t('settings.simplexOwn.chooseChats')} />
    </div>
  );
}
