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
import * as syncSvc from '@/services/sync.service';
import * as emailAccountsSvc from '@/services/email-accounts.service';
import { useI18n } from '@/i18n';

interface ImapFormProps {
  preset?: Record<string, any>;
  serviceName: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function ImapForm({ preset, serviceName, onComplete, onCancel }: ImapFormProps) {
  const { t } = useI18n();
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
      const testResult = await syncSvc.testConnection({
        type: 'imap',
        host: imapHost,
        port: imapPort,
        secure: (preset?.imap_encryption ?? 'ssl') === 'ssl',
        username: username || email,
        password,
      });

      if (!testResult.ok) {
        setError(testResult.error || t('settings.forms.imapFailed'));
        setSubmitting(false);
        return;
      }

      // Step 2: Create email account + connector only if test passed
      await emailAccountsSvc.createEmailAccount({
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
      setError(err?.message || t('settings.forms.createEmailFailed'));
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
        <label htmlFor="imap-account-name" style={labelStyle}>{t('settings.forms.accountName')}</label>
        <input id="imap-account-name" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div>
        <label htmlFor="imap-email" style={labelStyle}>{t('settings.forms.emailAddress')}</label>
        <input
          id="imap-email"
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
          <label htmlFor="imap-host" style={labelStyle}>{t('settings.forms.imapHost')}</label>
          <input
            id="imap-host"
            style={inputStyle}
            value={imapHost}
            onChange={(e) => setImapHost(e.target.value)}
            placeholder={isSynology ? 'nas.local' : t('settings.forms.imapHostPlaceholder')}
            required
          />
        </div>
        <div>
          <label htmlFor="imap-port" style={labelStyle}>{t('settings.forms.port')}</label>
          <input
            id="imap-port"
            style={{ ...inputStyle, textAlign: 'center' }}
            type="number"
            value={imapPort}
            onChange={(e) => setImapPort(Number(e.target.value))}
          />
        </div>
      </div>

      <div style={rowStyle}>
        <div>
          <label htmlFor="smtp-host" style={labelStyle}>{t('settings.forms.smtpHost')}</label>
          <input
            id="smtp-host"
            style={inputStyle}
            value={smtpHost}
            onChange={(e) => setSmtpHost(e.target.value)}
            placeholder={isSynology ? 'nas.local' : t('settings.forms.smtpHostPlaceholder')}
          />
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {t('settings.forms.sameAsImap')}
          </div>
        </div>
        <div>
          <label htmlFor="smtp-port" style={labelStyle}>{t('settings.forms.port')}</label>
          <input
            id="smtp-port"
            style={{ ...inputStyle, textAlign: 'center' }}
            type="number"
            value={smtpPort}
            onChange={(e) => setSmtpPort(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <label htmlFor="imap-username" style={labelStyle}>{t('settings.connectors.username')}</label>
        <input
          id="imap-username"
          style={inputStyle}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={isSynology ? t('settings.forms.dsmUsernameOrEmail') : t('settings.forms.usernameOrEmail')}
        />
      </div>

      <div>
        <label htmlFor="imap-password" style={labelStyle}>{t('settings.connectors.password')}</label>
        <input
          id="imap-password"
          style={inputStyle}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="imap-sync-interval" style={labelStyle}>{t('settings.connectors.syncInterval')}</label>
        <select
          id="imap-sync-interval"
          value={interval}
          onChange={(e) => setInterval(Number(e.target.value))}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value={5}>{t('settings.forms.everyFiveMinutes')}</option>
          <option value={15}>{t('settings.forms.everyFifteenMinutes')}</option>
          <option value={30}>{t('settings.forms.everyThirtyMinutes')}</option>
          <option value={60}>{t('settings.connectors.everyHour')}</option>
        </select>
      </div>

      {isSynology && (
        <div style={{
          fontSize: '0.6875rem', color: 'var(--text-muted)',
          padding: '6px 8px', background: 'var(--surface)',
          borderRadius: 'var(--radius-sm)', lineHeight: 1.5,
        }}>
          {t('settings.forms.synologyCredentials')}
        </div>
      )}

      {error && (
        <div role="alert" style={{ fontSize: '0.75rem', color: 'var(--error)', padding: '4px 0' }}>
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
          {t('settings.forms.back')}
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
          {t('settings.forms.connect')}
        </button>
      </div>
    </form>
  );
}
