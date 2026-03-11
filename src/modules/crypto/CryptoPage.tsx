import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { api } from '@/services/api';
import { AlertTriangle, RefreshCw, ExternalLink, CreditCard, Bitcoin, Loader2 } from 'lucide-react';
import { BtcStatusCard } from './BtcStatusCard';
import { BtcSetupWizard } from './BtcSetupWizard';
import { LightningStatusCard } from './LightningStatusCard';
import { LightningSetupWizard } from './LightningSetupWizard';
import { MoneroStatusCard } from './MoneroStatusCard';
import { MoneroSetupWizard } from './MoneroSetupWizard';
import { ElectrsStatusCard } from './ElectrsStatusCard';
import { ElectrsSetupWizard } from './ElectrsSetupWizard';
import { ToshiMotoInstallPanel } from './ToshiMotoInstallPanel';
import { BtcPayInstallPanel } from './BtcPayInstallPanel';
import { BtcPayStatusCard } from './BtcPayStatusCard';
import { StackGuide } from './StackGuide';
import { WalletBalanceCard } from './WalletBalanceCard';
import { BtcPayKeySetup } from './BtcPayKeySetup';

interface CryptoServiceStatus {
  name: string;
  display_name: string;
  installed: boolean;
  running: boolean;
  ram_mb: number | null;
  uptime_seconds: number | null;
  phase: string;
  error: string | null;
}

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

interface LightningInfo {
  id: string;
  alias: string;
  num_channels: number;
  num_active_channels: number;
  num_peers: number;
  total_capacity_sat: number;
  synced_to_chain: boolean;
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

interface StackStatus {
  services: CryptoServiceStatus[];
  btc: BtcSync | null;
  btc_extended: BtcExtendedStats | null;
  monero: MoneroSync | null;
  monero_extended: MoneroExtendedStats | null;
  lightning: LightningInfo | null;
  lightning_extended: LightningExtendedStats | null;
}

type WizardTarget = 'bitcoind' | 'lightning' | 'monerod' | 'electrs' | 'toshi-moto' | 'btcpay' | null;

export function Component() {
  const navigate = useNavigate();
  const [stack, setStack] = useState<StackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wizardTarget, setWizardTarget] = useState<WizardTarget>(null);
  const [wizardMode, setWizardMode] = useState<'install' | 'configure'>('install');
  const [keySetupOpen, setKeySetupOpen] = useState(false);
  const [startingServices, setStartingServices] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      // Fast fetch — renders cards with basic data immediately
      const basic = await api.get<{ data: StackStatus }>('/crypto/status');
      setStack(basic.data);
      setLoading(false);

      // Clear starting flag for services that are now running
      setStartingServices(prev => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        for (const svc of basic.data.services) {
          if (svc.running) next.delete(svc.name);
        }
        return next.size === prev.size ? prev : next;
      });
      setError(null);

      // Extended fetch — merges heavier stats when ready
      try {
        const ext = await api.get<{ data: {
          btc_extended: BtcExtendedStats | null;
          monero_extended: MoneroExtendedStats | null;
          lightning_extended: LightningExtendedStats | null;
        } }>('/crypto/status/extended');
        setStack(prev => prev ? {
          ...prev,
          btc_extended: ext.data.btc_extended,
          monero_extended: ext.data.monero_extended,
          lightning_extended: ext.data.lightning_extended,
        } : prev);
      } catch {
        // Extended stats failed — basic data is still shown
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch crypto stack status');
      setLoading(false);
    }
  }, []);

  // Poll faster (5s) while any service is starting, otherwise 30s
  useEffect(() => {
    refresh();
    const interval = startingServices.size > 0 ? 5_000 : 30_000;
    const id = setInterval(refresh, interval);
    return () => clearInterval(id);
  }, [refresh, startingServices.size]);

  const handleAction = async (service: string, action: 'start' | 'stop') => {
    try {
      if (action === 'start') {
        setStartingServices(prev => new Set(prev).add(service));
      }
      await api.post(`/crypto/${service}/${action}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} ${service}`);
    }
  };

  const closeWizard = () => setWizardTarget(null);
  const doneWizard = () => { setWizardTarget(null); refresh(); };

  const openWizard = (target: WizardTarget, mode: 'install' | 'configure') => {
    setWizardMode(mode);
    setWizardTarget(target);
  };

  if (error && !stack && !loading) {
    return (
      <div className="crypto-center">
        <AlertTriangle size={28} style={{ color: 'var(--error)' }} />
        <span>{error}</span>
        <button className="crypto-btn" onClick={refresh}>Retry</button>
      </div>
    );
  }

  const svc = (name: string) => stack?.services.find(s => s.name === name);
  const btcSvc = svc('bitcoind');
  const electrsSvc = svc('electrs');
  const lightningSvc = svc('lightning');
  const moneroSvc = svc('monerod');
  const toshiSvc = svc('toshi-moto');
  const btcpaySvc = svc('btcpay');

  const btcRunning = btcSvc?.running ?? false;
  const btcFullNode = stack?.btc ? !stack.btc.pruned : undefined;

  return (
    <div className="crypto-page">
      <div className="crypto-header">
        <h2>Crypto Stack</h2>
        <button className="crypto-btn-icon" onClick={refresh} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {error && <div className="crypto-error">{error}</div>}

      {/* Stack Guide */}
      <StackGuide
        services={stack?.services ?? []}
        onNodeClick={(service) => {
          const s = svc(service);
          if (!s?.installed) {
            openWizard(service as WizardTarget, 'install');
          }
        }}
      />

      {/* Wallet Balance */}
      <div style={{ marginBottom: 16 }}>
        <WalletBalanceCard
          btcpayInstalled={btcpaySvc?.installed ?? false}
          btcpayRunning={btcpaySvc?.running ?? false}
          loading={!stack}
          onInstall={() => openWizard('btcpay', 'install')}
          onConnect={() => setKeySetupOpen(true)}
        />
      </div>

      <div className="crypto-grid">
        <BtcStatusCard
          svc={btcSvc ?? null}
          sync={stack?.btc ?? null}
          extended={stack?.btc_extended ?? null}
          loading={!stack}
          starting={startingServices.has('bitcoind')}
          onInstall={() => openWizard('bitcoind', 'install')}
          onStart={() => handleAction('bitcoind', 'start')}
          onStop={() => handleAction('bitcoind', 'stop')}
          onConfigure={() => openWizard('bitcoind', 'configure')}
        />

        <LightningStatusCard
          svc={lightningSvc ?? null}
          info={stack?.lightning ?? null}
          extended={stack?.lightning_extended ?? null}
          loading={!stack}
          starting={startingServices.has('lightning')}
          onInstall={() => openWizard('lightning', 'install')}
          onStart={() => handleAction('lightning', 'start')}
          onStop={() => handleAction('lightning', 'stop')}
          onConfigure={() => openWizard('lightning', 'configure')}
        />

        <MoneroStatusCard
          svc={moneroSvc ?? null}
          sync={stack?.monero ?? null}
          extended={stack?.monero_extended ?? null}
          loading={!stack}
          starting={startingServices.has('monerod')}
          onInstall={() => openWizard('monerod', 'install')}
          onStart={() => handleAction('monerod', 'start')}
          onStop={() => handleAction('monerod', 'stop')}
          onConfigure={() => openWizard('monerod', 'configure')}
        />

        <ElectrsStatusCard
          svc={electrsSvc ?? null}
          btcPruned={stack?.btc?.pruned ?? false}
          loading={!stack}
          onInstall={() => openWizard('electrs', 'install')}
          onStart={() => handleAction('electrs', 'start')}
          onStop={() => handleAction('electrs', 'stop')}
          onConfigure={() => openWizard('electrs', 'configure')}
        />

        <BtcPayStatusCard
          svc={btcpaySvc ?? null}
          loading={!stack}
          starting={startingServices.has('btcpay')}
          onInstall={() => openWizard('btcpay', 'install')}
          onStart={() => handleAction('btcpay', 'start')}
          onStop={() => handleAction('btcpay', 'stop')}
          onConfigure={() => setKeySetupOpen(true)}
          onOpenWebUI={() => window.open('http://localhost:3003', '_blank', 'noopener,noreferrer')}
        />
      </div>

      {/* ─── Embedded Apps ──────────────────────────────── */}
      <h3 className="crypto-section-title">Apps</h3>
      <div className="crypto-apps-row">
        <button className="crypto-app-card" onClick={() => {
          if (!toshiSvc?.installed) {
            openWizard('toshi-moto', 'install');
          } else {
            navigate('/crypto/toshi-moto');
          }
        }}>
          <Bitcoin size={20} style={{ color: '#f7931a' }} />
          <div>
            <div className="crypto-app-name">Toshi Moto</div>
            <div className="crypto-app-desc">Bitcoin Explorer</div>
          </div>
          <div style={{ flex: 1 }} />
          {!stack ? <Loader2 size={13} className="spin" style={{ color: 'var(--text-muted)' }} /> : <span className="crypto-app-dot" style={{ background: toshiSvc?.running ? '#22c55e' : '#6b7280' }} />}
          <ExternalLink size={13} style={{ color: 'var(--text-muted)' }} />
        </button>

        <button className="crypto-app-card" onClick={() => {
          if (!btcpaySvc?.installed) {
            openWizard('btcpay', 'install');
          } else {
            window.open('http://localhost:3003', '_blank', 'noopener,noreferrer');
          }
        }}>
          <CreditCard size={20} style={{ color: '#51b13e' }} />
          <div>
            <div className="crypto-app-name">BTCPay Server</div>
            <div className="crypto-app-desc">Payment Processor</div>
          </div>
          <div style={{ flex: 1 }} />
          {!stack ? <Loader2 size={13} className="spin" style={{ color: 'var(--text-muted)' }} /> : <span className="crypto-app-dot" style={{ background: btcpaySvc?.running ? '#22c55e' : '#6b7280' }} />}
          <ExternalLink size={13} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* ─── Wizards ──────────────────────────────────── */}
      {wizardTarget === 'bitcoind' && (
        <BtcSetupWizard mode={wizardMode} onClose={closeWizard} onDone={doneWizard} />
      )}
      {wizardTarget === 'lightning' && (
        <LightningSetupWizard mode={wizardMode} btcRunning={btcRunning} onClose={closeWizard} onDone={doneWizard} />
      )}
      {wizardTarget === 'monerod' && (
        <MoneroSetupWizard mode={wizardMode} onClose={closeWizard} onDone={doneWizard} />
      )}
      {wizardTarget === 'electrs' && (
        <ElectrsSetupWizard mode={wizardMode} btcFullNode={btcFullNode} onClose={closeWizard} onDone={doneWizard} />
      )}
      {wizardTarget === 'toshi-moto' && (
        <ToshiMotoInstallPanel btcRunning={btcRunning} onClose={closeWizard} onDone={doneWizard} />
      )}
      {wizardTarget === 'btcpay' && (
        <BtcPayInstallPanel btcRunning={btcRunning} lightningRunning={lightningSvc?.running} onClose={closeWizard} onDone={doneWizard} />
      )}
      {keySetupOpen && (
        <BtcPayKeySetup onClose={() => setKeySetupOpen(false)} onDone={() => { setKeySetupOpen(false); refresh(); }} />
      )}

      <style>{`
        .crypto-page { padding: 24px; }
        .crypto-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .crypto-header h2 { font-size: 18px; font-weight: 600; color: var(--text); margin: 0; }
        .crypto-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
        .crypto-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-dim); }
        .crypto-btn { padding: 6px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text); cursor: pointer; font-size: 13px; }
        .crypto-btn:hover { background: var(--surface-hover); }
        .crypto-btn-icon { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-dim); cursor: pointer; }
        .crypto-btn-icon:hover { background: var(--surface-hover); color: var(--text); }
        .crypto-error { padding: 8px 12px; margin-bottom: 12px; background: var(--error-bg, rgba(239,68,68,.1)); border: 1px solid var(--error); border-radius: var(--radius-md); color: var(--error); font-size: 13px; }
        .crypto-section-title { font-size: 14px; font-weight: 600; color: var(--text); margin: 24px 0 12px; }
        .crypto-apps-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
        .crypto-app-card { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); cursor: pointer; text-align: left; width: 100%; }
        .crypto-app-card:hover { background: var(--surface-hover); }
        .crypto-app-name { font-size: 13px; font-weight: 500; color: var(--text); }
        .crypto-app-desc { font-size: 11px; color: var(--text-muted); }
        .crypto-app-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
