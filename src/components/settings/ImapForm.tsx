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

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/services/api';

interface ImapFormProps {
  preset?: Record<string, any>;
  serviceName: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function ImapForm({ preset, serviceName, onComplete, onCancel }: ImapFormProps) {
  const [name, setName] = useState(serviceName);
  const [email, setEmail] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState(preset?.imap_port ?? 993);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(preset?.smtp_port ?? 587);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [interval, setInterval] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isSynology = serviceName.includes('Synology');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Step 1: Test IMAP connection before saving
      const testRes = await api.post<{ data: { ok: boolean; error?: string; folders?: string[] } }>('/sync/test-connection', {
        type: 'imap',
        host: imapHost,
        port: imapPort,
        secure: (preset?.imap_encryption ?? 'ssl') === 'ssl',
        username: username || email,
        password,
      });

      if (!testRes.data.ok) {
        setError(testRes.data.error || 'IMAP connection failed. Check your credentials and server address.');
        setSubmitting(false);
        return;
      }

      // Step 2: Create email account + connector only if test passed
      await api.post('/email-accounts', {
        name,
        email_address: email,
        imap_host: imapHost,
        imap_port: imapPort,
        imap_encryption: preset?.imap_encryption ?? 'ssl',
        smtp_host: smtpHost || imapHost,
        smtp_port: smtpPort,
        smtp_encryption: preset?.smtp_encryption ?? 'tls',
        imap_username: username || undefined,
        auth_method: 'password',
        password,
        sync_enabled: true,
        sync_interval_minutes: interval,
        sync_folders: ['INBOX'],
      });
      onComplete();
    } catch (err: any) {
      setError(err?.message || 'Failed to create email account');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 32,
    padding: '0 8px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.8125rem',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--text-dim)',
    marginBottom: 4,
    display: 'block',
  };

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 100px',
    gap: 8,
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={labelStyle}>Account Name</label>
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div>
        <label style={labelStyle}>Email Address</label>
        <input
          style={inputStyle}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          required
        />
      </div>

      <div style={rowStyle}>
        <div>
          <label style={labelStyle}>IMAP Host</label>
          <input
            style={inputStyle}
            value={imapHost}
            onChange={(e) => setImapHost(e.target.value)}
            placeholder={isSynology ? 'nas.local' : 'imap.example.com'}
            required
          />
        </div>
        <div>
          <label style={labelStyle}>Port</label>
          <input
            style={{ ...inputStyle, textAlign: 'center' }}
            type="number"
            value={imapPort}
            onChange={(e) => setImapPort(Number(e.target.value))}
          />
        </div>
      </div>

      <div style={rowStyle}>
        <div>
          <label style={labelStyle}>SMTP Host</label>
          <input
            style={inputStyle}
            value={smtpHost}
            onChange={(e) => setSmtpHost(e.target.value)}
            placeholder={isSynology ? 'nas.local' : 'smtp.example.com'}
          />
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Leave empty to use same as IMAP
          </div>
        </div>
        <div>
          <label style={labelStyle}>Port</label>
          <input
            style={{ ...inputStyle, textAlign: 'center' }}
            type="number"
            value={smtpPort}
            onChange={(e) => setSmtpPort(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Username</label>
        <input
          style={inputStyle}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={isSynology ? 'DSM username (or leave empty for email)' : 'Leave empty to use email address'}
        />
      </div>

      <div>
        <label style={labelStyle}>Password</label>
        <input
          style={inputStyle}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div>
        <label style={labelStyle}>Sync Interval</label>
        <select
          value={interval}
          onChange={(e) => setInterval(Number(e.target.value))}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value={5}>Every 5 minutes</option>
          <option value={15}>Every 15 minutes</option>
          <option value={30}>Every 30 minutes</option>
          <option value={60}>Every hour</option>
        </select>
      </div>

      {isSynology && (
        <div style={{
          fontSize: '0.6875rem', color: 'var(--text-muted)',
          padding: '6px 8px', background: 'var(--surface)',
          borderRadius: 'var(--radius-sm)', lineHeight: 1.5,
        }}>
          Use your Synology MailPlus credentials. The IMAP/SMTP host is your NAS address.
        </div>
      )}

      {error && (
        <div style={{ fontSize: '0.75rem', color: 'var(--error)', padding: '4px 0' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '6px 14px',
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-dim)', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
          }}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '6px 14px',
            background: 'var(--amber)', color: '#000',
            border: 'none', borderRadius: 'var(--radius-md)',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
            fontWeight: 500, opacity: submitting ? 0.7 : 1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {submitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          Connect
        </button>
      </div>
    </form>
  );
}
