import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, LayoutDashboard, Send, Download, List, BookOpen, Users, Box, Shield, Lock, Pickaxe, Settings, Coins, Loader2, AlertCircle, Wallet, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { api } from '@/services/api';

import { OverviewTab } from './tabs/OverviewTab';
import { SendTab } from './tabs/SendTab';
import { ReceiveTab } from './tabs/ReceiveTab';
import { TransactionsTab } from './tabs/TransactionsTab';
import { AddressBookTab } from './tabs/AddressBookTab';
import { AccountsTab } from './tabs/AccountsTab';
import { OutputsTab } from './tabs/OutputsTab';
import { ProofsTab } from './tabs/ProofsTab';
import { MultisigTab } from './tabs/MultisigTab';
import { ColdSigningTab } from './tabs/ColdSigningTab';
import { MiningTab } from './tabs/MiningTab';
import { SettingsTab } from './tabs/SettingsTab';
import { AccountSelector } from './components/AccountSelector';
import { SendConfirmDialog } from './components/SendConfirmDialog';
import { useMoneroRpc } from './hooks/useMoneroRpc';
import { useWalletBalance } from './hooks/useWalletBalance';
import { useFiatPrice } from './hooks/useFiatPrice';

type TabId = 'overview' | 'send' | 'receive' | 'transactions' | 'addressbook' | 'accounts' | 'outputs' | 'proofs' | 'multisig' | 'coldsigning' | 'mining' | 'settings';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={14} /> },
  { id: 'send', label: 'Send', icon: <Send size={14} /> },
  { id: 'receive', label: 'Receive', icon: <Download size={14} /> },
  { id: 'transactions', label: 'Transactions', icon: <List size={14} /> },
  { id: 'addressbook', label: 'Address Book', icon: <BookOpen size={14} /> },
  { id: 'accounts', label: 'Accounts', icon: <Users size={14} /> },
  { id: 'outputs', label: 'Outputs', icon: <Coins size={14} /> },
  { id: 'proofs', label: 'Proofs', icon: <Shield size={14} /> },
  { id: 'multisig', label: 'Multisig', icon: <Lock size={14} /> },
  { id: 'coldsigning', label: 'Cold Signing', icon: <Box size={14} /> },
  { id: 'mining', label: 'Mining', icon: <Pickaxe size={14} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={14} /> },
];

const TAB_COMPONENTS: Record<TabId, React.FC> = {
  overview: OverviewTab,
  send: SendTab,
  receive: ReceiveTab,
  transactions: TransactionsTab,
  addressbook: AddressBookTab,
  accounts: AccountsTab,
  outputs: OutputsTab,
  proofs: ProofsTab,
  multisig: MultisigTab,
  coldsigning: ColdSigningTab,
  mining: MiningTab,
  settings: SettingsTab,
};

interface WalletStatus {
  rpc_reachable: boolean;
  active_wallet: string | null;
  height: number | null;
  version: number | null;
}

export function Component() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // ─── Status gate: check RPC, auto-start if needed ───
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await api.get<{ data: WalletStatus }>('/crypto/monero-wallet/status');
      const status = (res.data as any) ?? null;
      setWalletStatus(status);
      if (status?.rpc_reachable) {
        setStarting(false);
        stopPolling();
      }
      return status as WalletStatus | null;
    } catch {
      const fallback = { rpc_reachable: false, active_wallet: null, height: null, version: null };
      setWalletStatus(fallback);
      return fallback;
    } finally {
      setStatusLoading(false);
    }
  }, [stopPolling]);

  // Auto-start wallet-rpc when unreachable, then poll until ready
  const startAndPoll = useCallback(async () => {
    setStarting(true);
    setStartFailed(false);
    startTimeRef.current = Date.now();

    // Fire start (don't block on result)
    api.post('/crypto/monero-wallet/start').catch(() => {});

    // Poll status every 3s until reachable or 60s timeout
    pollRef.current = setInterval(async () => {
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > 60_000) {
        stopPolling();
        setStarting(false);
        setStartFailed(true);
        return;
      }
      const status = await refreshStatus();
      if (status?.rpc_reachable) {
        stopPolling();
        setStarting(false);
      }
    }, 3_000);
  }, [refreshStatus, stopPolling]);

  useEffect(() => {
    refreshStatus().then((status) => {
      if (!status?.rpc_reachable) startAndPoll();
    });
    return stopPolling;
  }, [refreshStatus, startAndPoll, stopPolling]);

  const rpcReachable = walletStatus?.rpc_reachable ?? false;
  const walletOpen = rpcReachable && !!walletStatus?.active_wallet;

  // ─── Hooks gated on wallet status ───
  const rpc = useMoneroRpc();
  const { balance } = useWalletBalance(walletOpen);
  const { convertXmr } = useFiatPrice(walletOpen);

  const handleWalletChange = useCallback((wallet: string) => {
    setWalletDialog('open');
    setDialogName(wallet);
    setDialogPassword('');
    setDialogError(null);
    setDialogSubmitting(false);
  }, []);

  // ─── Create / Restore / Open wallet dialogs ───
  const [walletDialog, setWalletDialog] = useState<'create' | 'restore' | 'open' | null>(null);
  const [dialogName, setDialogName] = useState('');
  const [dialogPassword, setDialogPassword] = useState('');
  const [dialogSeed, setDialogSeed] = useState('');
  const [dialogRestoreHeight, setDialogRestoreHeight] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);

  const resetDialog = useCallback(() => {
    setWalletDialog(null);
    setDialogName('');
    setDialogPassword('');
    setDialogSeed('');
    setDialogRestoreHeight('');
    setDialogError(null);
    setDialogSubmitting(false);
  }, []);

  const handleCreateNew = useCallback(() => {
    resetDialog();
    setWalletDialog('create');
  }, [resetDialog]);

  const handleRestoreFromSeed = useCallback(() => {
    resetDialog();
    setWalletDialog('restore');
  }, [resetDialog]);

  const handleDialogSubmit = useCallback(async () => {
    const name = dialogName.trim();
    if (!name) { setDialogError('Wallet name is required'); return; }

    setDialogSubmitting(true);
    setDialogError(null);

    if (walletDialog === 'open') {
      const result = await rpc.call('open_wallet', {
        filename: name,
        password: dialogPassword,
      });
      if (result === null && !rpc.pendingConfirmation) {
        setDialogError(rpc.error || 'Failed to open wallet');
        setDialogSubmitting(false);
      }
    } else if (walletDialog === 'create') {
      const result = await rpc.call('create_wallet', {
        filename: name,
        password: dialogPassword,
        language: 'English',
      });
      if (result === null && !rpc.pendingConfirmation) {
        setDialogError(rpc.error || 'Failed to create wallet');
        setDialogSubmitting(false);
      }
      // If pendingConfirmation is set, SendConfirmDialog will handle it
    } else {
      const seed = dialogSeed.trim();
      if (!seed) { setDialogError('Mnemonic seed is required'); setDialogSubmitting(false); return; }

      const params: Record<string, unknown> = {
        filename: name,
        password: dialogPassword,
        seed,
        language: 'English',
      };
      if (dialogRestoreHeight) {
        const h = parseInt(dialogRestoreHeight, 10);
        if (!isNaN(h) && h >= 0) params.restore_height = h;
      }

      const result = await rpc.call('restore_deterministic_wallet', params);
      if (result === null && !rpc.pendingConfirmation) {
        setDialogError(rpc.error || 'Failed to restore wallet');
        setDialogSubmitting(false);
      }
    }
  }, [walletDialog, dialogName, dialogPassword, dialogSeed, dialogRestoreHeight, rpc]);

  // Wrap rpc.confirm to also refresh status and close dialog after success.
  // rpc.confirm() throws on failure — SendConfirmDialog catches it and shows the error.
  const handleRpcConfirm = useCallback(async () => {
    const result = await rpc.confirm();
    resetDialog();
    await refreshStatus();
    return result;
  }, [rpc, resetDialog, refreshStatus]);

  const totalXmr = balance?.total_xmr ?? '0.000000000000';
  const totalFloat = parseFloat(totalXmr);
  const fiatStr = convertXmr(totalFloat);

  // ─── Content area: gated on status ───
  const ActiveComponent = TAB_COMPONENTS[activeTab];

  let content: React.ReactNode;
  if (statusLoading || starting) {
    content = (
      <div className="mwv-status-msg">
        <Loader2 size={20} className="spin" />
        <span>{statusLoading ? 'Checking wallet RPC...' : 'Starting Wallet RPC...'}</span>
      </div>
    );
  } else if (!rpcReachable) {
    content = (
      <div className="mwv-status-msg">
        <AlertCircle size={20} style={{ color: 'var(--error, #ef4444)' }} />
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>
            {startFailed ? 'Wallet RPC failed to start' : 'Wallet RPC not reachable'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {startFailed
              ? 'The service did not become reachable within 60 seconds. Check logs or try again.'
              : 'Start the Monero Wallet RPC service or check the connection.'}
          </div>
          <button className="mwv-retry-btn" onClick={startAndPoll}>Retry</button>
        </div>
      </div>
    );
  } else if (!walletOpen) {
    content = (
      <div className="mwv-status-msg">
        <Wallet size={20} style={{ color: '#f59e0b' }} />
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>No wallet open</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Select a wallet from the sidebar, or create a new one.
          </div>
        </div>
      </div>
    );
  } else {
    content = <ActiveComponent />;
  }

  return (
    <div className="mwv-layout">
      {/* Sidebar */}
      <div className="mwv-sidebar">
        <button className="mwv-back" onClick={() => navigate('/crypto')}>
          <ArrowLeft size={14} /> Back to Stack
        </button>

        <div className="mwv-sidebar-title">
          <span style={{ color: '#ff6600' }}>&#9399;</span> Monero Wallet
        </div>

        {/* Wallet selector — only render when RPC reachable */}
        {rpcReachable && (
          <div style={{ padding: '0 4px', marginBottom: 8 }}>
            <AccountSelector
              onWalletChange={handleWalletChange}
              onCreateNew={handleCreateNew}
              onRestoreFromSeed={handleRestoreFromSeed}
            />
          </div>
        )}

        {/* Balance summary — only when wallet is open */}
        {walletOpen && (
          <>
            <div className="mwv-balance-summary">
              <div className="mwv-balance-amount">{totalXmr} <span className="mwv-balance-unit">XMR</span></div>
              {fiatStr && <div className="mwv-balance-fiat">{fiatStr}</div>}
            </div>

            <div className="mwv-sidebar-divider" />
          </>
        )}

        {/* Tab navigation — only when wallet is open */}
        {walletOpen && TABS.map(tab => (
          <button
            key={tab.id}
            className={`mwv-tab ${activeTab === tab.id ? 'mwv-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mwv-content">
        {content}
      </div>

      {/* Create / Restore / Open wallet dialog */}
      {walletDialog && !rpc.pendingConfirmation && (
        <div className="mwv-dialog-overlay" onClick={resetDialog}>
          <div className="mwv-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="mwv-dialog-header">
              <span>{walletDialog === 'open' ? `Open "${dialogName}"` : walletDialog === 'create' ? 'Create New Wallet' : 'Restore from Seed'}</span>
              <button className="mwv-dialog-close" onClick={resetDialog}><X size={14} /></button>
            </div>
            <div className="mwv-dialog-body">
              {walletDialog !== 'open' && (
                <label className="mwv-dialog-label">
                  Wallet Name
                  <input
                    className="mwv-dialog-input"
                    value={dialogName}
                    onChange={(e) => setDialogName(e.target.value)}
                    placeholder="my-wallet"
                    autoFocus
                  />
                </label>
              )}
              <label className="mwv-dialog-label">
                Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                <input
                  className="mwv-dialog-input"
                  type="password"
                  value={dialogPassword}
                  onChange={(e) => setDialogPassword(e.target.value)}
                  placeholder="Leave empty for no password"
                  autoFocus={walletDialog === 'open'}
                  onKeyDown={(e) => e.key === 'Enter' && handleDialogSubmit()}
                />
              </label>
              {walletDialog === 'restore' && (
                <>
                  <label className="mwv-dialog-label">
                    Mnemonic Seed <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(25 words)</span>
                    <textarea
                      className="mwv-dialog-input mwv-dialog-textarea"
                      value={dialogSeed}
                      onChange={(e) => setDialogSeed(e.target.value)}
                      placeholder="Enter your 25-word mnemonic seed..."
                      rows={3}
                    />
                  </label>
                  <label className="mwv-dialog-label">
                    Restore Height <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                    <input
                      className="mwv-dialog-input"
                      type="number"
                      value={dialogRestoreHeight}
                      onChange={(e) => setDialogRestoreHeight(e.target.value)}
                      placeholder="0 (scans from genesis)"
                    />
                  </label>
                </>
              )}
              {dialogError && <div className="mwv-dialog-error">{dialogError}</div>}
            </div>
            <div className="mwv-dialog-footer">
              <button className="mwv-dialog-btn-cancel" onClick={resetDialog}>Cancel</button>
              <button
                className="mwv-dialog-btn-ok"
                disabled={dialogSubmitting}
                onClick={handleDialogSubmit}
              >
                {dialogSubmitting
                  ? <><Loader2 size={13} className="spin" /> Submitting...</>
                  : walletDialog === 'open' ? 'Open' : walletDialog === 'create' ? 'Create' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {rpc.pendingConfirmation && (
        <SendConfirmDialog
          confirmation={rpc.pendingConfirmation}
          onConfirm={handleRpcConfirm}
          onDismiss={() => { rpc.dismissConfirmation(); setDialogSubmitting(false); }}
        />
      )}

      <style>{`
        .mwv-layout { position: absolute; inset: 0; display: flex; background: var(--bg); }
        .mwv-sidebar { width: 200px; flex-shrink: 0; border-right: 1px solid var(--border); background: var(--surface); display: flex; flex-direction: column; padding: 12px 8px; gap: 2px; overflow-y: auto; }
        .mwv-back { display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 12px; font-family: var(--font-sans); border-radius: var(--radius-sm); margin-bottom: 8px; }
        .mwv-back:hover { color: var(--text); background: var(--surface-hover); }
        .mwv-sidebar-title { font-size: 13px; font-weight: 600; color: var(--text); padding: 4px 8px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .mwv-balance-summary { padding: 6px 8px; font-variant-numeric: tabular-nums; }
        .mwv-balance-amount { font-size: 12px; font-weight: 600; color: var(--text); }
        .mwv-balance-unit { font-size: 10px; font-weight: 400; color: var(--text-muted); }
        .mwv-balance-fiat { font-size: 10px; color: var(--text-muted); margin-top: 1px; }
        .mwv-sidebar-divider { height: 1px; background: var(--border); margin: 6px 4px; }
        .mwv-tab { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 12px; font-family: var(--font-sans); border-radius: var(--radius-sm); text-align: left; width: 100%; }
        .mwv-tab:hover { background: var(--surface-hover); color: var(--text); }
        .mwv-tab-active { background: rgba(255,102,0,0.08); color: #ff6600; }
        .mwv-tab-active:hover { background: rgba(255,102,0,0.12); }
        .mwv-content { flex: 1; overflow-y: auto; padding: 24px; }
        .mwv-status-msg { display: flex; align-items: flex-start; gap: 12px; color: var(--text); font-size: 14px; padding: 32px 0; }
        .mwv-retry-btn { margin-top: 8px; padding: 5px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer; font-size: 12px; font-family: var(--font-sans); }
        .mwv-retry-btn:hover { background: var(--surface-hover); }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .mwv-dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 90; }
        .mwv-dialog { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); width: 400px; max-width: 90vw; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        .mwv-dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 13px; font-weight: 500; color: var(--text); }
        .mwv-dialog-close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; border-radius: var(--radius-sm); }
        .mwv-dialog-close:hover { color: var(--text); background: var(--surface-hover); }
        .mwv-dialog-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .mwv-dialog-label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 500; color: var(--text); }
        .mwv-dialog-input { padding: 7px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 12px; font-family: var(--font-sans); outline: none; }
        .mwv-dialog-input:focus { border-color: #ff6600; }
        .mwv-dialog-textarea { resize: vertical; font-family: var(--font-mono); font-size: 11px; line-height: 1.5; }
        .mwv-dialog-error { font-size: 11px; color: #ef4444; background: rgba(239,68,68,0.08); padding: 8px 10px; border-radius: var(--radius-sm); }
        .mwv-dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border); }
        .mwv-dialog-btn-cancel { padding: 6px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer; font-size: 12px; font-family: var(--font-sans); }
        .mwv-dialog-btn-cancel:hover { background: var(--surface-hover); }
        .mwv-dialog-btn-ok { padding: 6px 14px; background: #ff6600; border: none; border-radius: var(--radius-sm); color: white; cursor: pointer; font-size: 12px; font-family: var(--font-sans); display: flex; align-items: center; gap: 6px; }
        .mwv-dialog-btn-ok:disabled { opacity: 0.5; cursor: not-allowed; }
        .mwv-dialog-btn-ok:hover:not(:disabled) { background: #e55b00; }
      `}</style>
    </div>
  );
}
