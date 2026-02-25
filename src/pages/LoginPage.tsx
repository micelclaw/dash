import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { getMockUser } from '@/services/mock';
import { ForgotPasswordModal } from './ForgotPasswordModal';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [checkingAutoLogin, setCheckingAutoLogin] = useState(true);
  const login = useAuthStore((s) => s.login);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  // Auto-login for single_user mode (skip if user explicitly logged out)
  useEffect(() => {
    const useMock = import.meta.env.VITE_MOCK_API === 'true';
    if (useMock) {
      setCheckingAutoLogin(false);
      return;
    }

    if (sessionStorage.getItem('claw-explicit-logout')) {
      setCheckingAutoLogin(false);
      return;
    }

    const baseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:7200';
    fetch(`${baseUrl}/api/v1/auth/status`)
      .then((r) => r.json())
      .then((res) => {
        const { mode, auto_login, access_token, user } = res.data ?? {};
        if (mode === 'single_user' && auto_login && access_token && user) {
          setAuth(
            { id: user.id, email: user.email ?? '', display_name: user.display_name, role: user.role, tier: res.tier ?? 'free' },
            { accessToken: access_token, refreshToken: '' },
          );
          navigate('/', { replace: true });
          return;
        }
        setCheckingAutoLogin(false);
      })
      .catch(() => {
        setCheckingAutoLogin(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const useMock = import.meta.env.VITE_MOCK_API === 'true';
      if (useMock) {
        const user = getMockUser();
        setAuth(user, { accessToken: 'mock-token', refreshToken: 'mock-refresh' });
      } else {
        await login(email, password);
      }
      sessionStorage.removeItem('claw-explicit-logout');
      navigate('/', { replace: true });
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (checkingAutoLogin) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: 'url(/login_page.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: 'var(--bg)',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.875rem',
        }}
      >
        Connecting...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'url(/login_page.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: 'var(--bg)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 380,
          padding: 32,
          background: 'rgba(12, 12, 16, 0.75)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🐾</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text)' }}>Micelclaw</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)', marginTop: 4 }}>
            Sign in to your account
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              marginBottom: 16,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(244, 63, 94, 0.1)',
              color: 'var(--error)',
              fontSize: '0.8125rem',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="email"
            style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-dim)', marginBottom: 6 }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            style={{
              width: '100%',
              height: 32,
              padding: '0 10px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text)',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color var(--transition-fast)',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="password"
            style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-dim)', marginBottom: 6 }}
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            style={{
              width: '100%',
              height: 32,
              padding: '0 10px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text)',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color var(--transition-fast)',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          <button
            type="button"
            onClick={() => setShowForgot(true)}
            style={{
              display: 'block',
              marginTop: 6,
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'var(--amber)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              padding: 0,
            }}
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            height: 36,
            background: loading ? 'var(--text-muted)' : 'var(--amber)',
            color: '#06060a',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.background = 'var(--amber-hover)';
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.background = 'var(--amber)';
          }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <ForgotPasswordModal open={showForgot} onClose={() => setShowForgot(false)} />
    </div>
  );
}
