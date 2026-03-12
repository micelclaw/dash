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
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface EditConnectorModalProps {
  connectorId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

interface ConnectorDetail {
  id: string;
  connector_type: string;
  display_name: string | null;
  name: string;
  status: string;
  config: Record<string, any>;
  account_id?: string;
}

interface EmailAccountDetail {
  id: string;
  name: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_username: string | null;
  smtp_host: string;
  smtp_port: number;
  sync_interval_minutes: number;
}

export function EditConnectorModal({ connectorId, onClose, onSaved }: EditConnectorModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [connector, setConnector] = useState<ConnectorDetail | null>(null);
  const [emailAccount, setEmailAccount] = useState<EmailAccountDetail | null>(null);

  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState(993);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(465);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [interval, setInterval] = useState(15);
  const [maxMessages, setMaxMessages] = useState(2000);

  // Load connector detail
  useEffect(() => {
    if (!connectorId) return;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const res = await api.get<{ data: ConnectorDetail & { account_id?: string } }>(`/sync/connectors/${connectorId}`);
        const c = res.data;
        setConnector(c);
        setDisplayName(c.display_name ?? c.name);
        setInterval(c.config.sync_interval_minutes ?? 15);

        if (c.connector_type === 'imap-generic' && c.account_id) {
          // Fetch linked email account
          const accRes = await api.get<{ data: EmailAccountDetail }>(`/email-accounts/${c.account_id}`);
          const acc = accRes.data;
          setEmailAccount(acc);
          setEmailAddress(acc.email_address);
          setImapHost(acc.imap_host);
          setImapPort(acc.imap_port);
          setSmtpHost(acc.smtp_host);
          setSmtpPort(acc.smtp_port);
          setUsername(acc.imap_username ?? '');
          setInterval(acc.sync_interval_minutes ?? 5);
          setDisplayName(acc.name);
        } else if (c.connector_type === 'caldav' || c.connector_type === 'carddav') {
          setServerUrl(c.config.server_url ?? '');
          setUsername(c.config.username ?? '');
        }

        // Load max_messages for connectors that support it
        if (c.config.max_initial_messages) {
          setMaxMessages(c.config.max_initial_messages);
        }
      } catch {
        setError('Failed to load connector details');
      } finally {
        setLoading(false);
      }
    })();
  }, [connectorId]);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      if (connector?.connector_type === 'imap-generic' && emailAccount) {
        // Update email account
        await api.patch(`/email-accounts/${emailAccount.id}`, {
          name: displayName,
          email_address: emailAddress,
          imap_host: imapHost,
          imap_port: imapPort,
          smtp_host: smtpHost || imapHost,
          smtp_port: smtpPort,
          imap_username: username || undefined,
          sync_interval_minutes: interval,
          ...(password ? { password } : {}),
        });
        // Also update connector config
        await api.patch(`/sync/connectors/${connectorId}/config`, {
          display_name: displayName,
          sync_interval_minutes: interval,
          max_initial_messages: maxMessages,
          host: imapHost,
          port: imapPort,
        });
      } else if (isOAuth) {
        // OAuth connectors (Gmail, Google Calendar, etc.)
        await api.patch(`/sync/connectors/${connectorId}/config`, {
          display_name: displayName,
          sync_interval_minutes: interval,
          max_initial_messages: maxMessages,
        });
      } else {
        // CalDAV/CardDAV
        await api.patch(`/sync/connectors/${connectorId}/config`, {
          display_name: displayName,
          server_url: serverUrl,
          username,
          sync_interval_minutes: interval,
          ...(password ? { password_encrypted: password } : {}),
        });
      }

      toast.success('Settings saved');
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!connectorId) return null;

  const isImap = connector?.connector_type === 'imap-generic';
  const isOAuth = connector?.connector_type?.startsWith('google') || connector?.connector_type === 'gmail';

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 32, padding: '0 8px',
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', color: 'var(--text)',
    fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)',
    marginBottom: 4, display: 'block',
  };

  const rowStyle: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8,
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)', zIndex: 200,
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 440, maxHeight: '80vh',
        background: 'rgba(17, 17, 24, 0.85)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        boxShadow: '0 16px 64px rgba(0,0,0,0.5)', zIndex: 201,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            Edit: {displayName || 'Connector'}
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-dim)',
            cursor: 'pointer', padding: 4, display: 'flex',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 16, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 size={24} style={{ color: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <>
              <div>
                <label style={labelStyle}>Display Name</label>
                <input style={inputStyle} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>

              {isImap && (
                <>
                  <div>
                    <label style={labelStyle}>Email Address</label>
                    <input style={inputStyle} type="email" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} />
                  </div>
                  <div style={rowStyle}>
                    <div>
                      <label style={labelStyle}>IMAP Host</label>
                      <input style={inputStyle} value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Port</label>
                      <input style={{ ...inputStyle, textAlign: 'center' }} type="number" value={imapPort} onChange={(e) => setImapPort(Number(e.target.value))} />
                    </div>
                  </div>
                  <div style={rowStyle}>
                    <div>
                      <label style={labelStyle}>SMTP Host</label>
                      <input style={inputStyle} value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Port</label>
                      <input style={{ ...inputStyle, textAlign: 'center' }} type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Username</label>
                    <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} />
                  </div>
                </>
              )}

              {!isImap && !isOAuth && (
                <>
                  <div>
                    <label style={labelStyle}>Server URL</label>
                    <input style={inputStyle} value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Username</label>
                    <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} />
                  </div>
                </>
              )}

              {!isOAuth && (
                <div>
                  <label style={labelStyle}>Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(leave empty to keep current)</span></label>
                  <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
              )}

              {isOAuth && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 0' }}>
                  Authenticated via Google OAuth. To re-authenticate, disconnect and reconnect.
                </div>
              )}

              <div>
                <label style={labelStyle}>Sync Interval</label>
                <select value={interval} onChange={(e) => setInterval(Number(e.target.value))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value={5}>Every 5 minutes</option>
                  <option value={15}>Every 15 minutes</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every hour</option>
                </select>
              </div>

              {(isImap || isOAuth) && (
                <div>
                  <label style={labelStyle}>Max Emails (initial sync)</label>
                  <select value={maxMessages} onChange={(e) => setMaxMessages(Number(e.target.value))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value={500}>500 emails</option>
                    <option value={1000}>1,000 emails</option>
                    <option value={2000}>2,000 emails</option>
                    <option value={5000}>5,000 emails</option>
                    <option value={10000}>10,000 emails (slow)</option>
                  </select>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Only affects the first sync. Subsequent syncs fetch new emails incrementally.
                  </div>
                </div>
              )}

              {error && (
                <div style={{ fontSize: '0.75rem', color: 'var(--error)', padding: '4px 0' }}>{error}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div style={{
            display: 'flex', gap: 8, justifyContent: 'flex-end',
            padding: '12px 16px', borderTop: '1px solid var(--border)',
          }}>
            <button onClick={onClose} style={{
              padding: '6px 14px', background: 'none', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-dim)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
            }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{
              padding: '6px 14px', background: 'var(--amber)', color: '#000',
              border: 'none', borderRadius: 'var(--radius-md)',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 500,
              opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Save
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
