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

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { api } from '@/services/api';

// ─── Subdirectory imports ─────────────────────────────────────
import { StackSetupGuide } from './setup/StackSetupGuide';
import { SectionHeader } from './shared/SectionHeader';
import type {
  CryptoServiceStatus, BtcSync, MoneroSync,
  BtcExtendedStats, MoneroExtendedStats,
  LightningInfo, LightningExtendedStats,
  StackStatus, WizardTarget,
} from './shared/crypto.types';

import { BtcStatusCard } from './btc/BtcStatusCard';
import { BtcSetupWizard } from './btc/BtcSetupWizard';
import { LightningCard } from './lightning/LightningCard';
import { LightningSetupWizard } from './lightning/LightningSetupWizard';
import { MoneroNodeCard } from './monero/MoneroNodeCard';
import { MoneroSetupWizard } from './monero/MoneroSetupWizard';
import { MoneroWalletCard } from './monero/MoneroWalletCard';
import { BtcPayCard } from './btcpay/BtcPayCard';
import { BtcPayStatusCard, type BtcPayInfo } from './btcpay/BtcPayStatusCard';
import { BtcPayInstallPanel } from './btcpay/BtcPayInstallPanel';
import { BtcPayKeySetup } from './btcpay/BtcPayKeySetup';
import { RotkiCard } from './rotki/RotkiCard';

interface MoneroWalletData {
  status: { rpc_reachable: boolean; active_wallet: string | null; height: number | null; version: number | null } | null;
  balance: { total_xmr: string; unlocked_xmr: string } | null;
  fiatPrice: number | null;
}

export function Component() {
  const [stack, setStack] = useState<StackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wizardTarget, setWizardTarget] = useState<WizardTarget>(null);
  const [wizardMode, setWizardMode] = useState<'install' | 'configure'>('install');
  const [keySetupOpen, setKeySetupOpen] = useState(false);
  const [btcpayInfo, setBtcpayInfo] = useState<BtcPayInfo | null>(null);
  const [startingServices, setStartingServices] = useState<Set<string>>(new Set());
  const [walletData, setWalletData] = useState<MoneroWalletData>({ status: null, balance: null, fiatPrice: null });

  const refresh = useCallback(async () => {
    // ── Fire ALL requests in parallel — no blocking awaits ──
    // 1) Fast services-only (~200ms) — renders the page instantly
    const servicesPromise = api.get<{ data: StackStatus }>('/crypto/status/services').then(res => {
      setStack(prev => prev ?? res.data); // only set if first load
      setLoading(false);
      setError(null);
      setStartingServices(prev => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        for (const svc of res.data.services) {
          if (svc.running) next.delete(svc.name);
        }
        return next.size === prev.size ? prev : next;
      });
      return res.data;
    }).catch((err: any) => {
      setError(err instanceof Error ? err.message : 'Failed to fetch crypto stack status');
      setLoading(false);
      return null;
    });

    // 2) Full status with sync data (2-8s) — merges sync info progressively
    api.get<{ data: StackStatus }>('/crypto/status').then(res => {
      setStack(res.data);
      setStartingServices(prev => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        for (const svc of res.data.services) {
          if (svc.running) next.delete(svc.name);
        }
        return next.size === prev.size ? prev : next;
      });
    }).catch(() => {});

    // 3) Extended stats (heaviest) — fills in last
    api.get<{ data: {
      btc_extended: BtcExtendedStats | null;
      monero_extended: MoneroExtendedStats | null;
      lightning_extended: LightningExtendedStats | null;
    } }>('/crypto/status/extended').then(ext => {
      setStack(prev => prev ? {
        ...prev,
        btc_extended: ext.data.btc_extended,
        monero_extended: ext.data.monero_extended,
        lightning_extended: ext.data.lightning_extended,
      } : prev);
    }).catch(() => {});

    // 4) BTCPay info (only if services show it running)
    servicesPromise.then(data => {
      const btcpaySvc = data?.services.find(s => s.name === 'btcpay');
      if (btcpaySvc?.running) {
        api.get<{ data: BtcPayInfo }>('/crypto/btcpay/info').then(res => {
          setBtcpayInfo(res.data as BtcPayInfo);
        }).catch(() => {});
      } else {
        setBtcpayInfo(null);
      }
    });

    // 5) Monero wallet status + balance + price (parallel)
    Promise.all([
      api.get<{ data: any }>('/crypto/monero-wallet/status').catch(() => null),
      api.get<{ data: any }>('/crypto/monero-wallet/balance').catch(() => null),
      api.get<{ data: any }>('/crypto/monero-wallet/price').catch(() => null),
    ]).then(([statusRes, balRes, priceRes]) => {
      setWalletData({
        status: statusRes?.data ?? null,
        balance: balRes?.data ?? null,
        fiatPrice: priceRes?.data?.usd ?? null,
      });
    });
  }, []);

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
  const lightningSvc = svc('lightning');
  const moneroSvc = svc('monerod');
  const btcpaySvc = svc('btcpay');

  const btcRunning = btcSvc?.running ?? false;

  return (
    <div className="crypto-page">
      <div className="crypto-header">
        <h2>Crypto Stack</h2>
        <button className="crypto-btn-icon" onClick={refresh} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {error && <div className="crypto-error">{error}</div>}

      {/* Stack Setup Guide */}
      <StackSetupGuide
        services={stack?.services ?? []}
        onNodeClick={(service) => {
          const s = svc(service);
          if (!s?.installed) {
            openWizard(service as WizardTarget, 'install');
          }
        }}
      />

      {/* ─── Nodes ─── */}
      <SectionHeader title="Nodes" />
      <div className="crypto-grid-nodes">
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

        <LightningCard
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

        <MoneroNodeCard
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
      </div>

      {/* ─── Wallets ─── */}
      <SectionHeader title="Wallets" />
      <div className="crypto-grid-wallets">
        <BtcPayCard
          svc={btcpaySvc ?? null}
          loading={!stack}
          starting={startingServices.has('btcpay')}
          info={btcpayInfo}
          onInstall={() => openWizard('btcpay', 'install')}
          onStart={() => handleAction('btcpay', 'start')}
          onStop={() => handleAction('btcpay', 'stop')}
          onConfigure={() => setKeySetupOpen(true)}
        />

        <MoneroWalletCard
          monerodRunning={moneroSvc?.running ?? false}
          walletStatus={walletData.status}
          walletBalance={walletData.balance}
          fiatPrice={walletData.fiatPrice}
        />
      </div>

      {/* ─── Portfolio ─── */}
      <SectionHeader title="Portfolio" />
      <div className="crypto-grid-portfolio">
        <RotkiCard />
      </div>

      {/* ─── Wizards ─── */}
      {wizardTarget === 'bitcoind' && (
        <BtcSetupWizard mode={wizardMode} onClose={closeWizard} onDone={doneWizard} />
      )}
      {wizardTarget === 'lightning' && (
        <LightningSetupWizard mode={wizardMode} btcRunning={btcRunning} onClose={closeWizard} onDone={doneWizard} />
      )}
      {wizardTarget === 'monerod' && (
        <MoneroSetupWizard mode={wizardMode} onClose={closeWizard} onDone={doneWizard} />
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
        .crypto-grid-nodes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .crypto-grid-wallets { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .crypto-grid-portfolio { display: grid; grid-template-columns: 1fr; gap: 16px; }
        .crypto-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-dim); }
        .crypto-btn { padding: 6px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text); cursor: pointer; font-size: 13px; }
        .crypto-btn:hover { background: var(--surface-hover); }
        .crypto-btn-icon { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-dim); cursor: pointer; }
        .crypto-btn-icon:hover { background: var(--surface-hover); color: var(--text); }
        .crypto-error { padding: 8px 12px; margin-bottom: 12px; background: var(--error-bg, rgba(239,68,68,.1)); border: 1px solid var(--error); border-radius: var(--radius-md); color: var(--error); font-size: 13px; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1279px) {
          .crypto-grid-nodes { grid-template-columns: repeat(2, 1fr); }
          .crypto-grid-wallets { grid-template-columns: 1fr; }
        }
        @media (max-width: 767px) {
          .crypto-grid-nodes { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
