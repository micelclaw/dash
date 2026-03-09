import { useState, useEffect, useCallback } from 'react';
import { X, HardDrive, Cloud, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface MountServiceDef {
  id: string;
  name: string;
  provider_type: string;
  flow: 'oauth' | 'coming_soon';
  color: string;
}

const MOUNT_SERVICES: MountServiceDef[] = [
  { id: 'gdrive', name: 'Google Drive', provider_type: 'gdrive', flow: 'oauth', color: '#4285f4' },
  { id: 'dropbox', name: 'Dropbox', provider_type: 'dropbox', flow: 'oauth', color: '#0061fe' },
  { id: 's3', name: 'Amazon S3', provider_type: 's3', flow: 'coming_soon', color: '#ff9900' },
  { id: 'smb', name: 'SMB / CIFS', provider_type: 'smb', flow: 'coming_soon', color: 'var(--text-muted)' },
  { id: 'sftp', name: 'SFTP', provider_type: 'sftp', flow: 'coming_soon', color: 'var(--text-muted)' },
  { id: 'webdav', name: 'WebDAV', provider_type: 'webdav', flow: 'coming_soon', color: 'var(--text-muted)' },
];

type WizardStep = 'pick' | 'oauth-pending' | 'configure';

interface MountWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function MountWizard({ open, onClose, onCreated }: MountWizardProps) {
  const [step, setStep] = useState<WizardStep>('pick');
  const [selectedService, setSelectedService] = useState<MountServiceDef | null>(null);
  const [mountName, setMountName] = useState('');
  const [mountPath, setMountPath] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [connectorId, setConnectorId] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('pick');
      setSelectedService(null);
      setMountName('');
      setMountPath('');
      setReadOnly(false);
      setConnectorId(null);
    }
  }, [open]);

  // Listen for OAuth callback
  useEffect(() => {
    if (step !== 'oauth-pending') return;

    const handler = async (event: MessageEvent) => {
      if (event.data?.type === 'oauth_callback') {
        try {
          const res = await api.post<{ data: { id: string } }>('/sync/oauth/callback', {
            provider: event.data.provider,
            code: event.data.code,
            state: event.data.state,
          });
          localStorage.removeItem('claw_oauth_pending');
          setConnectorId(res.data?.id ?? null);
          setMountName(selectedService?.name ?? 'Cloud Drive');
          setMountPath(`/${selectedService?.provider_type ?? 'cloud'}/`);
          setStep('configure');
          toast.success('Authorization successful');
        } catch {
          toast.error('OAuth authorization failed');
          setStep('pick');
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [step, selectedService]);

  const handleServiceClick = useCallback(async (service: MountServiceDef) => {
    if (service.flow === 'coming_soon') return;

    setSelectedService(service);
    setStep('oauth-pending');

    // Map VFS provider type → OAuth provider name used by the backend
    const oauthProviderMap: Record<string, string> = { gdrive: 'google', dropbox: 'dropbox' };
    const oauthProvider = oauthProviderMap[service.provider_type] ?? service.provider_type;
    const scopes = service.provider_type === 'gdrive'
      ? 'https://www.googleapis.com/auth/drive.readonly'
      : 'files.metadata.read,files.content.read';

    try {
      const res = await api.get<{ data: { authorize_url: string; state: string } }>(
        `/sync/oauth/authorize/${oauthProvider}?scopes=${encodeURIComponent(scopes)}`,
      );

      localStorage.setItem('claw_oauth_pending', JSON.stringify({
        provider: service.provider_type,
        state: res.data.state,
      }));

      const popup = window.open(
        res.data.authorize_url,
        'claw_oauth',
        'width=500,height=700,scrollbars=yes,resizable=yes',
      );

      if (!popup) {
        toast.error('Popup blocked. Please allow popups.');
        setStep('pick');
      }
    } catch {
      toast.error('Failed to start authorization');
      setStep('pick');
    }
  }, []);

  const handleCreateMount = useCallback(async () => {
    if (!mountName.trim() || !mountPath.trim() || !selectedService) return;
    setCreating(true);
    try {
      const path = mountPath.startsWith('/') ? mountPath : `/${mountPath}`;
      await api.post('/vfs/mounts', {
        name: mountName.trim(),
        provider_type: selectedService.provider_type,
        mount_path: path,
        config: connectorId ? { connectorId } : {},
        read_only: readOnly,
      });
      toast.success(`"${mountName}" mounted`);
      onCreated();
      onClose();
    } catch (err: any) {
      if (err?.response?.data?.error?.code === 'CONFLICT') {
        toast.error('A mount with this name already exists');
      } else {
        toast.error(err?.message || 'Failed to create mount');
      }
    } finally {
      setCreating(false);
    }
  }, [mountName, mountPath, selectedService, connectorId, readOnly, onCreated, onClose]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 'var(--z-modal)' as any,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', width: 480, maxWidth: '90vw',
        maxHeight: '80vh', overflow: 'auto',
        fontFamily: 'var(--font-sans)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ flex: 1, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            {step === 'pick' ? 'Add Storage Source' : step === 'oauth-pending' ? 'Authorizing...' : 'Configure Mount'}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {/* Step: Pick */}
          {step === 'pick' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}>
              {MOUNT_SERVICES.map(service => {
                const isDisabled = service.flow === 'coming_soon';
                return (
                  <button
                    key={service.id}
                    onClick={() => handleServiceClick(service)}
                    disabled={isDisabled}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      padding: '16px 8px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.45 : 1,
                      position: 'relative',
                      transition: 'border-color var(--transition-fast)',
                    }}
                  >
                    {service.provider_type === 'local'
                      ? <HardDrive size={24} style={{ color: service.color }} />
                      : <Cloud size={24} style={{ color: service.color }} />
                    }
                    <span style={{ fontSize: '0.75rem', color: 'var(--text)', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                      {service.name}
                    </span>
                    {isDisabled && (
                      <span style={{
                        position: 'absolute', top: 4, right: 4,
                        fontSize: '0.5625rem', padding: '1px 4px',
                        background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-muted)', border: '1px solid var(--border)',
                      }}>
                        Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step: OAuth pending */}
          {step === 'oauth-pending' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <Loader2 size={32} style={{ color: 'var(--amber)', animation: 'spin 1s linear infinite', marginBottom: 12 }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text)' }}>
                Complete authorization in the popup window
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                If the popup was blocked, please allow popups for this site.
              </div>
              <button
                onClick={() => setStep('pick')}
                style={{
                  marginTop: 16, padding: '6px 16px',
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Step: Configure */}
          {step === 'configure' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Mount name</label>
                <input
                  value={mountName}
                  onChange={e => setMountName(e.target.value)}
                  style={inputStyle}
                  placeholder="My Cloud Drive"
                />
              </div>
              <div>
                <label style={labelStyle}>Mount path</label>
                <input
                  value={mountPath}
                  onChange={e => setMountPath(e.target.value)}
                  style={inputStyle}
                  placeholder="/gdrive/"
                />
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  VFS path where this source will be mounted
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={readOnly}
                  onChange={e => setReadOnly(e.target.checked)}
                  style={{ accentColor: 'var(--amber)' }}
                />
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Read-only</span>
              </label>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '6px 16px', background: 'transparent',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateMount}
                  disabled={!mountName.trim() || !mountPath.trim() || creating}
                  style={{
                    padding: '6px 16px', background: 'var(--amber)', color: '#000',
                    border: 'none', borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                    fontWeight: 600, opacity: creating ? 0.6 : 1,
                  }}
                >
                  {creating ? 'Creating...' : 'Create Mount'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--text-dim)',
  marginBottom: 4,
  fontFamily: 'var(--font-sans)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
};
