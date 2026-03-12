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

import { useEffect, useRef } from 'react';
import { Globe, ArrowRight, ShieldCheck, Server, Terminal, X, Loader2 } from 'lucide-react';
import type { ProxyStatus, ProxyRoute, ProcessLog } from '../hooks/use-proxy';
import type { ProxySection } from '../ProxySidebar';

interface OverviewSectionProps {
  status: ProxyStatus | null;
  routes: ProxyRoute[];
  loading: boolean;
  actionInProgress: 'start' | 'stop' | null;
  processLog: ProcessLog | null;
  onClearLog: () => void;
  onNavigate: (section: ProxySection) => void;
  onStart: () => void;
  onStop: () => void;
}

export function OverviewSection({ status, routes, loading, actionInProgress, processLog, onClearLog, onNavigate, onStart, onStop }: OverviewSectionProps) {
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem',
      }}>
        Loading proxy status...
      </div>
    );
  }

  const sslColor = SSL_COLORS[status?.ssl_status ?? 'none'];

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      {/* Hero Card */}
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(59, 130, 246, 0.02))',
        padding: 24,
        marginBottom: 20,
        textAlign: 'center',
      }}>
        <Globe size={36} style={{ color: '#3b82f6', marginBottom: 12 }} />
        <h2 style={{
          fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)',
          margin: '0 0 6px', fontFamily: 'var(--font-sans)',
        }}>
          Reverse Proxy Management
        </h2>
        <p style={{
          color: 'var(--text-muted)', fontSize: '0.8125rem',
          margin: '0 0 20px', lineHeight: 1.5,
        }}>
          Manage proxy routes, SSL certificates, and DNS records through Caddy.
        </p>
        <button
          onClick={() => onNavigate('hosts')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 28px',
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: 'opacity var(--transition-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          Manage Proxy Hosts
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Status Banner */}
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${status?.running ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
        background: status?.running
          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(34, 197, 94, 0.02))'
          : 'var(--surface)',
        padding: 20,
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 12, height: 12, borderRadius: '50%',
              background: status?.running ? '#22c55e' : '#6b7280',
              boxShadow: status?.running ? '0 0 8px rgba(34, 197, 94, 0.5)' : 'none',
            }} />
            <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
              Caddy {status?.running ? 'Running' : 'Stopped'}
            </span>
          </div>
          <button
            onClick={status?.running ? onStop : onStart}
            disabled={!!actionInProgress}
            style={{
              height: 32, padding: '0 16px',
              background: actionInProgress ? 'var(--surface-hover)' : status?.running ? 'transparent' : '#22c55e',
              color: actionInProgress ? 'var(--text-muted)' : status?.running ? '#ef4444' : '#fff',
              border: status?.running ? '1px solid rgba(239, 68, 68, 0.4)' : 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: actionInProgress ? 'wait' : 'pointer',
              fontFamily: 'var(--font-sans)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {actionInProgress && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {actionInProgress ? (actionInProgress === 'start' ? 'Starting...' : 'Stopping...') : status?.running ? 'Stop' : 'Start'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <MetricItem label="Domain" value={status?.domain ?? 'Not configured'} />
          <MetricItem label="Proxy Hosts" value={String(routes.length)} />
          <MetricItem label="SSL Provider" value={formatProvider(status?.ssl_provider)} />
        </div>
      </div>

      {/* Process Log Panel */}
      {(actionInProgress || processLog) && (
        <LogPanel
          actionInProgress={actionInProgress}
          processLog={processLog}
          onClose={onClearLog}
        />
      )}

      {/* SSL + Routes summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* SSL Card */}
        <button
          onClick={() => onNavigate('ssl')}
          style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            padding: 20,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'var(--font-sans)',
            transition: 'border-color var(--transition-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ShieldCheck size={18} style={{ color: sslColor }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              SSL / Certificates
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: '0.75rem', fontWeight: 600,
              background: sslColor + '1a',
              color: sslColor,
            }}>
              {(status?.ssl_status ?? 'none').toUpperCase()}
            </span>
            {status?.ssl_expiry && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Expires {new Date(status.ssl_expiry).toLocaleDateString()}
              </span>
            )}
          </div>
        </button>

        {/* Routes summary Card */}
        <button
          onClick={() => onNavigate('hosts')}
          style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            padding: 20,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'var(--font-sans)',
            transition: 'border-color var(--transition-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Server size={18} style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              Proxy Hosts
            </span>
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>
            {routes.length}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>
            active route{routes.length !== 1 ? 's' : ''}
          </span>
        </button>
      </div>
    </div>
  );
}

const SSL_COLORS: Record<string, string> = {
  none: '#6b7280',
  pending: '#f59e0b',
  active: '#22c55e',
  expired: '#f43f5e',
};

function formatProvider(provider?: string) {
  switch (provider) {
    case 'letsencrypt': return "Let's Encrypt";
    case 'zerossl': return 'ZeroSSL';
    case 'self_signed': return 'Self-signed';
    case 'custom': return 'Custom';
    default: return 'None';
  }
}

function LogPanel({
  actionInProgress,
  processLog,
  onClose,
}: {
  actionInProgress: 'start' | 'stop' | null;
  processLog: ProcessLog | null;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [processLog, actionInProgress]);

  const isRunning = !!actionInProgress;
  const borderColor = isRunning
    ? 'rgba(59, 130, 246, 0.4)'
    : processLog?.success
      ? 'rgba(34, 197, 94, 0.4)'
      : 'rgba(239, 68, 68, 0.4)';

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${borderColor}`,
      background: 'rgba(0, 0, 0, 0.3)',
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      {/* Terminal header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'rgba(0, 0, 0, 0.2)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Terminal size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{
            fontSize: '0.75rem', fontWeight: 600,
            color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {isRunning
              ? `${actionInProgress === 'start' ? 'Starting' : 'Stopping'} Caddy...`
              : processLog?.success ? 'Completed' : 'Failed'}
          </span>
          {isRunning && (
            <Loader2 size={12} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
          )}
        </div>
        {!isRunning && (
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', padding: 2,
              cursor: 'pointer', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Log lines */}
      <div
        ref={scrollRef}
        style={{
          padding: '10px 14px',
          maxHeight: 180,
          overflowY: 'auto',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.75rem',
          lineHeight: 1.7,
        }}
      >
        {isRunning && !processLog && (
          <div style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: '#6b7280' }}>$</span> caddy {actionInProgress}...
          </div>
        )}
        {processLog?.logs.map((line, i) => (
          <div key={i} style={{
            color: line.startsWith('ERROR')
              ? '#ef4444'
              : line.startsWith('[WARN]')
                ? '#f59e0b'
                : line.startsWith('$')
                  ? '#6b7280'
                  : line.includes('successfully')
                    ? '#22c55e'
                    : 'var(--text-muted)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>
        {value}
      </div>
    </div>
  );
}
