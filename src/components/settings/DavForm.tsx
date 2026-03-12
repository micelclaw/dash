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

interface DavFormProps {
  type: 'caldav' | 'carddav';
  preset?: Record<string, any>;
  serviceName: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function DavForm({ type, preset, serviceName, onComplete, onCancel }: DavFormProps) {
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
      const testRes = await api.post<{ data: { ok: boolean; error?: string } }>('/sync/test-connection', {
        type,
        server_url: serverUrl,
        username,
        password,
      });

      if (!testRes.data.ok) {
        setError(testRes.data.error || 'Connection failed. Check your credentials.');
        setSubmitting(false);
        return;
      }

      // Step 2: Create connector only if test passed
      await api.post('/sync/connectors', {
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
      setError(err?.message || 'Failed to connect');
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
        <label style={labelStyle}>Display Name</label>
        <input
          style={inputStyle}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={serviceName}
        />
      </div>

      <div>
        <label style={labelStyle}>Server URL</label>
        <input
          style={inputStyle}
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder={placeholder}
          required
        />
        {serviceName.includes('Synology') && (
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Use your Synology NAS address with port 5001 (HTTPS)
          </div>
        )}
      </div>

      <div>
        <label style={labelStyle}>Username</label>
        <input
          style={inputStyle}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={serviceName.includes('Synology') ? 'DSM username' : 'Username'}
          required
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
