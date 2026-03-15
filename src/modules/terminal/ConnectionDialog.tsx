/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useTerminalStore } from '@/stores/terminal.store';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface ConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConnect: (connectionId: string, label: string) => void;
}

type AuthMethod = 'password' | 'key' | 'agent';
type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export function ConnectionDialog({ open, onClose, onConnect }: ConnectionDialogProps) {
  const createConnection = useTerminalStore((s) => s.createConnection);
  const testConnection = useTerminalStore((s) => s.testConnection);

  const [label, setLabel] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [password, setPassword] = useState('');
  const [privateKeyPath, setPrivateKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [jumpHost, setJumpHost] = useState('');
  const [saveConnection, setSaveConnection] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState('');
  const [testLatency, setTestLatency] = useState(0);

  const reset = () => {
    setLabel(''); setHost(''); setPort('22'); setUsername('');
    setAuthMethod('password'); setPassword(''); setPrivateKeyPath('');
    setPassphrase(''); setJumpHost(''); setSaveConnection(true);
    setSubmitting(false); setTestStatus('idle'); setTestError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isValid = label.trim() && host.trim() && username.trim();

  const handleConnect = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const conn = await createConnection({
        label: label.trim(),
        host: host.trim(),
        port: parseInt(port, 10) || 22,
        username: username.trim(),
        auth_method: authMethod,
        password: authMethod === 'password' ? password : undefined,
        private_key_path: authMethod === 'key' ? privateKeyPath : undefined,
        passphrase: authMethod === 'key' && passphrase ? passphrase : undefined,
        jump_host: jumpHost.trim() || undefined,
      });
      onConnect(conn.id, conn.label);
      handleClose();
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Failed to save connection');
      setTestStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!isValid) return;
    setTestStatus('testing');
    setTestError('');
    try {
      // Save first so we can test
      const conn = await createConnection({
        label: label.trim(),
        host: host.trim(),
        port: parseInt(port, 10) || 22,
        username: username.trim(),
        auth_method: authMethod,
        password: authMethod === 'password' ? password : undefined,
        private_key_path: authMethod === 'key' ? privateKeyPath : undefined,
        passphrase: authMethod === 'key' && passphrase ? passphrase : undefined,
        jump_host: jumpHost.trim() || undefined,
      });
      const result = await testConnection(conn.id);
      if (result.success) {
        setTestStatus('success');
        setTestLatency(result.latency_ms);
      } else {
        setTestStatus('error');
        setTestError(result.error || 'Connection failed');
      }
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : 'Test failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        style={{ maxWidth: 480 }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        <DialogTitle style={{ color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
          SSH Connection
        </DialogTitle>
        <DialogDescription>
          Enter SSH connection details to connect to a remote server.
        </DialogDescription>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          {/* Label */}
          <div>
            <label style={labelStyle}>Label</label>
            <input
              style={inputStyle}
              placeholder="My Server"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          {/* Host + Port row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Host</label>
              <input
                style={inputStyle}
                placeholder="192.168.1.100"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </div>
            <div style={{ width: 80 }}>
              <label style={labelStyle}>Port</label>
              <input
                style={inputStyle}
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label style={labelStyle}>Username</label>
            <input
              style={inputStyle}
              placeholder="root"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* Auth method */}
          <div>
            <label style={labelStyle}>Authentication</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['password', 'key', 'agent'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setAuthMethod(m)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-sans)',
                    background: authMethod === m ? 'var(--amber)' : '#0e0e16',
                    color: authMethod === m ? '#06060a' : 'var(--text-muted)',
                    border: authMethod === m ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontWeight: authMethod === m ? 600 : 400,
                  }}
                >
                  {m === 'password' ? 'Password' : m === 'key' ? 'SSH Key' : 'Agent'}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional fields */}
          {authMethod === 'password' && (
            <div>
              <label style={labelStyle}>Password</label>
              <input
                style={inputStyle}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          {authMethod === 'key' && (
            <>
              <div>
                <label style={labelStyle}>Private Key Path</label>
                <input
                  style={inputStyle}
                  placeholder="~/.ssh/id_rsa"
                  value={privateKeyPath}
                  onChange={(e) => setPrivateKeyPath(e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Passphrase (optional)</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Jump host */}
          <div>
            <label style={labelStyle}>Jump Host (optional)</label>
            <input
              style={inputStyle}
              placeholder="user@jump-host:22"
              value={jumpHost}
              onChange={(e) => setJumpHost(e.target.value)}
            />
          </div>

          {/* Test result */}
          {testStatus !== 'idle' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: '#0e0e16',
              fontSize: '0.8125rem',
            }}>
              {testStatus === 'testing' && (
                <>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--amber)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Testing connection...</span>
                </>
              )}
              {testStatus === 'success' && (
                <>
                  <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                  <span style={{ color: 'var(--success)' }}>Connected ({testLatency}ms)</span>
                </>
              )}
              {testStatus === 'error' && (
                <>
                  <XCircle size={14} style={{ color: 'var(--error)' }} />
                  <span style={{ color: 'var(--error)' }}>{testError}</span>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={handleTest}
              disabled={!isValid || testStatus === 'testing'}
              style={{
                ...btnStyle,
                background: '#0e0e16',
                color: 'var(--text)',
                border: '1px solid rgba(255,255,255,0.1)',
                opacity: !isValid || testStatus === 'testing' ? 0.5 : 1,
              }}
            >
              Test
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={handleClose} style={{ ...btnStyle, background: '#0e0e16', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Cancel
            </button>
            <button
              onClick={handleConnect}
              disabled={!isValid || submitting}
              style={{
                ...btnStyle,
                background: 'var(--amber)',
                color: '#06060a',
                border: 'none',
                fontWeight: 600,
                opacity: !isValid || submitting ? 0.5 : 1,
              }}
            >
              {submitting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </DialogContent>
    </Dialog>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--text-dim)',
  marginBottom: 4,
  fontFamily: 'var(--font-sans)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-mono)',
  background: '#0e0e16',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  padding: '7px 16px',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
};
