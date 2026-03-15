/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';

const CHANNEL_TYPES = [
  { value: 'telegram', label: 'Telegram', needsToken: true },
  { value: 'discord', label: 'Discord', needsToken: true },
  { value: 'slack', label: 'Slack', needsToken: true },
  { value: 'whatsapp', label: 'WhatsApp', needsToken: false },
  { value: 'signal', label: 'Signal', needsToken: false },
  { value: 'mattermost', label: 'Mattermost', needsToken: true },
  { value: 'googlechat', label: 'Google Chat', needsToken: true },
  { value: 'msteams', label: 'MS Teams', needsToken: true },
];

interface AddChannelDialogProps {
  onClose: () => void;
  onAdded: () => void;
}

export function AddChannelDialog({ onClose, onAdded }: AddChannelDialogProps) {
  const [channelType, setChannelType] = useState('telegram');
  const [name, setName] = useState('');
  const [account, setAccount] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedType = CHANNEL_TYPES.find(t => t.value === channelType);

  const handleSubmit = async () => {
    if (!channelType) return;
    setLoading(true);
    try {
      await gwService.addChannel({
        channel: channelType,
        name: name || undefined,
        account: account || undefined,
        token: token || undefined,
      });
      toast.success(`${selectedType?.label ?? channelType} channel added`);
      onAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: 440,
          padding: 24,
          margin: 16,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <h2 style={{
            fontSize: '1rem', fontWeight: 600, color: 'var(--text)',
            margin: 0, fontFamily: 'var(--font-sans)',
          }}>
            Add Channel
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
              Channel Type
            </span>
            <select
              value={channelType}
              onChange={(e) => setChannelType(e.target.value)}
              style={{
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
            >
              {CHANNEL_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
              Name (optional)
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Bot"
              style={{
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
              Account ID (optional)
            </span>
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="alerts"
              style={{
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
            />
          </label>

          {selectedType?.needsToken && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
                Bot Token
              </span>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Bot token"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
            </label>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          marginTop: 20,
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 16px',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              background: 'var(--amber)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 16px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'var(--font-sans)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Adding...' : 'Add Channel'}
          </button>
        </div>
      </div>
    </div>
  );
}
