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
import { Play, Square, Cpu, Loader2, Wrench, Download, ChevronDown, ChevronRight, Network, BarChart3, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';
import { CryptoLogs } from '../shared/CryptoLogs';
import { formatBytes, formatDifficulty, formatRelativeTime, formatUptime, formatXmr, formatMoneroVersion, truncateId } from '../shared/crypto-formatters';
import { UpdateCheck } from '../shared/UpdateCheck';
import { useI18n } from '@/i18n';

interface MoneroSync {
  height: number;
  target_height: number;
  synced: boolean;
  pruned: boolean;
  size_on_disk_bytes: number;
  peers_in: number;
  peers_out: number;
  uptime_seconds: number | null;
}

interface MoneroExtendedStats {
  version: string;
  difficulty: number;
  tx_count: number;
  tx_pool_size: number;
  white_peerlist_size: number;
  grey_peerlist_size: number;
  free_space: number;
  last_block_hash: string;
  last_block_time: number;
  last_block_size: number;
  last_block_txs: number;
  last_block_reward: number;
  fee_per_byte: number | null;
}

interface MoneroPeerInfo {
  address: string;
  host: string;
  port: number;
  state: string;
  incoming: boolean;
  height: number;
  live_time: number;
  avg_download: number;
  avg_upload: number;
  recv_count: number;
  send_count: number;
}

interface ServiceStatus {
  name: string;
  display_name: string;
  installed: boolean;
  running: boolean;
  ram_mb: number | null;
  uptime_seconds: number | null;
  phase: string;
}

interface Props {
  svc: ServiceStatus | null;
  sync: MoneroSync | null;
  extended: MoneroExtendedStats | null;
  loading?: boolean;
  starting?: boolean;
  onInstall: () => void;
  onStart: () => void;
  onStop: () => void;
  onConfigure: () => void;
}

function formatFeePerByte(fee: number | null, locale: string): string {
  if (fee == null) return 'N/A';
  // fee is in atomic units (piconero) per byte
  // Convert to nanonero/byte for readability: 1 nanonero = 1000 piconero
  const nano = fee / 1000;
  if (nano >= 1) return `${nano.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} nano/B`;
  return `${fee} pico/B`;
}

function formatPeerTime(seconds: number, t: (key: string, values?: Record<string, string | number>) => string): string {
  if (seconds < 3600) return t('crypto.duration.minutes', { count: Math.floor(seconds / 60) });
  if (seconds < 86400) return t('crypto.duration.hours', { count: Math.floor(seconds / 3600) });
  return t('crypto.duration.days', { count: Math.floor(seconds / 86400) });
}

export function MoneroNodeCard({ svc, sync, extended, loading, starting, onInstall, onStart, onStop, onConfigure }: Props) {
  const { t, locale } = useI18n();
  const formatCount = (value: number) => value.toLocaleString(locale === 'es' ? 'es-ES' : 'en-US');
  const running = svc?.running ?? false;
  const installed = svc?.installed ?? false;
  const phase = svc?.phase ?? 'stopped';
  const progress = sync && sync.target_height > 0
    ? Math.round((sync.height / sync.target_height) * 100 * 100) / 100
    : 0;

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [peers, setPeers] = useState<MoneroPeerInfo[] | null>(null);
  const [peersLoading, setPeersLoading] = useState(false);

  const toggleSection = (name: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const fetchPeers = async () => {
    setPeersLoading(true);
    try {
      const res = await api.get<{ data: MoneroPeerInfo[] }>('/crypto/monero/peers');
      setPeers(res.data);
    } catch {
      setPeers([]);
    } finally {
      setPeersLoading(false);
    }
  };

  const ext = extended;
  const hasExtended = !!ext && running;

  return (
    <div className="crypto-card">
      <div className="crypto-card-header">
        <div className="crypto-card-dot" style={{ background: loading && !svc ? 'var(--text-muted)' : running ? (sync?.synced ? '#22c55e' : '#f59e0b') : installed ? '#f59e0b' : '#ef4444' }} />
        <span className="crypto-card-title">{t('crypto.moneroNode')}</span>
        {!loading && <span className="crypto-card-phase">{phase === 'stopped' ? t('crypto.status.stopped') : phase}</span>}
        <div style={{ flex: 1 }} />
        {!loading && installed && (
          <button className="crypto-btn-sm" onClick={onConfigure} title={t('crypto.configure')} aria-label={t('crypto.configure')}><Wrench size={12} /></button>
        )}
        {!loading && installed && (running ? (
          <button className="crypto-btn-sm" onClick={onStop} title={t('crypto.stop')} aria-label={t('crypto.stop')}><Square size={12} /></button>
        ) : (
          <button className="crypto-btn-sm" onClick={onStart} title={t('crypto.start')} aria-label={t('crypto.start')}>
            <Play size={12} />
          </button>
        ))}
      </div>

      {!loading && !installed && (
        <div className="crypto-card-body">
          <button className="crypto-install-btn" onClick={onInstall}>
            <Download size={14} /> {t('crypto.installMonero')}
          </button>
        </div>
      )}

      {sync && !sync.synced && (
        <div className="crypto-card-body">
          <div className="btc-ibd-banner">
            <div className="btc-ibd-title">
              <Loader2 size={13} className="spin" style={{ color: '#f97316' }} />
              <span>{t('crypto.syncingChain')}</span>
            </div>
            <div className="btc-ibd-pct" style={{ color: '#f97316' }}>{progress}%</div>
          </div>
          <div className="crypto-progress-wrap" style={{ marginTop: 8 }}>
            <div className="crypto-progress-bar" style={{ width: `${Math.min(progress, 100)}%`, background: '#f97316' }} />
          </div>
          <div className="crypto-card-stats" style={{ marginTop: 10 }}>
            <div><span className="dim">{t('crypto.height')}</span> {formatCount(sync.height)} / {formatCount(sync.target_height)}</div>
            <div><span className="dim">{t('crypto.peers')}</span> {t('crypto.inbound')}: {formatCount(sync.peers_in)} · {t('crypto.outbound')}: {formatCount(sync.peers_out)}</div>
            <div><span className="dim">{t('crypto.prunedStatus')}</span> {sync.pruned ? t('crypto.yes') : t('crypto.no')}</div>
            <div><span className="dim">{t('crypto.disk')}</span> {formatBytes(sync.size_on_disk_bytes, locale)}</div>
            <div><span className="dim">{t('crypto.uptime')}</span> {formatUptime(sync.uptime_seconds ?? svc?.uptime_seconds ?? null, locale)}</div>
          </div>
          {svc?.ram_mb != null && (
            <div className="crypto-card-ram">
              <Cpu size={11} /> {svc.ram_mb} MB
            </div>
          )}
          <CryptoLogs service="monerod" active />
        </div>
      )}

      {sync && sync.synced && (
        <div className="crypto-card-body">
          <div className="crypto-card-stats">
            <div><span className="dim">{t('crypto.height')}</span> {formatCount(sync.height)} / {formatCount(sync.target_height)}</div>
            <div><span className="dim">{t('crypto.peers')}</span> {t('crypto.inbound')}: {formatCount(sync.peers_in)} · {t('crypto.outbound')}: {formatCount(sync.peers_out)}</div>
            <div><span className="dim">{t('crypto.prunedStatus')}</span> {sync.pruned ? t('crypto.yes') : t('crypto.no')}</div>
            <div><span className="dim">{t('crypto.disk')}</span> {formatBytes(sync.size_on_disk_bytes, locale)}</div>
            <div><span className="dim">{t('crypto.uptime')}</span> {formatUptime(sync.uptime_seconds ?? svc?.uptime_seconds ?? null, locale)}</div>
          </div>
          {svc?.ram_mb != null && (
            <div className="crypto-card-ram">
              <Cpu size={11} /> {svc.ram_mb} MB
            </div>
          )}
        </div>
      )}

      {/* ─── Extended Stats Summary ─── */}
      {hasExtended && (
        <div className="btc-ext-summary">
          <span>{t('crypto.mempool')}: {formatCount(ext.tx_pool_size)} {t('crypto.transactionsShort')}</span>
          {sync?.synced && ext.fee_per_byte != null && <span>{t('crypto.fee')}: {formatFeePerByte(ext.fee_per_byte, locale === 'es' ? 'es-ES' : 'en-US')}</span>}
        </div>
      )}

      {/* ─── Collapsible: Network ─── */}
      {hasExtended && (
        <div className="btc-ext-section">
          <button className="btc-ext-toggle" onClick={() => { toggleSection('network'); if (!expandedSections.has('network') && !peers) fetchPeers(); }}>
            {expandedSections.has('network') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Network size={12} /> {t('crypto.network')}
          </button>
          {expandedSections.has('network') && (
            <div className="btc-ext-content">
              <div className="crypto-card-stats">
                {ext.version ? <div><span className="dim">{t('crypto.version')}</span> {formatMoneroVersion(ext.version)}</div> : null}
                <div><span className="dim">{t('crypto.inbound')}</span> {formatCount(sync?.peers_in ?? 0)}</div>
                <div><span className="dim">{t('crypto.outbound')}</span> {formatCount(sync?.peers_out ?? 0)}</div>
                {ext.white_peerlist_size > 0 && <div><span className="dim">{t('crypto.knownWhite')}</span> {formatCount(ext.white_peerlist_size)}</div>}
                {ext.grey_peerlist_size > 0 && <div><span className="dim">{t('crypto.knownGrey')}</span> {formatCount(ext.grey_peerlist_size)}</div>}
              </div>

              {/* Peer list */}
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('crypto.peers')} {peers ? `(${formatCount(peers.length)})` : ''}
                </span>
                <button className="btc-ext-action-btn" onClick={fetchPeers} title={t('crypto.refresh')} aria-label={t('crypto.refresh')}><RefreshCw size={11} /></button>
              </div>

              {peersLoading && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}><Loader2 size={11} className="spin" /> {t('crypto.loadingEllipsis')}</div>}

              {peers && peers.length > 0 && (
                <div className="btc-peer-list">
                  {peers.map((p, i) => (
                    <div key={`${p.address}-${i}`} className="btc-peer-row">
                      <span className="btc-peer-addr">{p.address}</span>
                      <span className="btc-peer-tag" style={{
                        background: p.incoming ? 'rgba(59,130,246,.15)' : 'rgba(34,197,94,.15)',
                        color: p.incoming ? '#3b82f6' : '#22c55e',
                      }}>
                        {p.incoming ? 'in' : 'out'}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('crypto.height')}: {formatCount(p.height)}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatPeerTime(p.live_time, t)}</span>
                      <span className="btc-peer-ver">{p.state}</span>
                    </div>
                  ))}
                </div>
              )}
              {peers && peers.length === 0 && !peersLoading && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('crypto.noPeers')}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Collapsible: Chain ─── */}
      {hasExtended && (
        <div className="btc-ext-section">
          <button className="btc-ext-toggle" onClick={() => toggleSection('chain')}>
            {expandedSections.has('chain') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <BarChart3 size={12} /> {t('crypto.chain')}
          </button>
          {expandedSections.has('chain') && (
            <div className="btc-ext-content">
              <div className="crypto-card-stats">
            <div><span className="dim">{t('crypto.difficulty')}</span> {formatDifficulty(ext.difficulty, locale)}</div>
                <div><span className="dim">{t('crypto.totalTransactions')}</span> {formatCount(ext.tx_count)}</div>
                <div><span className="dim">{t('crypto.lastBlock')}</span> {formatRelativeTime(ext.last_block_time, locale)}</div>
                <div><span className="dim">{t('crypto.blockTransactions')}</span> {formatCount(ext.last_block_txs)}</div>
                <div><span className="dim">{t('crypto.blockSize')}</span> {formatBytes(ext.last_block_size, locale)}</div>
                <div><span className="dim">{t('crypto.reward')}</span> {formatXmr(ext.last_block_reward, locale)}</div>
                {ext.last_block_hash && <div><span className="dim">{t('crypto.blockHash')}</span> {truncateId(ext.last_block_hash, 8)}</div>}
                {ext.free_space > 0 && <div><span className="dim">{t('crypto.freeSpace')}</span> {formatBytes(ext.free_space, locale)}</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {loading && !svc && (
        <div className="crypto-card-body">
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={12} className="spin" /> {t('crypto.checking')}
          </span>
        </div>
      )}

      {!loading && !sync && (running || starting) && (
        <div className="crypto-card-body">
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={12} className="spin" /> {t('crypto.sync.startingUp')}
          </span>
          <CryptoLogs service="monerod" active />
        </div>
      )}

      {!loading && !running && !sync && installed && (
        <div className="crypto-card-body">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('crypto.status.stopped')}</span>
        </div>
      )}

      <UpdateCheck service="monerod" installed={installed} loading={!!loading} />
    </div>
  );
}
