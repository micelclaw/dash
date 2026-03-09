import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Mail, Calendar, Users, Loader2, MessageSquare, Check, Container } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { DavForm } from './DavForm';
import { ImapForm } from './ImapForm';

// ─── Service definitions ─────────────────────────────────

type FlowType = 'oauth' | 'imap' | 'caldav' | 'carddav' | 'bot_token';

interface ServiceDef {
  id: string;
  category: 'Email' | 'Calendar' | 'Contacts' | 'Messaging';
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

  // Messaging
  { id: 'slack-observer', category: 'Messaging', name: 'Slack', icon: 'slack', color: '#4A154B',
    flow: 'oauth', provider: 'slack', scopes: 'channels:history,channels:read,im:history,groups:history,users:read' },
  { id: 'discord-observer', category: 'Messaging', name: 'Discord', icon: 'discord', color: '#5865F2',
    flow: 'bot_token' },
  { id: 'telegram-observer', category: 'Messaging', name: 'Telegram', icon: 'telegram', color: '#0088cc',
    flow: 'bot_token' },
  { id: 'teams-observer', category: 'Messaging', name: 'Teams', icon: 'teams', color: '#6264a7',
    flow: 'oauth', provider: 'microsoft', scopes: 'Chat.Read,ChannelMessage.Read.All' },
  { id: 'signal-observer', category: 'Messaging', name: 'Signal', icon: 'signal', color: '#3a76f0',
    flow: 'bot_token' },
];

const CATEGORIES = ['Email', 'Calendar', 'Contacts', 'Messaging'] as const;

const CATEGORY_ICONS: Record<string, typeof Mail> = {
  Email: Mail,
  Calendar: Calendar,
  Contacts: Users,
  Messaging: MessageSquare,
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
    case 'slack':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313z" fill="#E01E5A"/>
          <path d="M8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312z" fill="#36C5F0"/>
          <path d="M18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312z" fill="#2EB67D"/>
          <path d="M15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" fill="#ECB22E"/>
        </svg>
      );
    case 'discord':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#5865F2">
          <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      );
    case 'telegram':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="#0088cc"/>
          <path d="M5.4 11.6l10.1-4.3c.5-.2.9.1.7.7L14.5 16c-.2.5-.6.6-1 .4l-2.8-2.1-1.3 1.3c-.1.1-.3.2-.5.2l.2-2.8 5.1-4.6c.2-.2 0-.3-.3-.1L7.6 13.2l-2.7-.8c-.6-.2-.6-.6.1-.8z" fill="white"/>
        </svg>
      );
    case 'teams':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="1" y="4" width="14" height="16" rx="2" fill="#6264a7"/>
          <text x="8" y="15" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">T</text>
          <circle cx="19" cy="7" r="3.5" fill="#6264a7"/>
          <rect x="15.5" y="11" width="7" height="7" rx="1.5" fill="#6264a7" opacity="0.8"/>
        </svg>
      );
    case 'signal':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#3a76f0"/>
          <path d="M12 6.5c-3.04 0-5.5 2.46-5.5 5.5 0 .97.25 1.88.7 2.67L6.5 17.5l2.83-.7c.79.45 1.7.7 2.67.7 3.04 0 5.5-2.46 5.5-5.5S15.04 6.5 12 6.5z" fill="white"/>
        </svg>
      );
    default:
      return <Mail size={size} style={{ color: 'var(--text-dim)' }} />;
  }
}

// ─── Component ───────────────────────────────────────────

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
          await api.post('/sync/oauth/callback', {
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
              {selectedService.flow === 'bot_token' && selectedService.id === 'discord-observer' && (
                <DiscordBotForm
                  onComplete={handleFormComplete}
                  onCancel={() => setStep('pick')}
                />
              )}
              {selectedService.flow === 'bot_token' && selectedService.id === 'telegram-observer' && (
                <TelegramBotForm
                  onComplete={handleFormComplete}
                  onCancel={() => setStep('pick')}
                />
              )}
              {selectedService.flow === 'bot_token' && selectedService.id === 'signal-observer' && (
                <SignalForm
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

// ─── Discord Bot Token Form ─────────────────────────────

function DiscordBotForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const [botToken, setBotToken] = useState('');
  const [guildId, setGuildId] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!botToken || !guildId) return;

    setSaving(true);
    try {
      await api.post('/sync/connectors', {
        connector_type: 'discord-observer',
        config: { bot_token: botToken, guild_id: guildId },
      });
      onComplete();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect Discord');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Create a Discord bot and paste its token here. The bot must be added to your server.
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
          Bot Token
        </label>
        <input
          type="password"
          value={botToken}
          onChange={e => setBotToken(e.target.value)}
          placeholder="Bot token from Discord Developer Portal"
          required
          style={{
            width: '100%', padding: '8px 10px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
            fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
          Server (Guild) ID
        </label>
        <input
          type="text"
          value={guildId}
          onChange={e => setGuildId(e.target.value)}
          placeholder="Right-click server → Copy Server ID"
          required
          style={{
            width: '100%', padding: '8px 10px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
            fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1, padding: '8px 12px',
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-dim)',
            cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
          }}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={saving || !botToken || !guildId}
          style={{
            flex: 1, padding: '8px 12px',
            background: 'var(--amber)', border: 'none',
            borderRadius: 'var(--radius-md)', color: '#000',
            cursor: saving ? 'default' : 'pointer', fontWeight: 600,
            fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
            opacity: saving || !botToken || !guildId ? 0.6 : 1,
          }}
        >
          {saving ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </form>
  );
}

// ─── Telegram Bot Token Form ────────────────────────────

function TelegramBotForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const [botToken, setBotToken] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!botToken) return;

    setSaving(true);
    try {
      await api.post('/sync/connectors', {
        connector_type: 'telegram-observer',
        config: { bot_token: botToken },
      });
      onComplete();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect Telegram');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Create a Telegram bot via <strong>@BotFather</strong> and paste the token here.
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
          Bot Token
        </label>
        <input
          type="password"
          value={botToken}
          onChange={e => setBotToken(e.target.value)}
          placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
          required
          style={{
            width: '100%', padding: '8px 10px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
            fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1, padding: '8px 12px',
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-dim)',
            cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
          }}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={saving || !botToken}
          style={{
            flex: 1, padding: '8px 12px',
            background: 'var(--amber)', border: 'none',
            borderRadius: 'var(--radius-md)', color: '#000',
            cursor: saving ? 'default' : 'pointer', fontWeight: 600,
            fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
            opacity: saving || !botToken ? 0.6 : 1,
          }}
        >
          {saving ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </form>
  );
}

// ─── Signal REST API Form ───────────────────────────────
// Flow: Deploy signal-cli → Enter phone → Link via QR code → Connect

type SignalStep = 'deploy' | 'phone' | 'linking' | 'ready';

function SignalForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
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
        const res = await api.get<{ data: { running: boolean; url: string | null } }>('/signal-cli/status');
        if (res.data?.running && res.data.url) {
          setApiUrl(res.data.url);
          setDeployStatus('ready');
          // Check if already linked
          const accs = await api.get<{ data: string[] }>('/signal-cli/accounts');
          if (accs.data?.length > 0) {
            setPhoneNumber(accs.data[0]);
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
      const res = await api.post<{ data: { running: boolean; url: string | null } }>('/signal-cli/start');
      if (res.data?.running && res.data.url) {
        setApiUrl(res.data.url);
        setDeployStatus('ready');
        toast.success('Signal CLI REST API is running');
        setStep('phone');
      } else {
        setDeployStatus('error');
        toast.error('Signal CLI started but API not healthy');
      }
    } catch (err: any) {
      setDeployStatus('error');
      toast.error(err?.message || 'Failed to deploy Signal CLI');
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
      const res = await api.post<{ data: { qr_uri: string } }>('/signal-cli/link');
      setQrImage(res.data.qr_uri);
      setStep('linking');
      // Poll for link completion every 5 seconds (don't hammer signal-cli during linking)
      linkPollRef.current = setInterval(async () => {
        try {
          const check = await api.post<{ data: { linked: boolean } }>('/signal-cli/link-check', {
            phone_number: phoneNumber,
          });
          if (check.data?.linked) {
            if (linkPollRef.current) clearInterval(linkPollRef.current);
            setStep('ready');
            toast.success('Signal account linked!');
          }
        } catch {
          // polling error — ignore
        }
      }, 5000);
    } catch (err: any) {
      setLinkError(err?.message || 'Failed to generate QR code');
      toast.error('Failed to start linking');
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleConnect() {
    if (!apiUrl || !phoneNumber) return;
    setSaving(true);
    try {
      await api.post('/sync/connectors', {
        connector_type: 'signal-observer',
        config: { api_url: apiUrl, phone_number: phoneNumber },
      });
      onComplete();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect Signal');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px',
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
    outline: 'none', boxSizing: 'border-box' as const,
  };

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
                Signal requires a <strong>signal-cli REST API</strong> service. Deploy it automatically:
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
                  <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Deploying Signal CLI...</>
                ) : deployStatus === 'error' ? (
                  <><Container size={14} /> Retry deploy</>
                ) : (
                  <><Container size={14} /> Deploy Signal CLI REST API</>
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
              or enter a custom REST API URL:
            </div>
          )}
          {!deploying && (
            <>
              <input
                type="url"
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
                placeholder="http://localhost:8282"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => { if (apiUrl) { setDeployStatus('ready'); setStep('phone'); } }}
                disabled={!apiUrl}
                style={{
                  padding: '8px 12px',
                  background: apiUrl ? 'var(--surface-hover)' : 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text)',
                  cursor: apiUrl ? 'pointer' : 'default',
                  fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                  opacity: apiUrl ? 1 : 0.5,
                }}
              >
                Use this URL
              </button>
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
            Signal CLI REST API running at {apiUrl}
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            Enter your phone number to link this device to your Signal account.
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
              Your Signal Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              placeholder="+34612345678"
              style={inputStyle}
            />
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
              The phone number linked to your Signal mobile app.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setStep('deploy')}
              style={{
                flex: 1, padding: '8px 12px',
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-dim)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
              }}
            >
              Back
            </button>
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
                <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating QR...</>
              ) : (
                'Link Signal Account'
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
            Scan this QR code with your Signal app:
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
                  alt="Signal QR Code"
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
            Waiting for you to scan...
          </div>

          <button
            type="button"
            onClick={() => {
              if (linkPollRef.current) clearInterval(linkPollRef.current);
              setQrImage(null);
              setStep('phone');
            }}
            style={{
              padding: '6px 12px', alignSelf: 'center',
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-dim)',
              cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.75rem',
            }}
          >
            Cancel
          </button>
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
            Signal account linked ({phoneNumber})
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            Your Signal account is linked and ready. Click Connect to start observing messages.
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1, padding: '8px 12px',
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-dim)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConnect}
              disabled={saving}
              style={{
                flex: 1, padding: '8px 12px',
                background: 'var(--amber)', border: 'none',
                borderRadius: 'var(--radius-md)', color: '#000',
                cursor: saving ? 'default' : 'pointer', fontWeight: 600,
                fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
