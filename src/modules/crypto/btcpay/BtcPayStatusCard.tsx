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
import { Play, Square, Cpu, Loader2, Wrench, Download, ExternalLink, CreditCard, ChevronDown, ChevronRight, Server, Store, Wallet, Receipt, Users, Zap } from 'lucide-react';
import { CryptoLogs } from '../shared/CryptoLogs';
import { UpdateCheck } from '../shared/UpdateCheck';
import { formatUptime } from '../shared/crypto-formatters';

interface ServiceStatus {
  name: string;
  display_name: string;
  installed: boolean;
  running: boolean;
  ram_mb: number | null;
  uptime_seconds: number | null;
  phase: string;
}

export interface BtcPayStoreInfo {
  id: string;
  name: string;
  default_currency: string;
  payment_methods: string[];
  users: Array<{ email: string; role: string }>;
  wallet: { onchain_confirmed: number; onchain_unconfirmed: number; lightning: number | null } | null;
  invoices: { total: number; recent: Array<{ id: string; amount: number; currency: string; status: string; created: string }> };
}

export interface BtcPayInfo {
  server: { version: string; synchronized: boolean; supported_payment_methods: string[] } | null;
  current_user: { email: string; name: string } | null;
  stores: BtcPayStoreInfo[];
}

interface Props {
  svc: ServiceStatus | null;
  loading?: boolean;
  starting?: boolean;
  info: BtcPayInfo | null;
  onInstall: () => void;
  onStart: () => void;
  onStop: () => void;
  onConfigure: () => void;
  onOpenWebUI: () => void;
}

const formatBtc = (val: number) => {
  if (val === 0) return '0';
  return val.toFixed(8).replace(/\.?0+$/, '');
};

const statusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'settled': case 'complete': case 'paid': return '#22c55e';
    case 'processing': case 'new': return '#f59e0b';
    case 'expired': case 'invalid': return '#ef4444';
    default: return 'var(--text-muted)';
  }
};

export function BtcPayStatusCard({ svc, loading, starting, info, onInstall, onStart, onStop, onConfigure, onOpenWebUI }: Props) {
  const running = svc?.running ?? false;
  const installed = svc?.installed ?? false;
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (name: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  return (
    <div className="crypto-card">
      <div className="crypto-card-header">
        <div className="crypto-card-dot" style={{ background: loading && !svc ? 'var(--text-muted)' : running ? '#22c55e' : installed ? '#f59e0b' : '#ef4444' }} />
        <CreditCard size={14} style={{ color: '#51b13e' }} />
        <span className="crypto-card-title">BTCPay Server</span>
        {running && <span className="crypto-card-phase">Running</span>}
        <div style={{ flex: 1 }} />
        {!loading && installed && (
          <button className="crypto-btn-sm" onClick={onConfigure} title="API Key Setup"><Wrench size={12} /></button>
        )}
        {!loading && installed && running && (
          <button className="crypto-btn-sm" onClick={onOpenWebUI} title="Open WebUI"><ExternalLink size={12} /></button>
        )}
        {!loading && installed && (running ? (
          <button className="crypto-btn-sm" onClick={onStop} title="Stop"><Square size={12} /></button>
        ) : (
          <button className="crypto-btn-sm" onClick={onStart} title="Start">
            <Play size={12} />
          </button>
        ))}
      </div>

      <div className="crypto-card-body">
        {loading && !svc && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={12} className="spin" /> Checking...
          </span>
        )}

        {!loading && !installed && (
          <button className="crypto-install-btn" onClick={onInstall}>
            <Download size={14} /> Install BTCPay Server
          </button>
        )}

        {!loading && installed && !running && !starting && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stopped</span>
        )}

        {!loading && (starting || (installed && svc?.phase === 'starting')) && !running && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={12} className="spin" /> Starting up...
            </span>
            <CryptoLogs service="btcpay" active />
          </div>
        )}

        {!loading && running && (
          <>
            <div className="crypto-card-stats">
              <div><span className="dim">Up</span> {formatUptime(svc?.uptime_seconds ?? null)}</div>
              <div><span className="dim">Port</span> 3003</div>
              {svc?.ram_mb != null && (
                <div className="crypto-card-ram" style={{ gridColumn: 'span 2' }}>
                  <Cpu size={11} /> {svc.ram_mb} MB
                </div>
              )}
            </div>
            <CryptoLogs service="btcpay" active />

            {/* ─── SERVER section ─── */}
            <button className="btc-ext-toggle" onClick={() => toggleSection('server')}>
              {expandedSections.has('server') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Server size={11} /> Server
            </button>
            {expandedSections.has('server') && (
              <div className="btc-ext-content">
                {info?.server ? (
                  <div className="btcpay-grid">
                    <div><span className="dim">Version</span> <span className="val">{info.server.version || 'unknown'}</span></div>
                    <div><span className="dim">Synced</span> <span className="val" style={{ color: info.server.synchronized ? '#22c55e' : '#f59e0b' }}>{info.server.synchronized ? 'Yes' : 'No'}</span></div>
                    {info.current_user && (
                      <div style={{ gridColumn: 'span 2' }}><span className="dim">User</span> <span className="val">{info.current_user.email}</span></div>
                    )}
                    {info.server.supported_payment_methods.length > 0 && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <span className="dim">Payment Methods</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {info.server.supported_payment_methods.map(pm => (
                            <span key={pm} className="btcpay-tag">{pm}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : !info ? (
                  <span className="btcpay-hint" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Loader2 size={10} className="spin" /> Loading server info...
                  </span>
                ) : (
                  <span className="btcpay-hint">Server not responding — may be syncing</span>
                )}
              </div>
            )}

            {/* ─── STORES sections ─── */}
            {info?.stores && info.stores.length > 0 && info.stores.map(store => (
              <div key={store.id}>
                <button className="btc-ext-toggle" onClick={() => toggleSection(`store-${store.id}`)}>
                  {expandedSections.has(`store-${store.id}`) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <Store size={11} /> {store.name}
                </button>
                {expandedSections.has(`store-${store.id}`) && (
                  <div className="btc-ext-content">
                    <div className="btcpay-grid">
                      <div><span className="dim">Currency</span> <span className="val">{store.default_currency}</span></div>
                      <div>
                        <span className="dim">Methods</span>
                        <span className="val">{store.payment_methods.length > 0 ? store.payment_methods.join(', ') : 'None'}</span>
                      </div>
                    </div>

                    {/* Users */}
                    {store.users.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div className="btcpay-sub-header"><Users size={10} /> Users</div>
                        <div className="btcpay-users">
                          {store.users.map((u, i) => (
                            <div key={i} className="btcpay-user-row">
                              <span className="btcpay-user-email">{u.email}</span>
                              <span className="btcpay-role-badge">{u.role}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Wallet */}
                    {store.wallet && (
                      <div style={{ marginTop: 8 }}>
                        <div className="btcpay-sub-header"><Wallet size={10} /> Wallet</div>
                        <div className="btcpay-grid">
                          <div><span className="dim">On-chain</span> <span className="val">{formatBtc(store.wallet.onchain_confirmed)} BTC</span></div>
                          {store.wallet.onchain_unconfirmed > 0 && (
                            <div><span className="dim">Pending</span> <span className="val" style={{ color: '#f59e0b' }}>+{formatBtc(store.wallet.onchain_unconfirmed)} BTC</span></div>
                          )}
                          {store.wallet.lightning != null && (
                            <div><span className="dim"><Zap size={9} style={{ display: 'inline' }} /> Lightning</span> <span className="val">{formatBtc(store.wallet.lightning)} BTC</span></div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Invoices */}
                    <div style={{ marginTop: 8 }}>
                      <div className="btcpay-sub-header"><Receipt size={10} /> Invoices ({store.invoices.total})</div>
                      {store.invoices.recent.length > 0 ? (
                        <div className="btcpay-invoices">
                          {store.invoices.recent.map(inv => (
                            <div key={inv.id} className="btcpay-invoice-row">
                              <span className="btcpay-inv-amount">{inv.amount} {inv.currency}</span>
                              <span className="btcpay-inv-status" style={{ color: statusColor(inv.status) }}>{inv.status}</span>
                              <span className="btcpay-inv-date">{inv.created ? new Date(inv.created).toLocaleDateString() : '-'}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="btcpay-hint">No invoices yet</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Show hint if no stores and info loaded */}
            {info && info.stores.length === 0 && (
              <div style={{ padding: '8px 14px' }}>
                <span className="btcpay-hint">No stores found. Create a store in BTCPay Server first.</span>
              </div>
            )}
          </>
        )}

        <UpdateCheck service="btcpay" installed={installed} loading={!!loading} />
      </div>

      <style>{`
        .btcpay-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 11px; }
        .btcpay-grid .dim { color: var(--text-muted); }
        .btcpay-grid .val { color: var(--text); margin-left: 4px; }
        .btcpay-tag { display: inline-block; padding: 1px 6px; font-size: 10px; border-radius: 3px; background: rgba(255,255,255,0.06); color: var(--text-dim); border: 1px solid var(--border); }
        .btcpay-hint { font-size: 11px; color: var(--text-muted); font-style: italic; }
        .btcpay-sub-header { display: flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
        .btcpay-users { display: flex; flex-direction: column; gap: 2px; }
        .btcpay-user-row { display: flex; align-items: center; justify-content: space-between; font-size: 11px; padding: 2px 0; }
        .btcpay-user-email { color: var(--text); }
        .btcpay-role-badge { font-size: 10px; padding: 1px 6px; border-radius: 3px; background: rgba(81,177,62,0.12); color: #51b13e; text-transform: capitalize; }
        .btcpay-invoices { display: flex; flex-direction: column; gap: 2px; }
        .btcpay-invoice-row { display: flex; align-items: center; gap: 8px; font-size: 11px; padding: 2px 0; }
        .btcpay-inv-amount { color: var(--text); min-width: 80px; font-variant-numeric: tabular-nums; }
        .btcpay-inv-status { font-size: 10px; text-transform: capitalize; }
        .btcpay-inv-date { color: var(--text-muted); margin-left: auto; font-size: 10px; }
      `}</style>
    </div>
  );
}
