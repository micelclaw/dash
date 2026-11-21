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
import { useI18n } from '@/i18n';

interface DavFormProps {
  type: 'caldav' | 'carddav';
  preset?: Record<string, any>;
  serviceName: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function DavForm({ type, preset, serviceName, onComplete, onCancel }: DavFormProps) {
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState(serviceName);
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [interval, setInterval] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const placeholder = type === 'caldav'
    ? `https://your-server${preset?.path_hint ?? '/caldav/'}`
    : `https://your-server${preset?.path_hint ?? '/carddav/'}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Step 1: Test connection before saving
      const testResult = await syncSvc.testConnection({
        type,
        server_url: serverUrl,
        username,
        password,
      });

      if (!testResult.ok) {
        setError(testResult.error || t('settings.forms.connectionFailed'));
        setSubmitting(false);
        return;
      }

      // Step 2: Create connector only if test passed
      await syncSvc.createConnector({
        connector_type: type,
        display_name: displayName,
        config: {
          server_url: serverUrl,
          username,
          password,
          sync_interval_minutes: interval,
        },
      });
      onComplete();
    } catch (err: any) {
      setError(err?.message || t('settings.forms.connectionFailed'));
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

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label htmlFor="dav-display-name" style={labelStyle}>{t('settings.connectors.displayName')}</label>
        <input
          id="dav-display-name"
          style={inputStyle}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={serviceName}
        />
      </div>

      <div>
        <label htmlFor="dav-server-url" style={labelStyle}>{t('settings.connectors.serverUrl')}</label>
        <input
          id="dav-server-url"
          style={inputStyle}
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder={placeholder}
          required
        />
        {serviceName.includes('Synology') && (
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {t('settings.forms.synologyAddress')}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="dav-username" style={labelStyle}>{t('settings.connectors.username')}</label>
        <input
          id="dav-username"
          style={inputStyle}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={serviceName.includes('Synology') ? t('settings.forms.dsmUsername') : t('settings.forms.username')}
          required
        />
      </div>

      <div>
        <label htmlFor="dav-password" style={labelStyle}>{t('settings.connectors.password')}</label>
        <input
          id="dav-password"
          style={inputStyle}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="dav-sync-interval" style={labelStyle}>{t('settings.connectors.syncInterval')}</label>
        <select
          id="dav-sync-interval"
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
