import { useState } from 'react';
import { Play, Square, Cpu, Loader2, Wrench, Download, ChevronDown, ChevronRight, Network, BarChart3, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';
import { CryptoLogs } from '../shared/CryptoLogs';
import { formatBytes, formatDifficulty, formatRelativeTime, formatUptime, formatXmr, formatMoneroVersion, truncateId } from '../shared/crypto-formatters';
import { UpdateCheck } from '../shared/UpdateCheck';

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

function formatFeePerByte(fee: number | null): string {
  if (fee == null) return 'N/A';
  // fee is in atomic units (piconero) per byte
  // Convert to nanonero/byte for readability: 1 nanonero = 1000 piconero
  const nano = fee / 1000;
  if (nano >= 1) return `${nano.toFixed(1)} nano/B`;
  return `${fee} pico/B`;
}

function formatPeerTime(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function MoneroNodeCard({ svc, sync, extended, loading, starting, onInstall, onStart, onStop, onConfigure }: Props) {
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
      next.has(name) ? next.delete(name) : next.add(name);
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
        <span className="crypto-card-title">Monero Node</span>
        {!loading && <span className="crypto-card-phase">{phase}</span>}
        <div style={{ flex: 1 }} />
        {!loading && installed && (
          <button className="crypto-btn-sm" onClick={onConfigure} title="Settings"><Wrench size={12} /></button>
        )}
        {!loading && installed && (running ? (
          <button className="crypto-btn-sm" onClick={onStop} title="Stop"><Square size={12} /></button>
        ) : (
          <button className="crypto-btn-sm" onClick={onStart} title="Start">
            <Play size={12} />
          </button>
        ))}
      </div>

      {!loading && !installed && (
        <div className="crypto-card-body">
          <button className="crypto-install-btn" onClick={onInstall}>
            <Download size={14} /> Install Monero Node
          </button>
        </div>
      )}

      {sync && !sync.synced && (
        <div className="crypto-card-body">
          <div className="btc-ibd-banner">
            <div className="btc-ibd-title">
              <Loader2 size={13} className="spin" style={{ color: '#f97316' }} />
              <span>Syncing blockchain</span>
            </div>
            <div className="btc-ibd-pct" style={{ color: '#f97316' }}>{progress}%</div>
          </div>
          <div className="crypto-progress-wrap" style={{ marginTop: 8 }}>
            <div className="crypto-progress-bar" style={{ width: `${Math.min(progress, 100)}%`, background: '#f97316' }} />
          </div>
          <div className="crypto-card-stats" style={{ marginTop: 10 }}>
            <div><span className="dim">Height</span> {sync.height.toLocaleString()} / {sync.target_height.toLocaleString()}</div>
            <div><span className="dim">Peers</span> in: {sync.peers_in} out: {sync.peers_out}</div>
            <div><span className="dim">Pruned</span> {sync.pruned ? 'Yes' : 'No'}</div>
            <div><span className="dim">Disk</span> {formatBytes(sync.size_on_disk_bytes)}</div>
            <div><span className="dim">Up</span> {formatUptime(sync.uptime_seconds ?? svc?.uptime_seconds ?? null)}</div>
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
            <div><span className="dim">Height</span> {sync.height.toLocaleString()} / {sync.target_height.toLocaleString()}</div>
            <div><span className="dim">Peers</span> in: {sync.peers_in} out: {sync.peers_out}</div>
            <div><span className="dim">Pruned</span> {sync.pruned ? 'Yes' : 'No'}</div>
            <div><span className="dim">Disk</span> {formatBytes(sync.size_on_disk_bytes)}</div>
            <div><span className="dim">Up</span> {formatUptime(sync.uptime_seconds ?? svc?.uptime_seconds ?? null)}</div>
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
          <span>Mempool: {ext.tx_pool_size} txs</span>
          {sync?.synced && ext.fee_per_byte != null && <span>Fee: {formatFeePerByte(ext.fee_per_byte)}</span>}
        </div>
      )}

      {/* ─── Collapsible: Network ─── */}
      {hasExtended && (
        <div className="btc-ext-section">
          <button className="btc-ext-toggle" onClick={() => { toggleSection('network'); if (!expandedSections.has('network') && !peers) fetchPeers(); }}>
            {expandedSections.has('network') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Network size={12} /> Network
          </button>
          {expandedSections.has('network') && (
            <div className="btc-ext-content">
              <div className="crypto-card-stats">
                {ext.version ? <div><span className="dim">Version</span> {formatMoneroVersion(ext.version)}</div> : null}
                <div><span className="dim">In</span> {sync?.peers_in ?? 0}</div>
                <div><span className="dim">Out</span> {sync?.peers_out ?? 0}</div>
                {ext.white_peerlist_size > 0 && <div><span className="dim">Known (white)</span> {ext.white_peerlist_size.toLocaleString()}</div>}
                {ext.grey_peerlist_size > 0 && <div><span className="dim">Known (grey)</span> {ext.grey_peerlist_size.toLocaleString()}</div>}
              </div>

              {/* Peer list */}
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Peers {peers ? `(${peers.length})` : ''}
                </span>
                <button className="btc-ext-action-btn" onClick={fetchPeers} title="Refresh"><RefreshCw size={11} /></button>
              </div>

              {peersLoading && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}><Loader2 size={11} className="spin" /> Loading...</div>}

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
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>h:{p.height.toLocaleString()}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatPeerTime(p.live_time)}</span>
                      <span className="btc-peer-ver">{p.state}</span>
                    </div>
                  ))}
                </div>
              )}
              {peers && peers.length === 0 && !peersLoading && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>No peers connected</div>
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
            <BarChart3 size={12} /> Chain
          </button>
          {expandedSections.has('chain') && (
            <div className="btc-ext-content">
              <div className="crypto-card-stats">
                <div><span className="dim">Difficulty</span> {formatDifficulty(ext.difficulty)}</div>
                <div><span className="dim">Total Txs</span> {ext.tx_count.toLocaleString()}</div>
                <div><span className="dim">Last Block</span> {formatRelativeTime(ext.last_block_time)}</div>
                <div><span className="dim">Block Txs</span> {ext.last_block_txs.toLocaleString()}</div>
                <div><span className="dim">Block Size</span> {formatBytes(ext.last_block_size)}</div>
                <div><span className="dim">Reward</span> {formatXmr(ext.last_block_reward)}</div>
                {ext.last_block_hash && <div><span className="dim">Block Hash</span> {truncateId(ext.last_block_hash, 8)}</div>}
                {ext.free_space > 0 && <div><span className="dim">Free Space</span> {formatBytes(ext.free_space)}</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {loading && !svc && (
        <div className="crypto-card-body">
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={12} className="spin" /> Checking...
          </span>
        </div>
      )}

      {!loading && !sync && (running || starting) && (
        <div className="crypto-card-body">
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={12} className="spin" /> Starting up...
          </span>
          <CryptoLogs service="monerod" active />
        </div>
      )}

      {!loading && !running && !sync && installed && (
        <div className="crypto-card-body">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stopped</span>
        </div>
      )}

      <UpdateCheck service="monerod" installed={installed} loading={!!loading} />
    </div>
  );
}
