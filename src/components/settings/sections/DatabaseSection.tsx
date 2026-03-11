import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { SettingSection } from '../SettingSection';

const REVEAL_DURATION = 30; // seconds

interface PgCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface MariaDBCredentials {
  host: string;
  port: number;
  root_password: string | null;
  databases: Record<string, { user: string; password: string }>;
}

interface CredentialsResponse {
  postgresql: PgCredentials | null;
  mariadb: MariaDBCredentials | null;
}

export function DatabaseSection() {
  const userRole = useAuthStore((s) => s.user?.role);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<CredentialsResponse | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto-hide credentials when countdown reaches 0
  useEffect(() => {
    if (countdown <= 0 && credentials) {
      setCredentials(null);
      setPassword('');
    }
  }, [countdown, credentials]);

  // Cleanup on unmount
  useEffect(() => clearTimer, [clearTimer]);

  if (userRole !== 'owner') {
    return (
      <SettingSection title="Database Credentials" description="Only the system owner can view database credentials.">
        <div style={{ padding: '16px 0', fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
          You need the <strong>owner</strong> role to access this section.
        </div>
      </SettingSection>
    );
  }

  const handleReveal = async () => {
    if (!password) {
      toast.error('Enter your password');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<CredentialsResponse>('/settings/database-credentials', { password });
      setCredentials(res);
      setCountdown(REVEAL_DURATION);
      clearTimer();
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      const msg = err?.message || 'Failed to retrieve credentials';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleHide = () => {
    clearTimer();
    setCountdown(0);
    setCredentials(null);
    setPassword('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleReveal();
  };

  return (
    <SettingSection
      title="Database Credentials"
      description="View connection details for PostgreSQL and MariaDB. Credentials are revealed for 30 seconds only."
    >
      {!credentials ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
            Enter your password to reveal database credentials:
          </div>
          <input
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="current-password"
            style={{
              height: 34,
              padding: '0 12px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontSize: '0.875rem',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleReveal}
            disabled={loading || !password}
            style={{
              height: 32,
              padding: '0 20px',
              background: loading ? 'var(--surface)' : 'var(--amber)',
              color: loading ? 'var(--text-dim)' : '#06060a',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: loading ? 'wait' : 'pointer',
              alignSelf: 'flex-start',
              opacity: !password ? 0.5 : 1,
            }}
          >
            {loading ? 'Verifying...' : 'Reveal Credentials'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Countdown bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              flex: 1,
              height: 4,
              background: 'var(--surface)',
              borderRadius: 2,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${(countdown / REVEAL_DURATION) * 100}%`,
                background: countdown <= 10 ? '#ef4444' : 'var(--amber)',
                borderRadius: 2,
                transition: 'width 1s linear, background 0.3s ease',
              }} />
            </div>
            <span style={{
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono, monospace)',
              color: countdown <= 10 ? '#ef4444' : 'var(--text-dim)',
              fontWeight: 600,
              minWidth: 28,
              textAlign: 'right',
            }}>
              {countdown}s
            </span>
            <button
              onClick={handleHide}
              style={{
                height: 26,
                padding: '0 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-dim)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
              }}
            >
              Hide
            </button>
          </div>

          {/* PostgreSQL */}
          {credentials.postgresql && (
            <CredentialBlock
              title="PostgreSQL"
              rows={[
                { label: 'Host', value: credentials.postgresql.host },
                { label: 'Port', value: String(credentials.postgresql.port) },
                { label: 'Database', value: credentials.postgresql.database },
                { label: 'User', value: credentials.postgresql.user },
                { label: 'Password', value: credentials.postgresql.password, sensitive: true },
              ]}
            />
          )}

          {/* MariaDB */}
          {credentials.mariadb && (
            <>
              <CredentialBlock
                title="MariaDB (root)"
                rows={[
                  { label: 'Host', value: credentials.mariadb.host },
                  { label: 'Port', value: String(credentials.mariadb.port) },
                  { label: 'Root Password', value: credentials.mariadb.root_password || '(not available)', sensitive: !!credentials.mariadb.root_password },
                ]}
              />
              {Object.entries(credentials.mariadb.databases).map(([dbName, entry]) => (
                <CredentialBlock
                  key={dbName}
                  title={`MariaDB — ${dbName}`}
                  rows={[
                    { label: 'Database', value: dbName },
                    { label: 'User', value: entry.user },
                    { label: 'Password', value: entry.password, sensitive: true },
                  ]}
                />
              ))}
            </>
          )}

          {!credentials.postgresql && !credentials.mariadb && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
              No database credentials found.
            </div>
          )}
        </div>
      )}
    </SettingSection>
  );
}

// ─── Credential block sub-component ──────────────────────

interface CredRow {
  label: string;
  value: string;
  sensitive?: boolean;
}

function CredentialBlock({ title, rows }: { title: string; rows: CredRow[] }) {
  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value).then(
      () => toast.success(`${label} copied`),
      () => toast.error('Failed to copy'),
    );
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px',
    }}>
      <div style={{
        fontSize: '0.8125rem',
        fontWeight: 600,
        color: 'var(--text)',
        fontFamily: 'var(--font-sans)',
        marginBottom: 8,
      }}>
        {title}
      </div>
      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-sans)',
            minWidth: 100,
            flexShrink: 0,
          }}>
            {row.label}
          </span>
          <span style={{
            fontSize: '0.8125rem',
            color: row.sensitive ? '#f59e0b' : 'var(--text)',
            fontFamily: 'var(--font-mono, monospace)',
            flex: 1,
            wordBreak: 'break-all',
          }}>
            {row.value}
          </span>
          <button
            onClick={() => handleCopy(row.value, row.label)}
            title={`Copy ${row.label}`}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: 2,
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
              opacity: 0.6,
              flexShrink: 0,
            }}
          >
            Copy
          </button>
        </div>
      ))}
    </div>
  );
}
