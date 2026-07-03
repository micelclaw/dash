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

import { useState, useEffect } from 'react';
import { Loader2, Check, Container } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as syncSvc from '@/services/sync.service';
import * as messagingCli from '@/services/messaging-cli.service';
import { FormActions } from './shared';

// ─── SimpleX Chat Form ──────────────────────────────────
// Flow: Deploy simplex-chat → Configure API URL → Connect

type SimplexStep = 'deploy' | 'ready';

export function SimplexForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<SimplexStep>('deploy');
  const [apiUrl, setApiUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<'idle' | 'deploying' | 'ready' | 'error'>('idle');

  // Check if simplex-chat is already running on mount
  useEffect(() => {
    (async () => {
      try {
        const status = await messagingCli.getSimplexStatus();
        if (status.running && status.url) {
          setApiUrl(status.url);
          setDeployStatus('ready');
          setStep('ready');
        }
      } catch {
        // API not available
      }
    })();
  }, []);

  async function handleDeploy() {
    setDeploying(true);
    setDeployStatus('deploying');
    try {
      const status = await messagingCli.startSimplex();
      if (status.running && status.url) {
        setApiUrl(status.url);
        setDeployStatus('ready');
        toast.success('SimpleX Chat is running');
        setStep('ready');
      } else {
        setDeployStatus('error');
        toast.error('SimpleX Chat started but API not healthy');
      }
    } catch (err: any) {
      setDeployStatus('error');
      toast.error(err?.message || 'Failed to deploy SimpleX Chat');
    } finally {
      setDeploying(false);
    }
  }

  async function handleConnect() {
    if (!apiUrl) return;
    setSaving(true);
    try {
      await syncSvc.createConnector({
        connector_type: 'simplex-observer',
        config: { api_url: apiUrl },
      });
      onComplete();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect SimpleX');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Step indicators */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {(['deploy', 'ready'] as SimplexStep[]).map((s, i) => (
          <div key={s} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= ['deploy', 'ready'].indexOf(step)
              ? '#3DB548' : 'var(--border)',
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
              background: 'rgba(61, 181, 72, 0.08)',
              border: '1px solid rgba(61, 181, 72, 0.2)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 8 }}>
                SimpleX requires a <strong>simplex-chat</strong> service. Deploy it automatically:
              </div>
              <button
                type="button"
                onClick={handleDeploy}
                disabled={deploying}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  width: '100%', padding: '8px 12px',
                  background: deploying ? 'var(--surface)' : 'rgba(61, 181, 72, 0.15)',
                  border: '1px solid rgba(61, 181, 72, 0.3)',
                  borderRadius: 'var(--radius-sm)', color: '#3DB548',
                  cursor: deploying ? 'default' : 'pointer',
                  fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                  fontWeight: 500, justifyContent: 'center',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {deploying ? (
                  <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Deploying SimpleX Chat...</>
                ) : deployStatus === 'error' ? (
                  <><Container size={14} /> Retry deploy</>
                ) : (
                  <><Container size={14} /> Deploy SimpleX Chat</>
                )}
              </button>
              {deploying && (
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  Pulling image and starting container... this may take a minute.
                </div>
              )}
              {deployStatus === 'error' && (
                <div style={{ fontSize: '0.6875rem', color: 'var(--error)', marginTop: 6 }}>
                  Deployment failed. You can retry or enter a custom URL below.
                </div>
              )}
            </div>
          )}

          {/* Manual URL input */}
          {!deploying && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', margin: '4px 0' }}>
              or enter a custom WebSocket API URL:
            </div>
          )}
          {!deploying && (
            <>
              <Input
                type="url"
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
                placeholder="ws://localhost:5225"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => { if (apiUrl) { setDeployStatus('ready'); setStep('ready'); } }}
                disabled={!apiUrl}
              >
                Use this URL
              </Button>
            </>
          )}
        </>
      )}

      {/* ─── STEP 2: Ready to connect ────────────────── */}
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
            SimpleX Chat running at {apiUrl}
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            SimpleX Chat is running and ready. Click Connect to start observing messages.
          </div>

          <FormActions onBack={onCancel} saving={saving} onConfirm={handleConnect} />
        </>
      )}
    </div>
  );
}
