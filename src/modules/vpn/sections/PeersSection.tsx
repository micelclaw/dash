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

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PeerCard } from '../components/PeerCard';
import { AddPeerDialog } from '../components/AddPeerDialog';
import { PeerDetailDialog } from '../components/PeerDetailDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { VpnPeer, VpnPeerConfig, VpnPeerUpdate } from '../hooks/use-vpn';
import { useI18n } from '@/i18n';

interface PeersSectionProps {
  peers: VpnPeer[];
  loading: boolean;
  showAddDialog: boolean;
  onCloseAddDialog: () => void;
  onAddPeer: (name: string, options?: Partial<VpnPeerUpdate>) => Promise<VpnPeerConfig | null>;
  onUpdatePeer: (peerId: string, update: VpnPeerUpdate) => Promise<void>;
  onTogglePeer: (peerId: string, enabled: boolean) => Promise<void>;
  onRemovePeer: (peerId: string) => Promise<void>;
  onGetPeerConfig: (peerId: string) => Promise<VpnPeerConfig | null>;
}

export function PeersSection({
  peers, loading, showAddDialog, onCloseAddDialog,
  onAddPeer, onUpdatePeer, onTogglePeer, onRemovePeer, onGetPeerConfig,
}: PeersSectionProps) {
  const { t } = useI18n();
  const [addOpen, setAddOpen] = useState(false);
  const [editPeer, setEditPeer] = useState<VpnPeer | null>(null);
  const [removePeer, setRemovePeer] = useState<VpnPeer | null>(null);
  const [configPeer, setConfigPeer] = useState<{ peer: VpnPeer; config: VpnPeerConfig } | null>(null);

  const isAddOpen = addOpen || showAddDialog;

  const handleShowConfig = async (peer: VpnPeer) => {
    const config = await onGetPeerConfig(peer.id);
    if (config) setConfigPeer({ peer, config });
  };

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: 0, fontFamily: 'var(--font-sans)' }}>
          {t('vpn.peerCount', { count: peers.length })}
        </h2>
        <button
          onClick={() => setAddOpen(true)}
          style={{
            height: 32, padding: '0 12px',
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--amber)', color: '#06060a',
            border: 'none', borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          <Plus size={14} /> {t('vpn.addPeer')}
        </button>
      </div>

      {loading && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{t('vpn.loadingPeers')}</div>
      )}

      {!loading && peers.length === 0 && (
        <div style={{
          padding: 40, textAlign: 'center',
          border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)',
          color: 'var(--text-muted)', fontSize: '0.875rem',
          fontFamily: 'var(--font-sans)',
        }}>
          {t('vpn.noPeersConfigured')}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {peers.map(peer => (
          <PeerCard
            key={peer.id}
            peer={peer}
            onEdit={() => setEditPeer(peer)}
            onShowConfig={() => handleShowConfig(peer)}
            onToggle={(enabled) => onTogglePeer(peer.id, enabled)}
            onRemove={() => setRemovePeer(peer)}
          />
        ))}
      </div>

      {/* Add Peer Dialog */}
      <AddPeerDialog
        open={isAddOpen}
        onClose={() => { setAddOpen(false); onCloseAddDialog(); }}
        onAdd={onAddPeer}
      />

      {/* Edit Peer Dialog */}
      <PeerDetailDialog
        open={!!editPeer}
        peer={editPeer}
        onClose={() => setEditPeer(null)}
        onSave={onUpdatePeer}
      />

      {/* Remove Confirmation */}
      <ConfirmDialog
        open={!!removePeer}
        onClose={() => setRemovePeer(null)}
        onConfirm={async () => {
          if (removePeer) await onRemovePeer(removePeer.id);
          setRemovePeer(null);
        }}
        title={t('vpn.removePeerConfirm', { name: removePeer?.name ?? '' })}
        description={t('vpn.removePeerDescription')}
        confirmLabel={t('vpn.remove')}
        variant="danger"
      />

      {/* Config Viewer */}
      {configPeer && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
          }}
          onClick={() => setConfigPeer(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)', width: 460, maxHeight: '80vh',
              overflow: 'auto', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                {t('vpn.configTemplate', { name: configPeer.peer.name })}
              </span>
              <button
                onClick={() => setConfigPeer(null)}
                title={t('vpn.closeMenu')}
                aria-label={t('vpn.closeMenu')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{
                fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 8,
                fontFamily: 'var(--font-sans)',
              }}>
                {t('vpn.configPrivateKeyNote', { placeholder: '<YOUR_PRIVATE_KEY>' })}
              </div>
              <pre style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: 12,
                fontFamily: 'var(--font-mono, monospace)', fontSize: '0.6875rem',
                color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5,
                margin: 0,
              }}>
                {configPeer.config.config_file}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
