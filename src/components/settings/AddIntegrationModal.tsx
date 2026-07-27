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

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import * as syncSvc from '@/services/sync.service';
import { DavForm } from './DavForm';
import { ImapForm } from './ImapForm';
import { SERVICES, CATEGORIES, CATEGORY_ICONS, ServiceIcon, type ServiceDef } from './add-integration/services';
import { DiscordBotForm } from './add-integration/DiscordBotForm';
import { SignalForm } from './add-integration/SignalForm';
import { TelegramMatrixForm } from './add-integration/TelegramMatrixForm';
import { WhatsAppMatrixForm } from './add-integration/WhatsAppMatrixForm';
import { SimplexOwnForm } from './add-integration/SimplexOwnForm';
import { SimplexXrcpForm } from './add-integration/SimplexXrcpForm';
import { SessionForm } from './add-integration/SessionForm';
import { DiscoverForm } from './add-integration/DiscoverForm';

interface AddIntegrationModalProps {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
  prefilterService?: string;
}

export function AddIntegrationModal({ open, onClose, onConnected, prefilterService }: AddIntegrationModalProps) {
  const [step, setStep] = useState<'pick' | 'oauth-pending' | 'form'>('pick');
  const [selectedService, setSelectedService] = useState<ServiceDef | null>(null);

  // Reset state when modal opens — auto-select if prefiltered
  useEffect(() => {
    if (open) {
      if (prefilterService) {
        const svc = SERVICES.find(s => s.id === prefilterService);
        if (svc) {
          setSelectedService(svc);
          setStep(svc.flow === 'oauth' ? 'pick' : 'form');
        }
      } else {
        setStep('pick');
        setSelectedService(null);
      }
    }
  }, [open, prefilterService]);

  // Listen for OAuth callback from popup — do the token exchange here (we have the session)
  useEffect(() => {
    if (step !== 'oauth-pending') return;

    const handler = async (event: MessageEvent) => {
      if (event.data?.type === 'oauth_callback') {
        // Exchange code for tokens via our authenticated API
        try {
          await syncSvc.oauthCallback({
            provider: event.data.provider,
            code: event.data.code,
            state: event.data.state,
          });
          localStorage.removeItem('claw_oauth_pending');
          setStep('pick');
          toast.success(`${selectedService?.name ?? 'Service'} connected`);
          onConnected();
          onClose();
        } catch (err: any) {
          toast.error(err?.message || 'Failed to complete authorization');
          setStep('pick');
        }
        return;
      }
      // Legacy: direct oauth_complete (for future providers that handle it in the popup)
      if (event.data?.type === 'oauth_complete' && event.data?.status === 'connected') {
        setStep('pick');
        toast.success(`${selectedService?.name ?? 'Service'} connected`);
        onConnected();
        onClose();
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [step, selectedService, onConnected, onClose]);

  const handleServiceClick = useCallback(async (service: ServiceDef) => {
    setSelectedService(service);

    if (service.flow === 'oauth') {
      // Start OAuth popup flow
      try {
        setStep('oauth-pending');
        const oauth = await syncSvc.getOAuthAuthorizeUrl(service.provider ?? '', service.scopes ?? '');

        // Stash provider in localStorage for the callback page
        localStorage.setItem('claw_oauth_pending', JSON.stringify({
          provider: service.provider,
          state: oauth.state,
        }));

        // Open popup
        const popup = window.open(
          oauth.authorize_url,
          'claw_oauth',
          'width=500,height=700,scrollbars=yes,resizable=yes',
        );

        if (!popup) {
          toast.error('Popup blocked. Please allow popups for this site.');
          setStep('pick');
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to start authorization');
        setStep('pick');
      }
    } else {
      // Show credential form
      setStep('form');
    }
  }, []);

  const handleFormComplete = useCallback(() => {
    toast.success(`${selectedService?.name ?? 'Service'} connected`);
    onConnected();
    onClose();
  }, [selectedService, onConnected, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 200,
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Conectar una cuenta"
        style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 480, maxHeight: '80vh',
        background: 'var(--glass-modal)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
        zIndex: 201,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            {step === 'pick' ? (prefilterService ? 'Add Integration' : 'Conectar una cuenta') : step === 'oauth-pending' ? 'Authorizing...' : selectedService?.name}
          </div>
          <button
            onClick={step === 'form' ? (prefilterService ? onClose : () => setStep('pick')) : onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-dim)',
              cursor: 'pointer', padding: 4, display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
          {step === 'pick' && !prefilterService && (
            <DiscoverForm
              onConnected={() => { onConnected(); onClose(); }}
              // Sin descubrimiento, el formulario completo de siempre: el motor
              // admite que no sabe en vez de inventarse un servidor.
              onManualFallback={() => {
                const imap = SERVICES.find((s) => s.id === 'imap');
                if (imap) { setSelectedService(imap); setStep('form'); }
              }}
              // Un proveedor cuyo primer método es OAuth no pasa por contraseña:
              // se le manda a su autorización real.
              onOAuth={(slug) => {
                const svc = SERVICES.find((s) => s.provider === slug && s.flow === 'oauth');
                if (svc) void handleServiceClick(svc);
                else toast.error('Ese proveedor todavía no tiene autorización configurada');
              }}
            />
          )}

          {step === 'pick' && prefilterService && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {CATEGORIES.map((cat) => {
                const CatIcon = CATEGORY_ICONS[cat];
                const services = SERVICES.filter((s) => s.category === cat);
                return (
                  <div key={cat}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      marginBottom: 8,
                    }}>
                      {CatIcon && <CatIcon size={14} />}
                      {cat}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {services.map((service) => (
                        <button
                          key={service.id}
                          onClick={() => handleServiceClick(service)}
                          style={{
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 8,
                            padding: '16px 8px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            color: 'var(--text)',
                            fontFamily: 'var(--font-sans)',
                            fontSize: '0.8125rem',
                            transition: 'all var(--transition-fast)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--surface-hover)';
                            e.currentTarget.style.borderColor = 'var(--border-hover)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--surface)';
                            e.currentTarget.style.borderColor = 'var(--border)';
                          }}
                        >
                          <ServiceIcon type={service.icon} size={28} />
                          <span>{service.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {step === 'oauth-pending' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, padding: '40px 0',
            }}>
              <Loader2 size={32} style={{ color: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
                Waiting for authorization in popup...
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-[var(--text-dim)]"
                onClick={() => setStep('pick')}
              >
                Cancel
              </Button>
            </div>
          )}

          {step === 'form' && selectedService && (() => {
            const handleFormCancel = prefilterService ? onClose : () => setStep('pick');
            return (
            <>
              {(selectedService.flow === 'caldav' || selectedService.flow === 'carddav') && (
                <DavForm
                  type={selectedService.flow}
                  preset={selectedService.preset}
                  serviceName={selectedService.name}
                  onComplete={handleFormComplete}
                  onCancel={handleFormCancel}
                />
              )}
              {selectedService.flow === 'imap' && (
                <ImapForm
                  preset={selectedService.preset}
                  serviceName={selectedService.name}
                  onComplete={handleFormComplete}
                  onCancel={handleFormCancel}
                />
              )}
              {selectedService.flow === 'bot_token' && selectedService.id === 'discord-observer' && (
                <DiscordBotForm
                  onComplete={handleFormComplete}
                  onCancel={handleFormCancel}
                />
              )}
              {selectedService.flow === 'bot_token' && selectedService.id === 'telegram-matrix' && (
                <TelegramMatrixForm
                  onComplete={handleFormComplete}
                  onCancel={handleFormCancel}
                />
              )}
              {selectedService.flow === 'bot_token' && selectedService.id === 'whatsapp-matrix' && (
                <WhatsAppMatrixForm
                  onComplete={handleFormComplete}
                  onCancel={handleFormCancel}
                />
              )}
              {selectedService.flow === 'bot_token' && selectedService.id === 'signal-observer' && (
                <SignalForm
                  onComplete={handleFormComplete}
                  onCancel={handleFormCancel}
                />
              )}
              {selectedService.flow === 'bot_token' && selectedService.id === 'simplex-observer' && (
                <SimplexOwnForm
                  onComplete={handleFormComplete}
                  onCancel={handleFormCancel}
                />
              )}
              {selectedService.flow === 'bot_token' && selectedService.id === 'simplex-xrcp' && (
                <SimplexXrcpForm
                  onComplete={handleFormComplete}
                  onCancel={handleFormCancel}
                />
              )}
              {selectedService.flow === 'bot_token' && selectedService.id === 'session-observer' && (
                <SessionForm
                  variant="own"
                  onComplete={handleFormComplete}
                  onCancel={handleFormCancel}
                />
              )}
              {selectedService.flow === 'bot_token' && selectedService.id === 'session-link-observer' && (
                <SessionForm
                  variant="link"
                  onComplete={handleFormComplete}
                  onCancel={handleFormCancel}
                />
              )}
            </>
            );
          })()}
        </div>
      </div>

      {/* Spin animation for Loader2 */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
