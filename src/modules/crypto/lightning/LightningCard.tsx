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
import { Play, Square, Zap, Cpu, Loader2, Wrench, Download, ChevronDown, ChevronRight, Network, Users, Layers, Plus, X, Copy, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';
import { CryptoLogs } from '../shared/CryptoLogs';
import { truncateId, formatMsat, formatUptime } from '../shared/crypto-formatters';
import { UpdateCheck } from '../shared/UpdateCheck';

interface LightningInfo {
  id: string;
  alias: string;
  num_channels: number;
  num_active_channels: number;
  num_peers: number;
  total_capacity_sat: number;
  synced_to_chain: boolean;
}

interface LightningExtendedStats {
  total_forwards: number;
  successful_forwards: number;
  total_fees_earned_msat: number;
  feerate_perkw_opening: number | null;
  feerate_perkw_mutual_close: number | null;
  feerate_perkw_unilateral_close: number | null;
  known_nodes: number;
  known_channels: number;
}

interface LightningPeerInfo {
  id: string;
  connected: boolean;
  netaddr: string[];
  num_channels: number;
}

interface LightningChannelInfo {
  peer_id: string;
  short_channel_id: string;
  state: string;
  our_amount_msat: number;
  total_msat: number;
  funding_txid: string;
  private: boolean;
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
  info: LightningInfo | null;
  extended: LightningExtendedStats | null;
  loading?: boolean;
  starting?: boolean;
  onInstall: () => void;
  onStart: () => void;
  onStop: () => void;
  onConfigure: () => void;
}

type DialogType = 'connect-peer' | 'open-channel' | 'new-address' | 'withdraw' | 'set-fees' | null;

const STATE_COLORS: Record<string, string> = {
  CHANNELD_NORMAL: '#22c55e',
  CHANNELD_AWAITING_LOCKIN: '#f59e0b',
  OPENINGD: '#3b82f6',
  CLOSINGD_COMPLETE: '#6b7280',
  CLOSINGD_SIGEXCHANGE: '#f59e0b',
  FUNDING_SPEND_SEEN: '#ef4444',
  ONCHAIN: '#6b7280',
};

export function LightningCard({ svc, info, extended, loading, starting, onInstall, onStart, onStop, onConfigure }: Props) {
  const running = svc?.running ?? false;
  const installed = svc?.installed ?? false;

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [peers, setPeers] = useState<LightningPeerInfo[] | null>(null);
  const [peersLoading, setPeersLoading] = useState(false);
  const [channels, setChannels] = useState<LightningChannelInfo[] | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogResult, setDialogResult] = useState<string | null>(null);

  // Dialog form fields
  const [connectInput, setConnectInput] = useState('');
  const [openPeerId, setOpenPeerId] = useState('');
  const [openAmount, setOpenAmount] = useState('');
  const [openFeeRate, setOpenFeeRate] = useState('');
  const [withdrawAddr, setWithdrawAddr] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [feesChannelId, setFeesChannelId] = useState('');
  const [feesBase, setFeesBase] = useState('');
  const [feesPpm, setFeesPpm] = useState('');

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
      const res = await api.get<{ data: LightningPeerInfo[] }>('/crypto/lightning/peers');
      setPeers(res.data);
    } catch { setPeers([]); }
    finally { setPeersLoading(false); }
  };

  const fetchChannels = async () => {
    setChannelsLoading(true);
    try {
      const res = await api.get<{ data: LightningChannelInfo[] }>('/crypto/lightning/channels');
      setChannels(res.data);
    } catch { setChannels([]); }
    finally { setChannelsLoading(false); }
  };

  const openDialog = (type: DialogType) => {
    setDialog(type);
    setDialogLoading(false);
    setDialogError(null);
    setDialogResult(null);
  };

  const closeDialog = () => {
    setDialog(null);
    setDialogError(null);
    setDialogResult(null);
  };

  const handleConnectPeer = async () => {
    if (!connectInput.trim()) return;
    setDialogLoading(true);
    setDialogError(null);
    try {
      await api.post('/crypto/lightning/peers/connect', { id: connectInput.trim() });
      setDialogResult('Connected!');
      setConnectInput('');
      fetchPeers();
    } catch (err: any) {
      setDialogError(err?.message ?? 'Failed to connect');
    } finally { setDialogLoading(false); }
  };

  const handleOpenChannel = async () => {
    if (!openPeerId.trim() || !openAmount.trim()) return;
    setDialogLoading(true);
    setDialogError(null);
    try {
      await api.post('/crypto/lightning/channels/open', {
        peer_id: openPeerId.trim(),
        amount_sat: parseInt(openAmount, 10),
        fee_rate: openFeeRate.trim() || undefined,
      });
      setDialogResult('Channel funding initiated!');
      fetchChannels();
    } catch (err: any) {
      setDialogError(err?.message ?? 'Failed to open channel');
    } finally { setDialogLoading(false); }
  };

  const handleNewAddress = async () => {
    setDialogLoading(true);
    setDialogError(null);
    try {
      const res = await api.post<{ data: { bech32?: string; 'p2tr-unannounced'?: string } }>('/crypto/lightning/newaddr', {});
      const addr = res.data?.bech32 || res.data?.['p2tr-unannounced'] || JSON.stringify(res.data);
      setDialogResult(addr);
    } catch (err: any) {
      setDialogError(err?.message ?? 'Failed to generate address');
    } finally { setDialogLoading(false); }
  };

  const handleWithdraw = async () => {
    if (!withdrawAddr.trim() || !withdrawAmount.trim()) return;
    setDialogLoading(true);
    setDialogError(null);
    try {
      const amt = withdrawAmount.trim().toLowerCase() === 'all' ? 'all' : parseInt(withdrawAmount, 10);
      await api.post('/crypto/lightning/withdraw', { address: withdrawAddr.trim(), amount_sat: amt });
      setDialogResult('Withdrawal sent!');
    } catch (err: any) {
      setDialogError(err?.message ?? 'Failed to withdraw');
    } finally { setDialogLoading(false); }
  };

  const handleSetFees = async () => {
    if (!feesChannelId.trim()) return;
    setDialogLoading(true);
    setDialogError(null);
    try {
      await api.post('/crypto/lightning/channels/setfees', {
        channel_id: feesChannelId.trim(),
        fee_base_msat: parseInt(feesBase, 10) || 1000,
        fee_ppm: parseInt(feesPpm, 10) || 10,
      });
      setDialogResult('Fees updated!');
    } catch (err: any) {
      setDialogError(err?.message ?? 'Failed to set fees');
    } finally { setDialogLoading(false); }
  };

  const handleCloseChannel = async (channelId: string) => {
    try {
      await api.post('/crypto/lightning/channels/close', { channel_id: channelId });
      fetchChannels();
    } catch { /* ignore */ }
  };

  const ext = extended;
  const hasExtended = !!ext && running;

  return (
    <div className="crypto-card">
      <div className="crypto-card-header">
        <div className="crypto-card-dot" style={{ background: loading && !svc ? 'var(--text-muted)' : running ? (info?.synced_to_chain ? '#22c55e' : '#f59e0b') : installed ? '#f59e0b' : '#ef4444' }} />
        <Zap size={14} style={{ color: '#f59e0b' }} />
        <span className="crypto-card-title">Core Lightning</span>
        <div style={{ flex: 1 }} />
        {!loading && installed && running && (
          <button className="crypto-btn-sm" onClick={() => openDialog('new-address')} title="New Address"><Plus size={12} /></button>
        )}
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
            <Download size={14} /> Install Core Lightning
          </button>
        </div>
      )}

      {info && (
        <div className="crypto-card-body">
          <div className="crypto-card-stats">
            <div><span className="dim">Node ID</span> {truncateId(info.id)}</div>
            {info.alias && <div><span className="dim">Alias</span> {info.alias}</div>}
            <div><span className="dim">Channels</span> {info.num_active_channels}/{info.num_channels}</div>
            <div><span className="dim">Peers</span> {info.num_peers}</div>
            <div><span className="dim">Capacity</span> {info.total_capacity_sat.toLocaleString()} sat</div>
            <div><span className="dim">Synced</span> {info.synced_to_chain ? 'Yes' : 'No'}</div>
            {svc?.uptime_seconds != null && <div><span className="dim">Up</span> {formatUptime(svc.uptime_seconds)}</div>}
          </div>
          {svc?.ram_mb != null && (
            <div className="crypto-card-ram">
              <Cpu size={11} /> {svc.ram_mb} MB
            </div>
          )}
          <CryptoLogs service="lightning" active={running} />
        </div>
      )}

      {/* ─── Extended: Forwarding summary ─── */}
      {hasExtended && ext.total_forwards > 0 && (
        <div className="btc-ext-summary">
          <span>Forwarded: {ext.successful_forwards}/{ext.total_forwards}</span>
          <span>Earned: {formatMsat(ext.total_fees_earned_msat)}</span>
        </div>
      )}

      {/* ─── Collapsible: Network ─── */}
      {hasExtended && (
        <div className="btc-ext-section">
          <button className="btc-ext-toggle" onClick={() => toggleSection('network')}>
            {expandedSections.has('network') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Network size={12} /> Network
          </button>
          {expandedSections.has('network') && (
            <div className="btc-ext-content">
              <div className="crypto-card-stats">
                <div><span className="dim">Known Nodes</span> {ext.known_nodes.toLocaleString()}</div>
                <div><span className="dim">Known Channels</span> {ext.known_channels.toLocaleString()}</div>
                {ext.feerate_perkw_opening != null && <div><span className="dim">Opening Fee</span> {ext.feerate_perkw_opening} perkw</div>}
                {ext.feerate_perkw_mutual_close != null && <div><span className="dim">Mutual Close</span> {ext.feerate_perkw_mutual_close} perkw</div>}
                {ext.feerate_perkw_unilateral_close != null && <div><span className="dim">Unilateral</span> {ext.feerate_perkw_unilateral_close} perkw</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Collapsible: Peers ─── */}
      {running && info && (
        <div className="btc-ext-section">
          <button className="btc-ext-toggle" onClick={() => { toggleSection('peers'); if (!expandedSections.has('peers') && !peers) fetchPeers(); }}>
            {expandedSections.has('peers') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Users size={12} /> Peers
          </button>
          {expandedSections.has('peers') && (
            <div className="btc-ext-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{peers ? `${peers.length} peers` : ''}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btc-ext-action-btn" onClick={() => openDialog('connect-peer')} title="Connect peer"><Plus size={11} /></button>
                  <button className="btc-ext-action-btn" onClick={fetchPeers} title="Refresh"><RefreshCw size={11} /></button>
                </div>
              </div>
              {peersLoading && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}><Loader2 size={11} className="spin" /> Loading...</div>}
              {peers && peers.length > 0 && (
                <div className="btc-peer-list">
                  {peers.map(p => (
                    <div key={p.id} className="btc-peer-row">
                      <span className="btc-peer-addr">{truncateId(p.id, 6)}</span>
                      <span className="btc-peer-tag" style={{ background: p.connected ? 'rgba(34,197,94,.15)' : 'rgba(107,114,128,.15)', color: p.connected ? '#22c55e' : '#6b7280' }}>
                        {p.connected ? 'on' : 'off'}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.num_channels}ch</span>
                      {p.netaddr[0] && <span className="btc-peer-ver">{p.netaddr[0]}</span>}
                    </div>
                  ))}
                </div>
              )}
              {peers && peers.length === 0 && !peersLoading && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No peers connected</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Collapsible: Channels ─── */}
      {running && info && (
        <div className="btc-ext-section">
          <button className="btc-ext-toggle" onClick={() => { toggleSection('channels'); if (!expandedSections.has('channels') && !channels) fetchChannels(); }}>
            {expandedSections.has('channels') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Layers size={12} /> Channels
          </button>
          {expandedSections.has('channels') && (
            <div className="btc-ext-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{channels ? `${channels.length} channels` : ''}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btc-ext-action-btn" onClick={() => openDialog('open-channel')} title="Open channel"><Plus size={11} /></button>
                  <button className="btc-ext-action-btn" onClick={fetchChannels} title="Refresh"><RefreshCw size={11} /></button>
                </div>
              </div>
              {channelsLoading && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}><Loader2 size={11} className="spin" /> Loading...</div>}
              {channels && channels.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {channels.map(c => {
                    const pct = c.total_msat > 0 ? (c.our_amount_msat / c.total_msat) * 100 : 0;
                    const stateColor = STATE_COLORS[c.state] ?? '#6b7280';
                    return (
                      <div key={c.short_channel_id || c.funding_txid} className="ln-channel-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: stateColor }}>{c.state.replace('CHANNELD_', '').replace('_', ' ')}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{truncateId(c.peer_id, 6)}</span>
                          {c.private && <span style={{ fontSize: 9, padding: '0 3px', borderRadius: 2, background: 'rgba(168,85,247,.15)', color: '#a855f7' }}>priv</span>}
                          <div style={{ flex: 1 }} />
                          <button className="btc-peer-ban" onClick={() => handleCloseChannel(c.short_channel_id || c.peer_id)} title="Close"><X size={10} /></button>
                          <button className="btc-ext-action-btn" onClick={() => { setFeesChannelId(c.short_channel_id || c.peer_id); openDialog('set-fees'); }} title="Set fees" style={{ width: 18, height: 18 }}>F</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 50, textAlign: 'right' }}>{formatMsat(c.our_amount_msat)}</span>
                          <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: '#22c55e', borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 50 }}>{formatMsat(c.total_msat)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {channels && channels.length === 0 && !channelsLoading && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No channels</div>
              )}

              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button className="ln-action-btn" onClick={() => openDialog('withdraw')}>Withdraw</button>
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

      {!loading && !info && (running || starting) && (
        <div className="crypto-card-body">
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={12} className="spin" /> Starting up...
          </span>
          <CryptoLogs service="lightning" active />
        </div>
      )}

      {!loading && !running && !info && installed && (
        <div className="crypto-card-body">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stopped</span>
        </div>
      )}

      {/* ─── Action Dialogs ─── */}
      {dialog && (
        <div className="ln-dialog-overlay" onClick={closeDialog}>
          <div className="ln-dialog" onClick={e => e.stopPropagation()}>
            <div className="ln-dialog-header">
              <span className="ln-dialog-title">
                {dialog === 'connect-peer' && 'Connect Peer'}
                {dialog === 'open-channel' && 'Open Channel'}
                {dialog === 'new-address' && 'New Deposit Address'}
                {dialog === 'withdraw' && 'Withdraw On-Chain'}
                {dialog === 'set-fees' && 'Set Channel Fees'}
              </span>
              <button className="btc-peer-ban" onClick={closeDialog}><X size={12} /></button>
            </div>

            <div className="ln-dialog-body">
              {dialog === 'connect-peer' && (
                <>
                  <label className="ln-dialog-label">Peer ID (pubkey@host:port)</label>
                  <input className="ln-dialog-input" value={connectInput} onChange={e => setConnectInput(e.target.value)} placeholder="03abc...@1.2.3.4:9735" />
                  <button className="ln-dialog-btn" onClick={handleConnectPeer} disabled={dialogLoading}>
                    {dialogLoading ? <Loader2 size={12} className="spin" /> : 'Connect'}
                  </button>
                </>
              )}

              {dialog === 'open-channel' && (
                <>
                  <label className="ln-dialog-label">Peer ID</label>
                  <input className="ln-dialog-input" value={openPeerId} onChange={e => setOpenPeerId(e.target.value)} placeholder="03abc..." />
                  <label className="ln-dialog-label">Amount (sats)</label>
                  <input className="ln-dialog-input" value={openAmount} onChange={e => setOpenAmount(e.target.value)} placeholder="100000" type="number" />
                  <label className="ln-dialog-label">Fee Rate (optional)</label>
                  <input className="ln-dialog-input" value={openFeeRate} onChange={e => setOpenFeeRate(e.target.value)} placeholder="normal / slow / urgent" />
                  <button className="ln-dialog-btn" onClick={handleOpenChannel} disabled={dialogLoading}>
                    {dialogLoading ? <Loader2 size={12} className="spin" /> : 'Open Channel'}
                  </button>
                </>
              )}

              {dialog === 'new-address' && (
                <>
                  {!dialogResult && (
                    <button className="ln-dialog-btn" onClick={handleNewAddress} disabled={dialogLoading}>
                      {dialogLoading ? <Loader2 size={12} className="spin" /> : 'Generate Address'}
                    </button>
                  )}
                  {dialogResult && (
                    <div className="ln-addr-result">
                      <span className="ln-addr-text">{dialogResult}</span>
                      <button className="btc-ext-action-btn" onClick={() => navigator.clipboard.writeText(dialogResult)} title="Copy"><Copy size={11} /></button>
                    </div>
                  )}
                </>
              )}

              {dialog === 'withdraw' && (
                <>
                  <label className="ln-dialog-label">Destination Address</label>
                  <input className="ln-dialog-input" value={withdrawAddr} onChange={e => setWithdrawAddr(e.target.value)} placeholder="bc1q..." />
                  <label className="ln-dialog-label">Amount (sats, or "all")</label>
                  <input className="ln-dialog-input" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="50000" />
                  <button className="ln-dialog-btn" onClick={handleWithdraw} disabled={dialogLoading}>
                    {dialogLoading ? <Loader2 size={12} className="spin" /> : 'Withdraw'}
                  </button>
                </>
              )}

              {dialog === 'set-fees' && (
                <>
                  <label className="ln-dialog-label">Channel</label>
                  <input className="ln-dialog-input" value={feesChannelId} onChange={e => setFeesChannelId(e.target.value)} placeholder="short_channel_id" />
                  <label className="ln-dialog-label">Fee Base (msat)</label>
                  <input className="ln-dialog-input" value={feesBase} onChange={e => setFeesBase(e.target.value)} placeholder="1000" type="number" />
                  <label className="ln-dialog-label">Fee PPM</label>
                  <input className="ln-dialog-input" value={feesPpm} onChange={e => setFeesPpm(e.target.value)} placeholder="10" type="number" />
                  <button className="ln-dialog-btn" onClick={handleSetFees} disabled={dialogLoading}>
                    {dialogLoading ? <Loader2 size={12} className="spin" /> : 'Apply'}
                  </button>
                </>
              )}

              {dialogResult && dialog !== 'new-address' && (
                <div style={{ fontSize: 12, color: '#22c55e', marginTop: 8 }}>{dialogResult}</div>
              )}
              {dialogError && (
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{dialogError}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .ln-channel-row { padding: 6px 0; border-bottom: 1px solid var(--border); }
        .ln-action-btn { padding: 4px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-dim); font-size: 11px; font-weight: 500; cursor: pointer; }
        .ln-action-btn:hover { background: var(--surface-hover); color: var(--text); }

        .ln-dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .ln-dialog { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); width: 380px; max-width: 90vw; overflow: hidden; }
        .ln-dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); }
        .ln-dialog-title { font-size: 13px; font-weight: 600; color: var(--text); }
        .ln-dialog-body { padding: 16px; display: flex; flex-direction: column; gap: 8px; }
        .ln-dialog-label { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .ln-dialog-input { padding: 6px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 12px; outline: none; font-family: var(--font-mono, monospace); }
        .ln-dialog-btn { padding: 8px 16px; background: #f59e0b; border: none; border-radius: var(--radius-sm); color: #000; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 4px; }
        .ln-dialog-btn:hover { background: #d97706; }
        .ln-dialog-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .ln-addr-result { display: flex; align-items: center; gap: 8px; padding: 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .ln-addr-text { flex: 1; font-size: 11px; font-family: var(--font-mono, monospace); color: var(--text); word-break: break-all; }
      `}</style>

      <UpdateCheck service="lightning" installed={installed} loading={!!loading} />
    </div>
  );
}
