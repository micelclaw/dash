import { useEffect, useState } from 'react';

/**
 * OAuth callback page — receives redirect from Google/Microsoft.
 * Passes code+state back to the opener window via postMessage.
 * The opener (AddIntegrationModal) handles the actual API call
 * since it has the authenticated session.
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

    // Read provider from localStorage
    const stored = localStorage.getItem('claw_oauth_pending');
    const provider = stored ? JSON.parse(stored).provider : 'google';

    // Send code+state back to opener — the opener will do the API call
    if (window.opener) {
      window.opener.postMessage({
        type: 'oauth_callback',
        provider,
        code,
        state,
      }, '*');
      setStatus('success');
      setTimeout(() => window.close(), 1000);
    } else {
      setStatus('error');
      setErrorMsg('No opener window found. Please try again from Settings.');
    }
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg)', color: 'var(--text)',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        {status === 'loading' && (
          <div style={{ fontSize: '1.25rem' }}>Connecting...</div>
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
