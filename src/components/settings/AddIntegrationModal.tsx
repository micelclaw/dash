import { useState, useEffect, useCallback } from 'react';
import { X, Mail, Calendar, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { DavForm } from './DavForm';
import { ImapForm } from './ImapForm';

// ─── Service definitions ─────────────────────────────────

type FlowType = 'oauth' | 'imap' | 'caldav' | 'carddav';

interface ServiceDef {
  id: string;
  category: 'Email' | 'Calendar' | 'Contacts';
  name: string;
  icon: string;
  color: string;
  flow: FlowType;
  provider?: string;
  scopes?: string;
  preset?: Record<string, any>;
}

const SERVICES: ServiceDef[] = [
  // Email
  { id: 'gmail', category: 'Email', name: 'Gmail', icon: 'google', color: '#4285f4',
    flow: 'oauth', provider: 'google', scopes: 'https://mail.google.com/' },
  { id: 'synology-mail', category: 'Email', name: 'Synology Mail', icon: 'synology', color: '#e87e04',
    flow: 'imap', preset: { imap_port: 993, smtp_port: 587, imap_encryption: 'ssl', smtp_encryption: 'tls' } },
  { id: 'imap', category: 'Email', name: 'IMAP', icon: 'mail', color: 'var(--text-dim)',
    flow: 'imap' },

  // Calendar
  { id: 'google-calendar', category: 'Calendar', name: 'Google Calendar', icon: 'google', color: '#4285f4',
    flow: 'oauth', provider: 'google', scopes: 'https://www.googleapis.com/auth/calendar' },
  { id: 'synology-calendar', category: 'Calendar', name: 'Synology Calendar', icon: 'synology', color: '#e87e04',
    flow: 'caldav', preset: { path_hint: '/caldav/' } },
  { id: 'caldav', category: 'Calendar', name: 'CalDAV', icon: 'calendar', color: 'var(--text-dim)',
    flow: 'caldav' },

  // Contacts
  { id: 'google-contacts', category: 'Contacts', name: 'Google Contacts', icon: 'google', color: '#4285f4',
    flow: 'oauth', provider: 'google', scopes: 'https://www.googleapis.com/auth/contacts.readonly' },
  { id: 'synology-contacts', category: 'Contacts', name: 'Synology Contacts', icon: 'synology', color: '#e87e04',
    flow: 'carddav', preset: { path_hint: '/carddav/' } },
  { id: 'carddav', category: 'Contacts', name: 'CardDAV', icon: 'contacts', color: 'var(--text-dim)',
    flow: 'carddav' },
];

const CATEGORIES = ['Email', 'Calendar', 'Contacts'] as const;

const CATEGORY_ICONS: Record<string, typeof Mail> = {
  Email: Mail,
  Calendar: Calendar,
  Contacts: Users,
};

// ─── Service Icon (SVG inline) ───────────────────────────

function ServiceIcon({ type, size = 24 }: { type: string; size?: number }) {
  switch (type) {
    case 'google':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      );
    case 'synology':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="#e87e04" strokeWidth="2"/>
          <text x="12" y="16" textAnchor="middle" fill="#e87e04" fontSize="10" fontWeight="bold">S</text>
        </svg>
      );
    case 'mail':
      return <Mail size={size} style={{ color: 'var(--text-dim)' }} />;
    case 'calendar':
      return <Calendar size={size} style={{ color: 'var(--text-dim)' }} />;
    case 'contacts':
      return <Users size={size} style={{ color: 'var(--text-dim)' }} />;
    default:
      return <Mail size={size} style={{ color: 'var(--text-dim)' }} />;
  }
}

// ─── Component ───────────────────────────────────────────

interface AddIntegrationModalProps {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export function AddIntegrationModal({ open, onClose, onConnected }: AddIntegrationModalProps) {
  const [step, setStep] = useState<'pick' | 'oauth-pending' | 'form'>('pick');
  const [selectedService, setSelectedService] = useState<ServiceDef | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('pick');
      setSelectedService(null);
    }
  }, [open]);

  // Listen for OAuth popup completion
  useEffect(() => {
    if (step !== 'oauth-pending') return;

    const handler = (event: MessageEvent) => {
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
        const res = await api.get<{ data: { authorize_url: string; state: string } }>(
          `/sync/oauth/authorize/${service.provider}?scopes=${encodeURIComponent(service.scopes!)}`,
        );

        // Stash provider in localStorage for the callback page
        localStorage.setItem('claw_oauth_pending', JSON.stringify({
          provider: service.provider,
          state: res.data.state,
        }));

        // Open popup
        const popup = window.open(
          res.data.authorize_url,
          'claw_oauth',
          'width=500,height=700,scrollbars=yes,resizable=yes',
        );

        if (!popup) {
          toast.error('Popup blocked. Please allow popups for this site.');
          setStep('pick');
        }
      } catch {
        toast.error('Failed to start authorization');
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
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 480, maxHeight: '80vh',
        background: 'rgba(17, 17, 24, 0.85)',
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
            {step === 'pick' ? 'Add Integration' : step === 'oauth-pending' ? 'Authorizing...' : selectedService?.name}
          </div>
          <button
            onClick={step === 'form' ? () => setStep('pick') : onClose}
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
          {step === 'pick' && (
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
                      <CatIcon size={14} />
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
              <button
                onClick={() => setStep('pick')}
                style={{
                  marginTop: 8, padding: '4px 12px',
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-dim)', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontSize: '0.75rem',
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {step === 'form' && selectedService && (
            <>
              {(selectedService.flow === 'caldav' || selectedService.flow === 'carddav') && (
                <DavForm
                  type={selectedService.flow}
                  preset={selectedService.preset}
                  serviceName={selectedService.name}
                  onComplete={handleFormComplete}
                  onCancel={() => setStep('pick')}
                />
              )}
              {selectedService.flow === 'imap' && (
                <ImapForm
                  preset={selectedService.preset}
                  serviceName={selectedService.name}
                  onComplete={handleFormComplete}
                  onCancel={() => setStep('pick')}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Spin animation for Loader2 */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
