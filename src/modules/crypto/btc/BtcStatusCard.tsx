import { useState } from 'react';
import { Play, Square, Cpu, Loader2, Wrench, Download, RefreshCw, ChevronDown, ChevronRight, Plus, Ban, Network, Activity, BarChart3 } from 'lucide-react';
import { api } from '@/services/api';
import { CryptoLogs } from '../shared/CryptoLogs';
import { formatBytes, formatEta, formatUptime, formatHashRate, formatDifficulty, formatSatVB, formatRelativeTime, formatTraffic } from '../shared/crypto-formatters';
import { UpdateCheck } from '../shared/UpdateCheck';

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

function getPhaseLabel(phase: string, sync: BtcSync | null, running: boolean): string {
  if (!running) return phase === 'stopped' ? 'Stopped' : phase;
  if (!sync) return 'Starting...';
  if (sync.synced) return 'Synced';
  return 'Initial Block Download';
}

function formatBlockDate(sync: BtcSync): string | null {
  if (sync.synced) return null;
  const pct = sync.verification_progress * 100;
  if (pct < 1) return 'Processing historical blocks';
  if (pct < 50) return 'Downloading & verifying blockchain';
  if (pct < 95) return 'Catching up to chain tip';
  return 'Almost synced';
}

function formatVersion(v: number): string {
  const major = Math.floor(v / 10000);
  const minor = Math.floor((v % 10000) / 100);
  const patch = v % 100;
  return patch ? `${major}.${minor}.${patch}` : `${major}.${minor}`;
}

export function BtcStatusCard({ svc, sync, extended, loading, starting, onInstall, onStart, onStop, onConfigure }: Props) {
  const running = svc?.running ?? false;
  const installed = svc?.installed ?? false;
  const phase = svc?.phase ?? 'stopped';
  const progress = sync ? Math.round(sync.verification_progress * 100 * 100) / 100 : 0;
  const phaseLabel = getPhaseLabel(phase, sync, running);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [peers, setPeers] = useState<BtcPeerInfo[] | null>(null);
  const [peersLoading, setPeersLoading] = useState(false);
  const [addPeerInput, setAddPeerInput] = useState('');
  const [addPeerVisible, setAddPeerVisible] = useState(false);

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
            <Download size={14} /> Install Bitcoin Core
          </button>
        </div>
      )}

      {sync && !sync.synced && (
        <div className="crypto-card-body">
          <div className="btc-ibd-banner">
            <div className="btc-ibd-title">
              <Loader2 size={13} className="spin" style={{ color: '#f59e0b' }} />
              <span>{formatBlockDate(sync) ?? 'Syncing blockchain'}</span>
            </div>
            <div className="btc-ibd-pct">{progress}%</div>
          </div>
          <div className="crypto-progress-wrap" style={{ marginTop: 8 }}>
            <div className="crypto-progress-bar" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <div className="crypto-card-stats" style={{ marginTop: 10 }}>
            <div><span className="dim">Block</span> {sync.blocks.toLocaleString()} / {sync.headers.toLocaleString()}</div>
            <div><span className="dim">Peers</span> {sync.peers}</div>
            <div><span className="dim">Chain</span> {sync.chain}</div>
            <div><span className="dim">Disk</span> {formatBytes(sync.size_on_disk_bytes)}</div>
            <div><span className="dim">Mode</span> {sync.pruned ? `Pruned (${sync.prune_target_mb} MB)` : 'Full Node'}</div>
            {sync.estimated_time_remaining_s != null && (
              <div><span className="dim">ETA</span> {formatEta(sync.estimated_time_remaining_s)}</div>
            )}
            <div><span className="dim">Up</span> {formatUptime(sync.uptime_seconds)}</div>
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
            <div><span className="dim">Block</span> {sync.blocks.toLocaleString()} / {sync.headers.toLocaleString()}</div>
            <div><span className="dim">Peers</span> {sync.peers}</div>
            <div><span className="dim">Chain</span> {sync.chain}</div>
            <div><span className="dim">Disk</span> {formatBytes(sync.size_on_disk_bytes)}</div>
            <div><span className="dim">Mode</span> {sync.pruned ? `Pruned (${sync.prune_target_mb} MB)` : 'Full Node'}</div>
            <div><span className="dim">Up</span> {formatUptime(sync.uptime_seconds)}</div>
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
            <span>Fee: {formatSatVB(ext.fee_rate_sat_vb)}</span>
          )}
          <span>Mempool: {ext.mempool_tx_count.toLocaleString()} txs ({formatBytes(ext.mempool_size_bytes)})</span>
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
                <div><span className="dim">Version</span> {formatVersion(ext.version)}</div>
                <div><span className="dim">Agent</span> {ext.subversion}</div>
                <div><span className="dim">In</span> {ext.connections_in}</div>
                <div><span className="dim">Out</span> {ext.connections_out}</div>
              </div>

              {/* Peer list */}
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Peers {peers ? `(${peers.length})` : ''}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btc-ext-action-btn" onClick={() => setAddPeerVisible(!addPeerVisible)} title="Add peer"><Plus size={11} /></button>
                  <button className="btc-ext-action-btn" onClick={fetchPeers} title="Refresh"><RefreshCw size={11} /></button>
                </div>
              </div>

              {addPeerVisible && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <input
                    className="btc-ext-input"
                    placeholder="IP:port"
                    value={addPeerInput}
                    onChange={e => setAddPeerInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddPeer()}
                  />
                  <button className="btc-ext-action-btn" onClick={handleAddPeer} style={{ padding: '0 8px', fontSize: 11 }}>Add</button>
                </div>
              )}

              {peersLoading && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}><Loader2 size={11} className="spin" /> Loading...</div>}

              {peers && peers.length > 0 && (
                <div className="btc-peer-list">
                  {peers.map(p => (
                    <div key={p.id} className="btc-peer-row">
                      <span className="btc-peer-addr">{p.addr}</span>
                      <span className="btc-peer-tag">{p.inbound ? 'in' : 'out'}</span>
                      {p.pingtime != null && <span className="btc-peer-ping">{(p.pingtime * 1000).toFixed(0)}ms</span>}
                      <span className="btc-peer-ver">{p.subver.replace(/\//g, '')}</span>
                      <button className="btc-peer-ban" onClick={() => handleBanPeer(p.addr.split(':')[0])} title="Ban"><Ban size={10} /></button>
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
            <BarChart3 size={12} /> Chain
          </button>
          {expandedSections.has('chain') && (
            <div className="btc-ext-content">
              <div className="crypto-card-stats">
                <div><span className="dim">Difficulty</span> {formatDifficulty(ext.difficulty)}</div>
                <div><span className="dim">Hashrate</span> {formatHashRate(ext.network_hashps)}</div>
                <div><span className="dim">Last Block</span> {formatRelativeTime(ext.latest_block_time)}</div>
                <div><span className="dim">Block Txs</span> {ext.latest_block_tx_count.toLocaleString()}</div>
                <div><span className="dim">Block Size</span> {formatBytes(ext.latest_block_size)}</div>
                <div><span className="dim">Min Fee</span> {(ext.mempool_min_fee * 1e5).toFixed(1)} sat/vB</div>
              </div>
              {Object.keys(ext.indexes).length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Indexes</span>
                  {Object.entries(ext.indexes).map(([name, info]) => (
                    <div key={name} style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', gap: 6, marginTop: 2 }}>
                      <span>{name}</span>
                      <span style={{ color: info.synced ? '#22c55e' : '#f59e0b' }}>{info.synced ? 'synced' : `height ${info.best_block_height}`}</span>
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
            <Activity size={12} /> Traffic
          </button>
          {expandedSections.has('traffic') && (
            <div className="btc-ext-content">
              <div className="crypto-card-stats">
                <div><span className="dim">Received</span> {formatTraffic(ext.total_bytes_recv)}</div>
                <div><span className="dim">Sent</span> {formatTraffic(ext.total_bytes_sent)}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <UpdateCheck service="bitcoind" installed={installed} loading={!!loading} />

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
