/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import type { HealthCheck } from '../types';

interface HealthCheckListProps {
  checks: HealthCheck[];
}

const STATUS_DOT: Record<string, string> = {
  pass: '#10b981',
  warn: '#f97316',
  fail: '#f43f5e',
};

export function HealthCheckList({ checks }: HealthCheckListProps) {
  if (checks.length === 0) {
    return (
      <div style={{
        color: 'var(--text-dim)',
        fontSize: '0.8125rem',
        padding: '12px 0',
        fontFamily: 'var(--font-sans)',
      }}>
        No health checks available
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {checks.map((check, i) => (
        <div
          key={`${check.name}-${i}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {/* Status dot */}
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: STATUS_DOT[check.status] ?? '#6b7280',
            flexShrink: 0,
          }} />

          {/* Name */}
          <span style={{ color: 'var(--text)', flex: 1, minWidth: 0 }}>
            {check.name}
          </span>

          {/* Message */}
          {check.message && (
            <span style={{
              color: 'var(--text-dim)',
              fontSize: '0.75rem',
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {check.message}
            </span>
          )}

          {/* Latency */}
          {check.latency_ms != null && (
            <span style={{
              color: 'var(--text-dim)',
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-mono)',
              minWidth: 50,
              textAlign: 'right',
            }}>
              {check.latency_ms}ms
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
