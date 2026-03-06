import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  let title = 'Something went wrong';
  let message = 'An unexpected error occurred.';
  let isChunkError = false;

  if (isRouteErrorResponse(error)) {
    title = `${error.status} — ${error.statusText}`;
    message = error.data?.message || 'The requested page could not be loaded.';
  } else if (error instanceof Error) {
    // Detect Vite dynamic import / chunk load failures
    if (
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Failed to load module script') ||
      error.message.includes('Loading chunk')
    ) {
      title = 'Page failed to load';
      message = 'The module could not be loaded. This usually happens after an update. Try reloading.';
      isChunkError = true;
    } else {
      message = error.message;
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontFamily: 'var(--font-sans)',
        color: 'var(--text)',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <AlertTriangle size={40} style={{ color: 'var(--amber)' }} />

        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
          {title}
        </h2>

        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={() => {
              if (isChunkError) {
                window.location.reload();
              } else {
                navigate(0); // re-render current route
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'var(--amber)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
            {isChunkError ? 'Reload page' : 'Retry'}
          </button>

          <button
            onClick={() => navigate('/')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Home size={14} />
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
