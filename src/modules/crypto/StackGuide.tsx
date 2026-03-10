import { useState } from 'react';
import { ChevronRight, ChevronDown, Bitcoin, Zap, CreditCard, Server } from 'lucide-react';

interface ServiceInfo {
  name: string;
  installed: boolean;
  running: boolean;
  phase: string;
}

interface Props {
  services: ServiceInfo[];
  onNodeClick: (service: string) => void;
}

const ALL_IDS = ['bitcoind', 'lightning', 'electrs', 'toshi-moto', 'btcpay', 'monerod'];

function getDotColor(svc: ServiceInfo | undefined): string {
  if (!svc) return '#6b7280';
  if (!svc.installed) return '#6b7280';
  if (!svc.running) return '#6b7280';
  if (svc.phase === 'syncing') return '#f59e0b';
  return '#22c55e';
}

function getStatusLabel(svc: ServiceInfo | undefined): string {
  if (!svc || !svc.installed) return 'Not installed';
  if (!svc.running) return 'Stopped';
  if (svc.phase === 'syncing') return 'Syncing';
  return 'Running';
}

function NodeBtn({ id, label, icon, constraint, optional, svc, onClick }: {
  id: string;
  label: string;
  icon: React.ReactNode;
  constraint?: string;
  optional?: string;
  svc: ServiceInfo | undefined;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="sg-node">
      {icon}
      <span className="sg-node-name">{label}</span>
      {constraint && <span className="sg-constraint">{constraint}</span>}
      {optional && <span className="sg-optional">{optional}</span>}
      <span className="sg-dot" style={{ background: getDotColor(svc) }} />
      <span className="sg-status">{getStatusLabel(svc)}</span>
    </button>
  );
}

export function StackGuide({ services, onNodeClick }: Props) {
  const allInstalled = ALL_IDS.every(id => services.find(s => s.name === id)?.installed);
  const [expanded, setExpanded] = useState(!allInstalled);

  const getSvc = (id: string) => services.find(s => s.name === id);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="sg-toggle"
        style={{ borderRadius: expanded ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)' }}
      >
        <Server size={13} style={{ color: 'var(--text-muted)' }} />
        Stack Setup Guide
        <div style={{ display: 'flex', gap: 3, marginLeft: 8 }}>
          {ALL_IDS.map(id => (
            <span key={id} style={{ width: 6, height: 6, borderRadius: '50%', background: getDotColor(getSvc(id)) }} />
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {expanded && (
        <div className="sg-body">
          <div className="sg-columns">

            {/* ─── Bitcoin Ecosystem (tree) ─── */}
            <div className="sg-tree">
              <div className="sg-tree-title">Bitcoin Ecosystem</div>

              {/* Root: Bitcoin Core */}
              <NodeBtn
                id="bitcoind" label="Bitcoin Core"
                icon={<Bitcoin size={12} style={{ color: '#f7931a' }} />}
                svc={getSvc('bitcoind')}
                onClick={() => onNodeClick('bitcoind')}
              />

              {/* Branches */}
              <div className="sg-branches">
                <div className="sg-branch">
                  <span className="sg-pipe">├</span>
                  <NodeBtn
                    id="lightning" label="Core Lightning"
                    icon={<Zap size={12} style={{ color: '#f59e0b' }} />}
                    svc={getSvc('lightning')}
                    onClick={() => onNodeClick('lightning')}
                  />
                </div>
                <div className="sg-branch">
                  <span className="sg-pipe">├</span>
                  <NodeBtn
                    id="electrs" label="Electrum Server"
                    icon={<span style={{ fontSize: 11 }}>&#9889;</span>}
                    constraint="prune=0, txindex=1"
                    svc={getSvc('electrs')}
                    onClick={() => onNodeClick('electrs')}
                  />
                </div>
                <div className="sg-branch">
                  <span className="sg-pipe">├</span>
                  <NodeBtn
                    id="toshi-moto" label="Toshi Moto"
                    icon={<Bitcoin size={12} style={{ color: '#f7931a' }} />}
                    svc={getSvc('toshi-moto')}
                    onClick={() => onNodeClick('toshi-moto')}
                  />
                </div>
                <div className="sg-branch">
                  <span className="sg-pipe">└</span>
                  <NodeBtn
                    id="btcpay" label="BTCPay Server"
                    icon={<CreditCard size={12} style={{ color: '#51b13e' }} />}
                    optional="+ Lightning optional"
                    svc={getSvc('btcpay')}
                    onClick={() => onNodeClick('btcpay')}
                  />
                </div>
              </div>
            </div>

            {/* ─── Independent ─── */}
            <div className="sg-tree">
              <div className="sg-tree-title">Independent</div>
              <NodeBtn
                id="monerod" label="Monero Node"
                icon={<span style={{ fontSize: 11, color: '#ff6600' }}>&#9399;</span>}
                svc={getSvc('monerod')}
                onClick={() => onNodeClick('monerod')}
              />
              <div className="sg-tree-note">
                No dependencies. Can sync in parallel with Bitcoin Core.
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sg-toggle { width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--surface); border: 1px solid var(--border); cursor: pointer; color: var(--text); font-size: 0.8125rem; font-weight: 500; font-family: var(--font-sans); }
        .sg-body { padding: 16px; background: var(--surface); border: 1px solid var(--border); border-top: none; border-radius: 0 0 var(--radius-lg) var(--radius-lg); }
        .sg-columns { display: flex; gap: 16px; }
        .sg-tree { flex: 1; min-width: 0; }
        .sg-tree-title { font-size: 0.6875rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
        .sg-tree-note { font-size: 0.6875rem; color: var(--text-muted); font-style: italic; margin-top: 8px; padding-left: 4px; }
        .sg-branches { padding-left: 6px; display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
        .sg-branch { display: flex; align-items: center; gap: 4px; }
        .sg-pipe { color: var(--border); font-family: monospace; font-size: 0.75rem; line-height: 1; flex-shrink: 0; width: 12px; text-align: center; }
        .sg-node { display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: none; border: 1px solid transparent; border-radius: var(--radius-sm); cursor: pointer; color: var(--text); font-size: 0.75rem; font-family: var(--font-sans); flex: 1; min-width: 0; text-align: left; }
        .sg-node:hover { background: rgba(255,255,255,0.03); border-color: var(--border); }
        .sg-node-name { white-space: nowrap; }
        .sg-constraint { font-size: 0.5625rem; color: var(--amber, #f59e0b); background: rgba(245,158,11,0.1); padding: 1px 4px; border-radius: 2px; white-space: nowrap; }
        .sg-optional { font-size: 0.5625rem; color: var(--text-muted); background: rgba(255,255,255,0.04); padding: 1px 4px; border-radius: 2px; white-space: nowrap; }
        .sg-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-left: auto; }
        .sg-status { font-size: 0.5625rem; color: var(--text-muted); white-space: nowrap; min-width: 55px; text-align: right; }
      `}</style>
    </div>
  );
}
