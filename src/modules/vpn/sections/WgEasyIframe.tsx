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

import { useEffect, useMemo, useRef } from 'react';
import { Cable, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import type { WgEasyStatus } from '../hooks/use-wg-easy';

interface WgEasyIframeProps {
  status: WgEasyStatus | null;
  loading: boolean;
  starting: boolean;
  onStart: () => void;
}

export function WgEasyIframe({ status, loading, starting, onStart }: WgEasyIframeProps) {
  // Auto-start once when not installed (via useEffect, not during render)
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!loading && !starting && status && !status.installed && !autoStarted.current) {
      autoStarted.current = true;
      onStart();
    }
  }, [loading, starting, status, onStart]);

  // Loading state
  if (loading) {
    return (
      <CenteredState>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14 }}>Checking WireGuard panel...</span>
        <SpinKeyframes />
      </CenteredState>
    );
  }

  // Starting / installing
  if (starting) {
    return (
      <CenteredState>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--amber)' }} />
        <span style={{ fontSize: 14 }}>Setting up WireGuard panel...</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          This may take a moment on first launch
        </span>
        <SpinKeyframes />
      </CenteredState>
    );
  }

  // Not running (installed or not)
  if (!status?.running) {
    return (
      <CenteredState>
        <AlertTriangle size={32} style={{ color: 'var(--amber)' }} />
        <span style={{ fontSize: 14 }}>
          {status?.installed ? 'WireGuard panel is not running' : 'WireGuard panel is not installed'}
        </span>
        <button
          onClick={onStart}
          style={{
            marginTop: 8,
            padding: '8px 20px',
            background: 'var(--amber)',
            color: '#06060a',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
          }}
        >
          {status?.installed ? 'Start WireGuard Panel' : 'Install & Start WireGuard Panel'}
        </button>
      </CenteredState>
    );
  }

  // Stable cache-buster (generated once per mount)
  const iframeSrc = useMemo(
    () => status?.url ? `${status.url}?_v=${Date.now()}` : null,
    [status?.url],
  );

  // Ready — show iframe
  if (iframeSrc) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Header bar */}
        <div style={{
          height: 36,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          gap: 8,
          fontSize: 12,
          color: 'var(--text-dim)',
          flexShrink: 0,
        }}>
          <Cable size={14} style={{ color: '#7c3aed' }} />
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>WireGuard</span>
          <span style={{ color: 'var(--text-muted)' }}>VPN Management</span>
          <div style={{ flex: 1 }} />
          {status.ram_mb != null && (
            <span style={{ color: 'var(--text-muted)' }}>RAM: {status.ram_mb} MB</span>
          )}
          <a
            href={status.url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            title="Open in new tab"
          >
            <ExternalLink size={13} />
          </a>
        </div>
        {/* Iframe */}
        <iframe
          src={iframeSrc}
          title="WireGuard VPN Management"
          style={{ flex: 1, border: 'none', background: '#fff' }}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    );
  }

  return null;
}

function CenteredState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      color: 'var(--text-dim)',
      background: 'var(--bg)',
    }}>
      {children}
    </div>
  );
}

function SpinKeyframes() {
  return <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>;
}
