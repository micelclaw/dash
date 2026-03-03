import { useEffect, useState } from 'react';
import { api } from '@/services/api';

/**
 * Minimal page mounted at /oauth/callback.
 * Receives the OAuth redirect from Google/Microsoft, exchanges the code,
 * then notifies the opener window and auto-closes.
 */
export function Component() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      setErrorMsg(error === 'access_denied' ? 'Authorization was denied.' : `OAuth error: ${error}`);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setErrorMsg('Missing code or state parameter.');
      return;
    }

    // Read provider from localStorage (stashed by the opener before opening the popup)
    const stored = localStorage.getItem('claw_oauth_pending');
    const provider = stored ? JSON.parse(stored).provider : 'google';

    api.post('/sync/oauth/callback', { provider, code, state })
      .then(() => {
        setStatus('success');
        localStorage.removeItem('claw_oauth_pending');

        // Notify opener window
        if (window.opener) {
          window.opener.postMessage({ type: 'oauth_complete', status: 'connected', provider }, '*');
        }

        // Auto-close after 1.5s
        setTimeout(() => window.close(), 1500);
      })
      .catch((err: any) => {
        setStatus('error');
        setErrorMsg(err?.message || 'Failed to complete authorization.');
      });
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg)', color: 'var(--text)',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        {status === 'loading' && (
          <>
            <div style={{ fontSize: '1.25rem', marginBottom: 8 }}>Connecting...</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>
              Completing authorization...
            </div>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: '1.25rem', marginBottom: 8, color: 'var(--success)' }}>
              Connected!
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>
              You can close this window.
            </div>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: '1.25rem', marginBottom: 8, color: 'var(--error)' }}>
              Authorization Failed
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>
              {errorMsg}
            </div>
            <button
              onClick={() => window.close()}
              style={{
                marginTop: 16, padding: '6px 16px',
                background: 'var(--surface)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
