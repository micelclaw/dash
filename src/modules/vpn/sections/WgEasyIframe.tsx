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
import { Cable, Loader2, AlertTriangle } from 'lucide-react';
import type { WgEasyStatus } from '../hooks/use-wg-easy';
import { useEmbedFullscreen } from '@/hooks/use-embed-fullscreen';
import { EmbedActions } from '@/components/shared/EmbedActions';

interface WgEasyIframeProps {
  status: WgEasyStatus | null;
  loading: boolean;
  starting: boolean;
  onStart: () => void;
}

export function WgEasyIframe({ status, loading, starting, onStart }: WgEasyIframeProps) {
  const { fullscreen, toggle, rootStyle } = useEmbedFullscreen();
  // Auto-start once when not installed (via useEffect, not during render)
  const autoStarted = useRef(false);
  // Hooks must be called on every render. `status.running` changes as the
  // start request completes, so placing this below the stopped/loading early
  // returns made React see a new hook and send the user to the error boundary.
  const iframeSrc = useMemo(
    () => status?.url ? `${status.url}?_v=${Date.now()}` : null,
    [status?.url],
  );
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

  // Ready — show iframe
  if (iframeSrc) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', ...rootStyle }}>
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
          <EmbedActions
            slug="wg-easy" fallbackUrl={status.url ?? ''} ramMb={status.ram_mb}
            fullscreen={fullscreen} onToggleFullscreen={toggle}
          />
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
