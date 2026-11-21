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
import { Play, Square, Cpu, Loader2, Wrench, Download, RefreshCw, ChevronDown, ChevronRight, Plus, Ban, Network, Activity, BarChart3 } from 'lucide-react';
import { api } from '@/services/api';
import { CryptoLogs } from '../shared/CryptoLogs';
import { formatBytes, formatEta, formatUptime, formatHashRate, formatDifficulty, formatSatVB, formatRelativeTime, formatTraffic } from '../shared/crypto-formatters';
import { UpdateCheck } from '../shared/UpdateCheck';
import { useI18n } from '@/i18n';

interface BtcSync {
  chain: string;
  blocks: number;
  headers: number;
  verification_progress: number;
  synced: boolean;
  pruned: boolean;
  prune_target_mb: number | null;
  size_on_disk_bytes: number;
  peers: number;
  estimated_time_remaining_s: number | null;
  uptime_seconds: number | null;
}

interface BtcExtendedStats {
  mempool_tx_count: number;
  mempool_size_bytes: number;
  mempool_min_fee: number;
  difficulty: number;
  network_hashps: number;
  total_bytes_recv: number;
  total_bytes_sent: number;
  fee_rate_sat_vb: number | null;
  latest_block_hash: string;
  latest_block_time: number;
  latest_block_tx_count: number;
  latest_block_size: number;
  indexes: Record<string, { synced: boolean; best_block_height: number }>;
  connections_in: number;
  connections_out: number;
  version: number;
  subversion: string;
}

interface BtcPeerInfo {
  id: number;
  addr: string;
  subver: string;
  pingtime: number | null;
  bytessent: number;
  bytesrecv: number;
  conntime: number;
  inbound: boolean;
  synced_headers: number;
  synced_blocks: number;
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
  sync: BtcSync | null;
  extended: BtcExtendedStats | null;
  loading?: boolean;
  starting?: boolean;
  onInstall: () => void;
  onStart: () => void;
  onStop: () => void;
  onConfigure: () => void;
}

function getPhaseLabel(phase: string, sync: BtcSync | null, running: boolean, t: (key: string) => string): string {
  if (!running) return phase === 'stopped' ? t('crypto.status.stopped') : phase;
  if (!sync) return t('crypto.phase.starting');
  if (sync.synced) return t('crypto.phase.synced');
  return t('crypto.phase.initialDownload');
}

function formatBlockDate(sync: BtcSync, t: (key: string) => string): string | null {
  if (sync.synced) return null;
  const pct = sync.verification_progress * 100;
  if (pct < 1) return t('crypto.sync.processingHistory');
  if (pct < 50) return t('crypto.sync.downloading');
  if (pct < 95) return t('crypto.sync.catchingUp');
  return t('crypto.sync.almost');
}

function formatVersion(v: number): string {
  const major = Math.floor(v / 10000);
  const minor = Math.floor((v % 10000) / 100);
  const patch = v % 100;
  return patch ? `${major}.${minor}.${patch}` : `${major}.${minor}`;
}

export function BtcStatusCard({ svc, sync, extended, loading, starting, onInstall, onStart, onStop, onConfigure }: Props) {
  const { t, locale } = useI18n();
  const running = svc?.running ?? false;
  const installed = svc?.installed ?? false;
  const phase = svc?.phase ?? 'stopped';
  const progress = sync ? Math.round(sync.verification_progress * 100 * 100) / 100 : 0;
  const phaseLabel = getPhaseLabel(phase, sync, running, t);
  const formatCount = (value: number) => value.toLocaleString(locale === 'es' ? 'es-ES' : 'en-US');

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [peers, setPeers] = useState<BtcPeerInfo[] | null>(null);
  const [peersLoading, setPeersLoading] = useState(false);
  const [addPeerInput, setAddPeerInput] = useState('');
  const [addPeerVisible, setAddPeerVisible] = useState(false);

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
      const res = await api.get<{ data: BtcPeerInfo[] }>('/crypto/btc/peers');
      setPeers(res.data);
    } catch {
      setPeers([]);
    } finally {
      setPeersLoading(false);
    }
  };

  const handleAddPeer = async () => {
    if (!addPeerInput.trim()) return;
    try {
      await api.post('/crypto/btc/peers/add', { ip: addPeerInput.trim() });
      setAddPeerInput('');
      setAddPeerVisible(false);
      fetchPeers();
    } catch { /* ignore */ }
  };

  const handleBanPeer = async (ip: string) => {
    try {
      await api.post('/crypto/btc/peers/ban', { ip });
      fetchPeers();
    } catch { /* ignore */ }
  };

  const ext = extended;
  const hasExtended = !!ext && running;

  return (
    <div className="crypto-card">
      <div className="crypto-card-header">
        <div className="crypto-card-dot" style={{ background: loading && !svc ? 'var(--text-muted)' : running ? (sync?.synced ? '#22c55e' : '#f59e0b') : installed ? '#f59e0b' : '#ef4444' }} />
        <span className="crypto-card-title">Bitcoin Core</span>
        {!loading && <span className="crypto-card-phase">{phaseLabel}</span>}
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
            <Download size={14} /> {t('crypto.installBitcoin')}
          </button>
        </div>
      )}

      {sync && !sync.synced && (
        <div className="crypto-card-body">
          <div className="btc-ibd-banner">
            <div className="btc-ibd-title">
              <Loader2 size={13} className="spin" style={{ color: '#f59e0b' }} />
              <span>{formatBlockDate(sync, t) ?? t('crypto.syncingChain')}</span>
            </div>
            <div className="btc-ibd-pct">{progress}%</div>
          </div>
          <div className="crypto-progress-wrap" style={{ marginTop: 8 }}>
            <div className="crypto-progress-bar" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <div className="crypto-card-stats" style={{ marginTop: 10 }}>
            <div><span className="dim">{t('crypto.block')}</span> {formatCount(sync.blocks)} / {formatCount(sync.headers)}</div>
            <div><span className="dim">{t('crypto.peers')}</span> {formatCount(sync.peers)}</div>
            <div><span className="dim">{t('crypto.chain')}</span> {sync.chain}</div>
            <div><span className="dim">{t('crypto.disk')}</span> {formatBytes(sync.size_on_disk_bytes, locale)}</div>
            <div><span className="dim">{t('crypto.mode')}</span> {sync.pruned ? t('crypto.pruned', { size: sync.prune_target_mb ?? 0 }) : t('crypto.fullNode')}</div>
            {sync.estimated_time_remaining_s != null && (
              <div><span className="dim">{t('crypto.eta')}</span> {formatEta(sync.estimated_time_remaining_s, locale)}</div>
            )}
            <div><span className="dim">{t('crypto.uptime')}</span> {formatUptime(sync.uptime_seconds, locale)}</div>
          </div>
          {svc?.ram_mb != null && (
            <div className="crypto-card-ram">
              <Cpu size={11} /> {svc.ram_mb} MB
            </div>
          )}
          <CryptoLogs service="bitcoind" active />
        </div>
      )}

      {sync && sync.synced && (
        <div className="crypto-card-body">
          <div className="crypto-card-stats">
            <div><span className="dim">{t('crypto.block')}</span> {formatCount(sync.blocks)} / {formatCount(sync.headers)}</div>
            <div><span className="dim">{t('crypto.peers')}</span> {formatCount(sync.peers)}</div>
            <div><span className="dim">{t('crypto.chain')}</span> {sync.chain}</div>
            <div><span className="dim">{t('crypto.disk')}</span> {formatBytes(sync.size_on_disk_bytes, locale)}</div>
            <div><span className="dim">{t('crypto.mode')}</span> {sync.pruned ? t('crypto.pruned', { size: sync.prune_target_mb ?? 0 }) : t('crypto.fullNode')}</div>
            <div><span className="dim">{t('crypto.uptime')}</span> {formatUptime(sync.uptime_seconds, locale)}</div>
          </div>
          {svc?.ram_mb != null && (
            <div className="crypto-card-ram">
              <Cpu size={11} /> {svc.ram_mb} MB
            </div>
          )}
        </div>
      )}

      {/* ─── Extended Stats (always visible summaries) ─── */}
      {hasExtended && (
        <div className="btc-ext-summary">
          {ext.fee_rate_sat_vb != null && (
            <span>{t('crypto.fee')}: {formatSatVB(ext.fee_rate_sat_vb, locale)}</span>
          )}
          <span>{t('crypto.mempool')}: {formatCount(ext.mempool_tx_count)} {t('crypto.transactionsShort')} ({formatBytes(ext.mempool_size_bytes, locale)})</span>
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
                <div><span className="dim">{t('crypto.version')}</span> {formatVersion(ext.version)}</div>
                <div><span className="dim">{t('crypto.agent')}</span> {ext.subversion}</div>
                <div><span className="dim">{t('crypto.inbound')}</span> {formatCount(ext.connections_in)}</div>
                <div><span className="dim">{t('crypto.outbound')}</span> {formatCount(ext.connections_out)}</div>
              </div>

              {/* Peer list */}
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('crypto.peers')} {peers ? `(${formatCount(peers.length)})` : ''}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btc-ext-action-btn" onClick={() => setAddPeerVisible(!addPeerVisible)} title={t('crypto.addPeer')} aria-label={t('crypto.addPeer')}><Plus size={11} /></button>
                  <button className="btc-ext-action-btn" onClick={fetchPeers} title={t('crypto.refresh')} aria-label={t('crypto.refresh')}><RefreshCw size={11} /></button>
                </div>
              </div>

              {addPeerVisible && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <input
                    className="btc-ext-input"
                    placeholder="IP:port"
                    aria-label={t('crypto.addPeer')}
                    value={addPeerInput}
                    onChange={e => setAddPeerInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddPeer()}
                  />
                  <button className="btc-ext-action-btn" onClick={handleAddPeer} style={{ padding: '0 8px', fontSize: 11 }}>{t('crypto.add')}</button>
                </div>
              )}

              {peersLoading && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}><Loader2 size={11} className="spin" /> {t('crypto.loadingEllipsis')}</div>}

              {peers && peers.length > 0 && (
                <div className="btc-peer-list">
                  {peers.map(p => (
                    <div key={p.id} className="btc-peer-row">
                      <span className="btc-peer-addr">{p.addr}</span>
                      <span className="btc-peer-tag">{p.inbound ? 'in' : 'out'}</span>
                      {p.pingtime != null && <span className="btc-peer-ping">{(p.pingtime * 1000).toFixed(0)}ms</span>}
                      <span className="btc-peer-ver">{p.subver.replace(/\//g, '')}</span>
                      <button className="btc-peer-ban" onClick={() => handleBanPeer(p.addr.split(':')[0] ?? '')} title={t('crypto.ban')} aria-label={t('crypto.ban')}><Ban size={10} /></button>
                    </div>
                  ))}
                </div>
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
                <div><span className="dim">{t('crypto.hashrate')}</span> {formatHashRate(ext.network_hashps, locale)}</div>
                <div><span className="dim">{t('crypto.lastBlock')}</span> {formatRelativeTime(ext.latest_block_time, locale)}</div>
                <div><span className="dim">{t('crypto.blockTransactions')}</span> {formatCount(ext.latest_block_tx_count)}</div>
                <div><span className="dim">{t('crypto.blockSize')}</span> {formatBytes(ext.latest_block_size, locale)}</div>
                <div><span className="dim">{t('crypto.minimumFee')}</span> {(ext.mempool_min_fee * 1e5).toLocaleString(locale === 'es' ? 'es-ES' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sat/vB</div>
              </div>
              {Object.keys(ext.indexes).length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('crypto.indexes')}</span>
                  {Object.entries(ext.indexes).map(([name, info]) => (
                    <div key={name} style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', gap: 6, marginTop: 2 }}>
                      <span>{name}</span>
                      <span style={{ color: info.synced ? '#22c55e' : '#f59e0b' }}>{info.synced ? t('crypto.synced') : t('crypto.heightValue', { height: formatCount(info.best_block_height) })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Collapsible: Traffic ─── */}
      {hasExtended && (
        <div className="btc-ext-section">
          <button className="btc-ext-toggle" onClick={() => toggleSection('traffic')}>
            {expandedSections.has('traffic') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Activity size={12} /> {t('crypto.traffic')}
          </button>
          {expandedSections.has('traffic') && (
            <div className="btc-ext-content">
              <div className="crypto-card-stats">
                <div><span className="dim">{t('crypto.received')}</span> {formatTraffic(ext.total_bytes_recv, locale)}</div>
                <div><span className="dim">{t('crypto.sent')}</span> {formatTraffic(ext.total_bytes_sent, locale)}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <UpdateCheck service="bitcoind" installed={installed} loading={!!loading} />

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
            <Loader2 size={12} className="spin" /> Initializing Bitcoin Core...
          </span>
          <CryptoLogs service="bitcoind" active />
        </div>
      )}

      <style>{`
        .crypto-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
        .crypto-card-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--border); font-size: 13px; }
        .crypto-card-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .crypto-card-title { font-weight: 600; color: var(--text); }
        .crypto-card-phase { font-size: 11px; color: var(--text-muted); text-transform: capitalize; }
        .crypto-card-body { padding: 12px 14px; }
        .crypto-card-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 12px; color: var(--text); }
        .crypto-card-stats .dim { color: var(--text-muted); margin-right: 4px; }
        .crypto-card-ram { display: flex; align-items: center; gap: 4px; margin-top: 8px; font-size: 11px; color: var(--text-muted); }
        .crypto-progress-wrap { position: relative; height: 6px; background: var(--border); border-radius: 3px; margin-bottom: 10px; overflow: hidden; }
        .crypto-progress-bar { height: 100%; background: #f59e0b; border-radius: 3px; transition: width .5s ease; }
        .crypto-btn-sm { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-dim); cursor: pointer; }
        .crypto-btn-sm:hover { background: var(--surface-hover); color: var(--text); }
        .btc-ibd-banner { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
        .btc-ibd-title { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #f59e0b; font-weight: 500; }
        .btc-ibd-pct { font-size: 18px; font-weight: 700; color: #f59e0b; font-variant-numeric: tabular-nums; }
        .crypto-install-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 10px 16px; background: transparent; border: 1px dashed var(--border); border-radius: var(--radius-md); color: var(--text); font-size: 13px; font-weight: 500; cursor: pointer; }
        .crypto-install-btn:hover { background: var(--surface-hover); border-color: var(--text-muted); }
        .btc-update-section { padding: 8px 14px; border-top: 1px solid var(--border); }
        .btc-update-link { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; color: var(--text-muted); font-size: 11px; cursor: pointer; padding: 0; }
        .btc-update-link:hover { color: var(--text); }
        .btc-update-status { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-muted); }
        .btc-update-available { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #f59e0b; }
        .btc-update-available span { display: flex; align-items: center; gap: 4px; }
        .btc-update-btn { padding: 2px 10px; background: #f59e0b; border: none; border-radius: var(--radius-sm); color: #000; font-size: 11px; font-weight: 600; cursor: pointer; }
        .btc-update-btn:hover { background: #d97706; }
        .btc-update-error { display: flex; align-items: center; font-size: 11px; color: var(--error, #ef4444); }

        .btc-ext-summary { display: flex; gap: 12px; padding: 6px 14px; border-top: 1px solid var(--border); font-size: 11px; color: var(--text-dim); flex-wrap: wrap; }
        .btc-ext-section { border-top: 1px solid var(--border); }
        .btc-ext-toggle { display: flex; align-items: center; gap: 6px; width: 100%; padding: 7px 14px; background: none; border: none; color: var(--text-dim); font-size: 11px; font-weight: 600; cursor: pointer; text-transform: uppercase; letter-spacing: 0.04em; }
        .btc-ext-toggle:hover { background: var(--surface-hover); color: var(--text); }
        .btc-ext-content { padding: 0 14px 10px; }
        .btc-ext-action-btn { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-muted); cursor: pointer; font-size: 11px; }
        .btc-ext-action-btn:hover { background: var(--surface-hover); color: var(--text); }
        .btc-ext-input { flex: 1; padding: 3px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 11px; outline: none; font-family: var(--font-mono, monospace); }

        .btc-peer-list { margin-top: 6px; max-height: 180px; overflow-y: auto; }
        .btc-peer-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 11px; border-bottom: 1px solid var(--border); }
        .btc-peer-addr { font-family: var(--font-mono, monospace); color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .btc-peer-tag { font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 3px; text-transform: uppercase; background: rgba(59,130,246,.15); color: #3b82f6; }
        .btc-peer-ping { color: var(--text-muted); font-variant-numeric: tabular-nums; }
        .btc-peer-ver { color: var(--text-muted); font-size: 10px; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .btc-peer-ban { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; background: none; border: none; color: var(--text-muted); cursor: pointer; border-radius: 3px; flex-shrink: 0; }
        .btc-peer-ban:hover { background: rgba(239,68,68,.15); color: #ef4444; }
      `}</style>
    </div>
  );
}
