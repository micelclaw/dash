/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

interface StatusPillProps {
  status: 'running' | 'connected' | 'healthy' | 'pass' |
          'stopped' | 'disconnected' | 'down' | 'login_required' |
          'error' | 'fail' | 'degraded' | 'warn' |
          string;
  label?: string;
  size?: 'sm' | 'md';
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  // Green states
  running: { bg: '#10b98120', text: '#10b981', dot: '#10b981' },
  connected: { bg: '#10b98120', text: '#10b981', dot: '#10b981' },
  healthy: { bg: '#10b98120', text: '#10b981', dot: '#10b981' },
  pass: { bg: '#10b98120', text: '#10b981', dot: '#10b981' },
  available: { bg: '#10b98120', text: '#10b981', dot: '#10b981' },
  success: { bg: '#10b98120', text: '#10b981', dot: '#10b981' },
  // Yellow states
  degraded: { bg: '#f9731620', text: '#f97316', dot: '#f97316' },
  warn: { bg: '#f9731620', text: '#f97316', dot: '#f97316' },
  login_required: { bg: '#f9731620', text: '#f97316', dot: '#f97316' },
  // Red states
  error: { bg: '#f43f5e20', text: '#f43f5e', dot: '#f43f5e' },
  fail: { bg: '#f43f5e20', text: '#f43f5e', dot: '#f43f5e' },
  down: { bg: '#f43f5e20', text: '#f43f5e', dot: '#f43f5e' },
  failure: { bg: '#f43f5e20', text: '#f43f5e', dot: '#f43f5e' },
  // Blue states
  loading: { bg: '#3b82f620', text: '#60a5fa', dot: '#3b82f6' },
  unknown: { bg: '#3b82f620', text: '#60a5fa', dot: '#3b82f6' },
  // Gray states
  stopped: { bg: '#6b728020', text: '#9ca3af', dot: '#6b7280' },
  disconnected: { bg: '#6b728020', text: '#9ca3af', dot: '#6b7280' },
};

const DEFAULT_COLORS = { bg: '#6b728020', text: '#9ca3af', dot: '#6b7280' };

export function StatusPill({ status, label, size = 'sm' }: StatusPillProps) {
  const colors = STATUS_COLORS[status] ?? DEFAULT_COLORS;
  const displayLabel = label ?? status.replace(/_/g, ' ');
  const isSmall = size === 'sm';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: colors.bg,
      color: colors.text,
      borderRadius: 'var(--radius-sm)',
      padding: isSmall ? '2px 8px' : '4px 10px',
      fontSize: isSmall ? '0.6875rem' : '0.75rem',
      fontWeight: 500,
      fontFamily: 'var(--font-sans)',
      textTransform: 'capitalize',
      lineHeight: 1.4,
    }}>
      <span style={{
        width: isSmall ? 6 : 7,
        height: isSmall ? 6 : 7,
        borderRadius: '50%',
        background: colors.dot,
        flexShrink: 0,
      }} />
      {displayLabel}
    </span>
  );
}
