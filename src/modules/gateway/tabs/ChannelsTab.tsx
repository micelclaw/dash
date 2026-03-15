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

import { useEffect, useState } from 'react';
import {
  Plus, LogIn, LogOut, Trash2, RefreshCw,
  MessageCircle, Hash, Send, Phone, Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-media-query';
import { useGatewayStore } from '@/stores/gateway.store';
import * as gwService from '@/services/gateway.service';
import { StatusPill } from '../components/StatusPill';
import { AddChannelDialog } from '../components/AddChannelDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GatewayChannel } from '../types';

const CHANNEL_ICONS: Record<string, typeof MessageCircle> = {
  telegram: Send,
  discord: Hash,
  whatsapp: Phone,
  signal: Shield,
  slack: MessageCircle,
  mattermost: MessageCircle,
  googlechat: MessageCircle,
  imessage: MessageCircle,
  msteams: MessageCircle,
  webchat: MessageCircle,
  rest: MessageCircle,
};

const CHANNEL_COLORS: Record<string, string> = {
  telegram: '#26A5E4',
  discord: '#5865F2',
  whatsapp: '#25D366',
  signal: '#3A76F0',
  slack: '#E01E5A',
  mattermost: '#0058CC',
};

export function ChannelsTab() {
  const isMobile = useIsMobile();
  const { channels, channelsLoading, channelsError, fetchChannels } = useGatewayStore();
  const [showAdd, setShowAdd] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [refreshHover, setRefreshHover] = useState(false);

  useEffect(() => {
    if (channels.length === 0) fetchChannels();
  }, [channels.length, fetchChannels]);

  const handleLogin = async (ch: GatewayChannel) => {
    const key = `login-${ch.type}-${ch.account}`;
    setActionLoading(key);
    try {
      await gwService.loginChannel(ch.type, ch.account);
      toast.success(`Logged in to ${ch.type}`);
      fetchChannels();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async (ch: GatewayChannel) => {
    const key = `logout-${ch.type}-${ch.account}`;
    setActionLoading(key);
    try {
      await gwService.logoutChannel(ch.type, ch.account);
      toast.success(`Logged out of ${ch.type}`);
      fetchChannels();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Logout failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (ch: GatewayChannel) => {
    if (!confirm(`Remove ${ch.name || ch.type} channel?`)) return;
    setActionLoading(`remove-${ch.type}-${ch.account}`);
    try {
      await gwService.removeChannel(ch.type, ch.account);
      toast.success(`Channel ${ch.type} removed`);
      fetchChannels();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (channelsLoading && channels.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-dim)', fontSize: '0.875rem',
      }}>
        Loading channels...
      </div>
    );
  }

  if (channelsError) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--error)', fontSize: '0.875rem',
      }}>
        {channelsError}
      </div>
    );
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div style={{ padding: isMobile ? 12 : 20, maxWidth: 1100 }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <span style={{
            fontSize: '0.8125rem', color: 'var(--text-dim)',
            fontFamily: 'var(--font-sans)',
          }}>
            {channels.length} channel{channels.length !== 1 ? 's' : ''} configured
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => fetchChannels()}
              onMouseEnter={() => setRefreshHover(true)}
              onMouseLeave={() => setRefreshHover(false)}
              style={{
                background: refreshHover ? 'var(--surface-hover)' : 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 8px',
                cursor: 'pointer',
                color: 'var(--text-dim)',
                transition: 'var(--transition-fast)',
                display: 'flex', alignItems: 'center',
              }}
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setShowAdd(true)}
              style={{
                background: 'var(--amber)',
                color: '#000',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 14px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Plus size={14} />
              Add Channel
            </button>
          </div>
        </div>

        {/* Channel list */}
        {channels.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: 60, gap: 12,
          }}>
            <MessageCircle size={40} style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
            <span style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>
              No channels configured
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {channels.map((ch) => {
              const key = `${ch.type}-${ch.account}`;
              const Icon = CHANNEL_ICONS[ch.type] ?? MessageCircle;
              const channelColor = CHANNEL_COLORS[ch.type] ?? 'var(--text-dim)';
              const isHovered = hoveredRow === key;

              return (
                <div
                  key={key}
                  onMouseEnter={() => setHoveredRow(key)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 14px',
                    background: isHovered ? 'var(--surface-hover)' : 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    transition: 'var(--transition-fast)',
                    flexWrap: isMobile ? 'wrap' : undefined,
                  }}
                >
                  {/* Channel icon */}
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: 'var(--radius-sm)',
                    background: `${channelColor}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={16} style={{ color: channelColor }} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{
                        fontSize: '0.875rem', fontWeight: 500,
                        color: 'var(--text)', fontFamily: 'var(--font-sans)',
                        textTransform: 'capitalize',
                      }}>
                        {ch.name || ch.type}
                      </span>
                      <StatusPill status={ch.status} />
                    </div>
                    <div style={{
                      fontSize: '0.75rem', color: 'var(--text-dim)',
                      fontFamily: 'var(--font-sans)', marginTop: 2,
                    }}>
                      {ch.account && <span>{ch.account}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{
                    display: 'flex', gap: 4,
                    ...(isMobile ? { width: '100%', justifyContent: 'flex-end', marginTop: 4 } : {}),
                  }}>
                    {ch.status === 'login_required' || ch.status === 'disconnected' ? (
                      <SmallButton
                        icon={LogIn}
                        label="Login"
                        onClick={() => handleLogin(ch)}
                        loading={actionLoading === `login-${ch.type}-${ch.account}`}
                      />
                    ) : ch.status === 'connected' ? (
                      <SmallButton
                        icon={LogOut}
                        label="Logout"
                        onClick={() => handleLogout(ch)}
                        loading={actionLoading === `logout-${ch.type}-${ch.account}`}
                      />
                    ) : null}
                    <SmallButton
                      icon={Trash2}
                      label="Remove"
                      onClick={() => handleRemove(ch)}
                      loading={actionLoading === `remove-${ch.type}-${ch.account}`}
                      danger
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <AddChannelDialog
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            fetchChannels();
            setShowAdd(false);
          }}
        />
      )}
    </ScrollArea>
  );
}

// ─── Small Action Button ────────────────────────────────────────────

function SmallButton({ icon: Icon, label, onClick, loading, danger }: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  loading?: boolean;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const color = danger ? 'var(--error)' : 'var(--text-dim)';

  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      style={{
        background: hovered ? (danger ? '#f43f5e15' : 'var(--surface-hover)') : 'transparent',
        color,
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 8px',
        fontSize: '0.75rem',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
        display: 'flex', alignItems: 'center', gap: 4,
        opacity: loading ? 0.5 : 1,
      }}
    >
      <Icon size={12} />
      {!loading ? label : '...'}
    </button>
  );
}
