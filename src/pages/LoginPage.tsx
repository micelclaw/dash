import { useState, useEffect, type FormEvent, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { getMockUser } from '@/services/mock';
import { ForgotPasswordModal } from './ForgotPasswordModal';

/* ── shared layout constants ─────────────────────────────────────── */

const shellStyle: CSSProperties = {
  minHeight: '100vh',
  overflow: 'hidden',
  position: 'relative',
  backgroundColor: 'var(--bg)',
};

/** Extends 70px below the viewport so `cover` always fills the visible area */
const bgStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: -70,
  left: 0,
  backgroundImage: 'url(/login_page.png)',
  backgroundSize: 'cover',
  backgroundPosition: 'right bottom',
  backgroundRepeat: 'no-repeat',
};

/* ── component ───────────────────────────────────────────────────── */

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [checkingAutoLogin, setCheckingAutoLogin] = useState(true);
  const [vw, setVw] = useState(() => window.innerWidth);
  const login = useAuthStore((s) => s.login);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const isMobile = vw < 600;
  const isNarrow = vw < 1100;

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
      <div style={shellStyle}>
        <div style={bgStyle} />
        <div
          style={{
            position: 'relative',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.875rem',
          }}
        >
          Connecting...
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={bgStyle} />
      <div
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: isMobile ? 'center' : 'flex-end',
          paddingRight: isMobile ? 16 : isNarrow ? '5%' : 'calc(10% - 70px)',
          paddingLeft: isMobile ? 16 : 0,
          paddingTop: isMobile ? 40 : 0,
          paddingBottom: isMobile ? 0 : isNarrow ? 100 : 200,
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            maxWidth: isMobile ? 'none' : 430,
            padding: isMobile ? '32px 20px' : 57,
            background: 'transparent',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.05em', textTransform: 'uppercase' }}>Micelclaw</h1>
            <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: 4 }}>
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
              style={{ display: 'block', fontSize: '0.9375rem', color: 'var(--text-muted)', marginBottom: 6 }}
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
                fontSize: '1rem',
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
              style={{ display: 'block', fontSize: '0.9375rem', color: 'var(--text-muted)', marginBottom: 6 }}
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
                fontSize: '1rem',
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
                fontSize: '0.9375rem',
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
              fontSize: '1rem',
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
    </div>
  );
}
