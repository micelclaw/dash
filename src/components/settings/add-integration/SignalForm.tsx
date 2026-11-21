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

import { useState, useEffect, useRef } from 'react';
import { Loader2, Check, Container } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as syncSvc from '@/services/sync.service';
import * as messagingCli from '@/services/messaging-cli.service';
import { Field, FormActions } from './shared';
import { useI18n } from '@/i18n';

// ─── Signal REST API Form ───────────────────────────────
// Flow: Deploy signal-cli → Enter phone → Link via QR code → Connect

type SignalStep = 'deploy' | 'phone' | 'linking' | 'ready';

export function SignalForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const [step, setStep] = useState<SignalStep>('deploy');
  const [apiUrl, setApiUrl] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<'idle' | 'deploying' | 'ready' | 'error'>('idle');
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if signal-cli is already running on mount
  useEffect(() => {
    (async () => {
      try {
        const status = await messagingCli.getSignalStatus();
        if (status.running && status.url) {
          setApiUrl(status.url);
          setDeployStatus('ready');
          // Check if already linked
          const accs = await messagingCli.listSignalAccounts();
          if (accs.length > 0) {
            setPhoneNumber(accs[0] ?? '');
            setStep('ready');
          } else {
            setStep('phone');
          }
        }
      } catch {
        // API not available
      }
    })();
    return () => { if (linkPollRef.current) clearInterval(linkPollRef.current); };
  }, []);

  async function handleDeploy() {
    setDeploying(true);
    setDeployStatus('deploying');
    try {
      const status = await messagingCli.startSignal();
      if (status.running && status.url) {
        setApiUrl(status.url);
        setDeployStatus('ready');
        toast.success(t('settings.signal.apiRunning'));
        setStep('phone');
      } else {
        setDeployStatus('error');
        toast.error(t('settings.signal.apiUnhealthy'));
      }
    } catch (err: any) {
      setDeployStatus('error');
      toast.error(err?.message || tRef.current('settings.signal.deployFailed'));
    } finally {
      setDeploying(false);
    }
  }

  async function handleStartLink() {
    if (!phoneNumber) return;
    setLinkLoading(true);
    setLinkError(null);
    setQrImage(null);
    try {
      const linkResult = await messagingCli.linkSignal();
      setQrImage(linkResult.qr_uri);
      setStep('linking');
      // Poll for link completion every 5 seconds (don't hammer signal-cli during linking)
      linkPollRef.current = setInterval(async () => {
        try {
          const check = await messagingCli.checkSignalLink(phoneNumber);
          if (check.linked) {
            if (linkPollRef.current) clearInterval(linkPollRef.current);
            setStep('ready');
            toast.success(t('settings.signal.accountLinked'));
          }
        } catch {
          // polling error — ignore
        }
      }, 5000);
    } catch (err: any) {
      setLinkError(err?.message || tRef.current('settings.signal.startLinkFailed'));
      toast.error(tRef.current('settings.signal.startLinkFailed'));
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleConnect() {
    if (!apiUrl || !phoneNumber) return;
    setSaving(true);
    try {
      await syncSvc.createConnector({
        connector_type: 'signal-observer',
        config: { api_url: apiUrl, phone_number: phoneNumber },
      });
      onComplete();
    } catch (err: any) {
      toast.error(err?.message || tRef.current('settings.signal.connectFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Step indicators */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {(['deploy', 'phone', 'linking', 'ready'] as SignalStep[]).map((s, i) => (
          <div key={s} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= ['deploy', 'phone', 'linking', 'ready'].indexOf(step)
              ? '#3a76f0' : 'var(--border)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* ─── STEP 1: Deploy ──────────────────────────── */}
      {step === 'deploy' && (
        <>
          {deployStatus !== 'ready' && (
            <div style={{
              padding: '10px 12px',
              background: 'rgba(58, 118, 240, 0.08)',
              border: '1px solid rgba(58, 118, 240, 0.2)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 8 }}>
                {t('settings.signal.requirement')}
              </div>
              <button
                type="button"
                onClick={handleDeploy}
                disabled={deploying}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  width: '100%', padding: '8px 12px',
                  background: deploying ? 'var(--surface)' : 'rgba(58, 118, 240, 0.15)',
                  border: '1px solid rgba(58, 118, 240, 0.3)',
                  borderRadius: 'var(--radius-sm)', color: '#3a76f0',
                  cursor: deploying ? 'default' : 'pointer',
                  fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                  fontWeight: 500, justifyContent: 'center',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {deploying ? (
                  <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> {t('settings.signal.deploying')}</>
                ) : deployStatus === 'error' ? (
                  <><Container size={14} /> {t('settings.signal.retryDeploy')}</>
                ) : (
                  <><Container size={14} /> {t('settings.signal.deployApi')}</>
                )}
              </button>
              {deploying && (
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  {t('settings.signal.startingContainer')}
                </div>
              )}
              {deployStatus === 'error' && (
                <div style={{ fontSize: '0.6875rem', color: 'var(--error)', marginTop: 6 }}>
                  {t('settings.signal.deployError')}
                </div>
              )}
            </div>
          )}

          {/* Manual URL input */}
          {!deploying && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', margin: '4px 0' }}>
              {t('settings.signal.customUrl')}
            </div>
          )}
          {!deploying && (
            <>
              <Input
                type="url"
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
                aria-label={t('settings.signal.customUrl')}
                placeholder="http://localhost:8282"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => { if (apiUrl) { setDeployStatus('ready'); setStep('phone'); } }}
                disabled={!apiUrl}
              >
                {t('settings.signal.useUrl')}
              </Button>
            </>
          )}
        </>
      )}

      {/* ─── STEP 2: Phone number ────────────────────── */}
      {step === 'phone' && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px',
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem', color: '#22c55e',
          }}>
            <Check size={14} />
            {t('settings.signal.apiRunning')}: {apiUrl}
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            {t('settings.signal.enterPhone')}
          </div>

          <Field label={t('settings.signal.phoneLabel')} hint={t('settings.signal.phoneHint')}>
            <Input
              type="tel"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              placeholder="+34612345678"
            />
          </Field>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Button type="button" variant="outline" onClick={() => setStep('deploy')} className="flex-1 text-[var(--text-dim)]">
              {t('settings.signal.back')}
            </Button>
            <button
              type="button"
              onClick={handleStartLink}
              disabled={!phoneNumber || linkLoading}
              style={{
                flex: 1, padding: '8px 12px',
                background: '#3a76f0', border: 'none',
                borderRadius: 'var(--radius-md)', color: '#fff',
                cursor: !phoneNumber || linkLoading ? 'default' : 'pointer',
                fontWeight: 600, fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                opacity: !phoneNumber || linkLoading ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {linkLoading ? (
                <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> {t('settings.signal.generatingQr')}</>
              ) : (
                t('settings.signal.linkAccount')
              )}
            </button>
          </div>

          {linkError && (
            <div style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{linkError}</div>
          )}
        </>
      )}

      {/* ─── STEP 3: QR Code Linking ─────────────────── */}
      {step === 'linking' && (
        <>
          <div style={{
            textAlign: 'center', padding: '8px 0',
            fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.6,
          }}>
            {t('settings.signal.scanQr')}
            <br />
            <strong style={{ color: 'var(--text)' }}>Signal → Settings → Linked Devices → +</strong>
          </div>

          {qrImage && (
            <div style={{
              display: 'flex', justifyContent: 'center', padding: '12px 0',
            }}>
              <div style={{
                background: '#fff', borderRadius: 8, padding: 12,
                boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
              }}>
                <img
                  src={qrImage}
                  alt={t('settings.signal.qrAlt')}
                  style={{ width: 200, height: 200, imageRendering: 'pixelated' }}
                />
              </div>
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '8px 0', fontSize: '0.8125rem', color: 'var(--text-muted)',
          }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            {t('settings.signal.waitingScan')}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-center text-[var(--text-dim)]"
            onClick={() => {
              if (linkPollRef.current) clearInterval(linkPollRef.current);
              setQrImage(null);
              setStep('phone');
            }}
          >
            {t('settings.signal.cancel')}
          </Button>
        </>
      )}

      {/* ─── STEP 4: Ready to connect ────────────────── */}
      {step === 'ready' && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px',
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem', color: '#22c55e',
          }}>
            <Check size={14} />
            {t('settings.signal.linkedPhone', { phone: phoneNumber })}
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            {t('settings.signal.ready')}
          </div>

          <FormActions onBack={onCancel} saving={saving} onConfirm={handleConnect} />
        </>
      )}
    </div>
  );
}
