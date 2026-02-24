import { useState, type FormEvent } from 'react';
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
  const login = useAuthStore((s) => s.login);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

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
      navigate('/', { replace: true });
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 380,
          padding: 32,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
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
