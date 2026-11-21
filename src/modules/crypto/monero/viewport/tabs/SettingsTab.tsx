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
import { useI18n } from '@/i18n';
import { Loader2, RefreshCw, Eye, EyeOff, Key, Lock, AlertTriangle, Info, Clock } from 'lucide-react';
import { useMoneroRpc } from '../hooks/useMoneroRpc';
import { api } from '@/services/api';

interface WalletInfo {
  rpc_reachable: boolean;
  active_wallet: string | null;
  height: number | null;
  version: number | null;
}

interface AuditEntry {
  timestamp: string;
  method: string;
  classification: string;
  success: boolean;
  amount?: number;
  tx_hash?: string;
}

export function SettingsTab() {
  const { t, locale } = useI18n();
  const rpc = useMoneroRpc();
  const { call } = rpc;
  const [info, setInfo] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Secret display
  const [showSeed, setShowSeed] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);

  const [showViewKey, setShowViewKey] = useState(false);
  const [viewKey, setViewKey] = useState<string | null>(null);
  const [showSpendKey, setShowSpendKey] = useState(false);
  const [spendKey, setSpendKey] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);

  // Password change
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passResult, setPassResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Refresh
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);

  // Attributes
  const [attrKey, setAttrKey] = useState('');
  const [attrValue, setAttrValue] = useState('');
  const [attrResult, setAttrResult] = useState<string | null>(null);

  // Audit log
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchInfo = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: WalletInfo }>('/crypto/monero-wallet/status');
      setInfo((res.data as any) ?? null);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchAuditLog = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await api.get<{ data: AuditEntry[] }>('/crypto/monero-wallet/audit?limit=20');
      setAuditLog((res.data as any) ?? []);
    } catch { /* ignore */ }
    setAuditLoading(false);
  }, []);

  useEffect(() => {
    fetchInfo();
    fetchAuditLog();
  }, [fetchInfo, fetchAuditLog]);

  // Reveal seed (dangerous → confirmation)
  const revealSeed = useCallback(async () => {
    if (showSeed) { setShowSeed(false); setSeed(null); return; }
    setSeedLoading(true);
    const result = await call<{ key: string }>('query_key', { key_type: 'mnemonic' });
    if (rpc.pendingConfirmation) {
      setSeedLoading(false);
      return;
    }
    if (result?.key) {
      setSeed(result.key);
      setShowSeed(true);
    }
    setSeedLoading(false);
  }, [call, showSeed]);

  // Reveal view key
  const revealViewKey = useCallback(async () => {
    if (showViewKey) { setShowViewKey(false); setViewKey(null); return; }
    setKeyLoading(true);
    const result = await call<{ key: string }>('query_key', { key_type: 'view_key' });
    if (rpc.pendingConfirmation) {
      setKeyLoading(false);
      return;
    }
    if (result?.key) { setViewKey(result.key); setShowViewKey(true); }
    setKeyLoading(false);
  }, [call, showViewKey]);

  // Reveal spend key
  const revealSpendKey = useCallback(async () => {
    if (showSpendKey) { setShowSpendKey(false); setSpendKey(null); return; }
    setKeyLoading(true);
    const result = await call<{ key: string }>('query_key', { key_type: 'spend_key' });
    if (rpc.pendingConfirmation) {
      setKeyLoading(false);
      return;
    }
    if (result?.key) { setSpendKey(result.key); setShowSpendKey(true); }
    setKeyLoading(false);
  }, [call, showSpendKey]);

  // Change password
  const changePassword = useCallback(async () => {
    if (!newPass) return;
    setPassLoading(true);
    setPassResult(null);
    await call('change_wallet_password', {
      old_password: oldPass,
      new_password: newPass,
    });
    if (rpc.pendingConfirmation) {
      setPassLoading(false);
      return;
    }
    if (rpc.error) {
      setPassResult({ ok: false, msg: rpc.error });
    } else {
      setPassResult({ ok: true, msg: t('crypto.wallet.passwordChanged') });
      setOldPass('');
      setNewPass('');
    }
    setPassLoading(false);
  }, [call, oldPass, newPass, t]);

  // Refresh wallet
  const refreshWallet = useCallback(async () => {
    setRefreshing(true);
    setRefreshResult(null);
    const result = await call<{ blocks_fetched: number; received_money: boolean }>('refresh', {});
    if (result) {
      setRefreshResult(t('crypto.wallet.blocksScanned', { count: result.blocks_fetched, newFunds: result.received_money ? t('crypto.wallet.newFundsDetected') : '' }));
    } else {
      setRefreshResult(rpc.error || t('crypto.wallet.refreshFailed'));
    }
    setRefreshing(false);
  }, [call, t]);

  // Rescan blockchain
  const rescanBlockchain = useCallback(async () => {
    setRefreshing(true);
    setRefreshResult(null);
    await call('rescan_blockchain', {});
    if (rpc.pendingConfirmation) {
      setRefreshing(false);
      return;
    }
    setRefreshResult(rpc.error || t('crypto.wallet.rescanInitiated'));
    setRefreshing(false);
  }, [call, t]);

  // Get/Set attribute
  const getAttribute = useCallback(async () => {
    if (!attrKey.trim()) return;
    const result = await call<{ value: string }>('get_attribute', { key: attrKey.trim() });
    if (result) setAttrResult(`Value: ${result.value}`);
    else setAttrResult(rpc.error || t('crypto.wallet.attributeNotFound'));
  }, [call, attrKey, t]);

  const setAttribute = useCallback(async () => {
    if (!attrKey.trim()) return;
    await call('set_attribute', { key: attrKey.trim(), value: attrValue });
    if (rpc.error) setAttrResult(rpc.error);
    else setAttrResult(t('crypto.wallet.attributeSaved'));
  }, [call, attrKey, attrValue, t]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
        <Loader2 size={16} className="spin" /> {t('crypto.wallet.loading')}
      </div>
    );
  }

  return (
    <div className="se-root">
      <h3 className="se-title">{t('crypto.wallet.settings')}</h3>

      {/* Wallet info */}
      <div className="se-section">
        <div className="se-section-title">{t('crypto.wallet.info')}</div>
        <div className="se-info-grid">
          <div className="se-info-item">
            <span className="se-info-label">{t('crypto.wallet.walletLabel')}</span>
            <span className="se-info-value">{info?.active_wallet ?? '-'}</span>
          </div>
          <div className="se-info-item">
            <span className="se-info-label">{t('crypto.wallet.height')}</span>
            <span className="se-info-value">{info?.height?.toLocaleString(locale) ?? '-'}</span>
          </div>
          <div className="se-info-item">
            <span className="se-info-label">{t('crypto.wallet.rpcVersion')}</span>
            <span className="se-info-value">{info?.version ?? '-'}</span>
          </div>
          <div className="se-info-item">
            <span className="se-info-label">{t('crypto.wallet.status')}</span>
            <span className="se-info-value" style={{ color: info?.rpc_reachable ? '#22c55e' : '#ef4444' }}>
              {info?.rpc_reachable ? t('crypto.wallet.connected') : t('crypto.wallet.disconnected')}
            </span>
          </div>
        </div>
      </div>

      {/* Seed & Keys */}
      <div className="se-section">
        <div className="se-section-title">{t('crypto.wallet.seedAndKeys')}</div>
        <div className="se-warning-sm">
          <AlertTriangle size={11} />
          <span>{t('crypto.wallet.secretWarning')}</span>
        </div>

        {/* Mnemonic Seed */}
        <div className="se-secret-row">
          <div className="se-secret-header">
            <Key size={13} />
            <span className="se-secret-label">{t('crypto.wallet.mnemonicSeedLabel')}</span>
            <div style={{ flex: 1 }} />
            <button className="se-secret-btn" onClick={revealSeed} disabled={seedLoading}>
              {seedLoading ? <Loader2 size={12} className="spin" /> : showSeed ? <><EyeOff size={12} /> {t('crypto.wallet.hide')}</> : <><Eye size={12} /> {t('crypto.wallet.reveal')}</>}
            </button>
          </div>
          {showSeed && seed && (
            <div className="se-secret-value se-seed-value">{seed}</div>
          )}
        </div>

        {/* View Key */}
        <div className="se-secret-row">
          <div className="se-secret-header">
            <Key size={13} />
            <span className="se-secret-label">{t('crypto.wallet.privateViewKey')}</span>
            <div style={{ flex: 1 }} />
            <button className="se-secret-btn" onClick={revealViewKey} disabled={keyLoading}>
              {keyLoading ? <Loader2 size={12} className="spin" /> : showViewKey ? <><EyeOff size={12} /> {t('crypto.wallet.hide')}</> : <><Eye size={12} /> {t('crypto.wallet.reveal')}</>}
            </button>
          </div>
          {showViewKey && viewKey && (
            <div className="se-secret-value se-mono">{viewKey}</div>
          )}
        </div>

        {/* Spend Key */}
        <div className="se-secret-row">
          <div className="se-secret-header">
            <Key size={13} />
            <span className="se-secret-label">{t('crypto.wallet.privateSpendKey')}</span>
            <div style={{ flex: 1 }} />
            <button className="se-secret-btn" onClick={revealSpendKey} disabled={keyLoading}>
              {keyLoading ? <Loader2 size={12} className="spin" /> : showSpendKey ? <><EyeOff size={12} /> {t('crypto.wallet.hide')}</> : <><Eye size={12} /> {t('crypto.wallet.reveal')}</>}
            </button>
          </div>
          {showSpendKey && spendKey && (
            <div className="se-secret-value se-mono">{spendKey}</div>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div className="se-section">
        <div className="se-section-title">{t('crypto.wallet.changePassword')}</div>
        <div className="se-pass-form">
          <div className="se-field">
            <label className="se-label">{t('crypto.wallet.currentPassword')}</label>
            <input className="se-input" type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} placeholder={t('crypto.wallet.noPasswordPlaceholder')} />
          </div>
          <div className="se-field">
            <label className="se-label">{t('crypto.wallet.newPassword')}</label>
            <input className="se-input" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder={t('crypto.wallet.enterNewPassword')} />
          </div>
          <button className="se-btn se-btn-primary" onClick={changePassword} disabled={passLoading || !newPass}>
            {passLoading ? <><Loader2 size={12} className="spin" /> {t('crypto.wallet.changing')}</> : <><Lock size={12} /> {t('crypto.wallet.changePassword')}</>}
          </button>
          {passResult && (
            <div className={`se-feedback ${passResult.ok ? 'se-feedback-ok' : 'se-feedback-err'}`}>
              {passResult.msg}
            </div>
          )}
        </div>
      </div>

      {/* Wallet Refresh */}
      <div className="se-section">
        <div className="se-section-title">{t('crypto.wallet.syncRefresh')}</div>
        <div className="se-btn-row">
          <button className="se-btn se-btn-secondary" onClick={refreshWallet} disabled={refreshing}>
            {refreshing ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />}
            {t('crypto.wallet.refreshWallet')}
          </button>
          <button className="se-btn se-btn-secondary" onClick={rescanBlockchain} disabled={refreshing}>
            {t('crypto.wallet.rescanBlockchain')}
          </button>
        </div>
        {refreshResult && (
          <div className="se-feedback se-feedback-ok">{refreshResult}</div>
        )}
      </div>

      {/* Wallet Attributes */}
      <div className="se-section">
        <div className="se-section-title">{t('crypto.wallet.attributes')}</div>
        <div className="se-section-desc">{t('crypto.wallet.attributesHelp')}</div>
        <div className="se-attr-form">
          <input className="se-input se-input-sm" placeholder={t('crypto.wallet.key')} value={attrKey} onChange={(e) => setAttrKey(e.target.value)} />
          <input className="se-input se-input-sm" placeholder={t('crypto.wallet.value')} value={attrValue} onChange={(e) => setAttrValue(e.target.value)} />
          <button className="se-btn se-btn-secondary se-btn-sm" onClick={getAttribute}>{t('crypto.wallet.get')}</button>
          <button className="se-btn se-btn-secondary se-btn-sm" onClick={setAttribute}>{t('crypto.wallet.set')}</button>
        </div>
        {attrResult && <div className="se-feedback se-feedback-ok">{attrResult}</div>}
      </div>

      {/* Activity Log */}
      <div className="se-section">
        <div className="se-section-title-row">
          <div className="se-section-title">{t('crypto.wallet.activityLog')}</div>
          <button className="se-refresh-sm" onClick={fetchAuditLog} title={t('crypto.wallet.refresh')}>
            <RefreshCw size={11} />
          </button>
        </div>
        {auditLoading ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={12} className="spin" /> {t('crypto.wallet.loading')}
          </div>
        ) : auditLog.length === 0 ? (
          <div className="se-empty">
            <Info size={12} /> {t('crypto.wallet.noActivity')}
          </div>
        ) : (
          <div className="se-audit-list">
            {auditLog.map((entry, i) => (
              <div key={i} className="se-audit-row">
                <div className={`se-audit-dot ${entry.success ? 'se-audit-ok' : 'se-audit-fail'}`} />
                <div className="se-audit-info">
                  <span className="se-audit-method">{entry.method}</span>
                  <span className="se-audit-class">{entry.classification}</span>
                </div>
                <div style={{ flex: 1 }} />
                {entry.tx_hash && <span className="se-audit-hash">{entry.tx_hash.slice(0, 8)}...</span>}
                <span className="se-audit-time">
                  <Clock size={9} /> {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .se-root { max-width: 640px; }
        .se-title { font-size: 16px; font-weight: 500; color: var(--text); margin: 0 0 20px; }

        .se-section { margin-bottom: 24px; }
        .se-section-title { font-size: 12px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
        .se-section-title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .se-section-desc { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }

        .se-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
        .se-info-item { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; background: var(--surface); }
        .se-info-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; }
        .se-info-value { font-size: 12px; color: var(--text); overflow-wrap: anywhere; }
        @media (max-width: 767px) {
          .se-info-grid { grid-template-columns: 1fr; }
        }

        .se-warning-sm { display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); border-radius: var(--radius-sm); color: #ef4444; font-size: 10px; margin-bottom: 10px; }

        .se-secret-row { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 6px; overflow: hidden; }
        .se-secret-header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; }
        .se-secret-label { font-size: 12px; color: var(--text); font-weight: 500; }
        .se-secret-btn { display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-muted); cursor: pointer; font-size: 11px; font-family: var(--font-sans); }
        .se-secret-btn:hover { color: var(--text); border-color: var(--text-muted); }
        .se-secret-btn:disabled { opacity: 0.5; }
        .se-secret-value { padding: 10px 12px; background: var(--bg); border-top: 1px solid var(--border); font-size: 11px; color: var(--text-dim); word-break: break-all; line-height: 1.5; }
        .se-seed-value { font-family: var(--font-sans); line-height: 1.8; }
        .se-mono { font-family: var(--font-mono); font-size: 10px; }

        .se-pass-form { display: flex; flex-direction: column; gap: 10px; }
        .se-field { display: flex; flex-direction: column; gap: 3px; }
        .se-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; }
        .se-input { padding: 8px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 12px; font-family: var(--font-sans); box-sizing: border-box; }
        .se-input:focus { outline: none; border-color: #ff6600; }
        .se-input-sm { padding: 6px 8px; font-size: 11px; }

        .se-btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .se-btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 14px; border-radius: var(--radius-sm); font-size: 12px; font-family: var(--font-sans); cursor: pointer; border: none; }
        .se-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .se-btn-primary { background: #ff6600; color: white; }
        .se-btn-primary:hover:not(:disabled) { background: #e65c00; }
        .se-btn-secondary { background: var(--surface); border: 1px solid var(--border); color: var(--text); }
        .se-btn-secondary:hover:not(:disabled) { background: var(--surface-hover); }
        .se-btn-sm { padding: 5px 10px; font-size: 11px; }

        .se-attr-form { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .se-attr-form .se-input-sm { flex: 1; min-width: 100px; }

        .se-feedback { font-size: 11px; padding: 6px 10px; border-radius: var(--radius-sm); margin-top: 6px; }
        .se-feedback-ok { color: #22c55e; background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.15); }
        .se-feedback-err { color: #ef4444; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); }

        .se-refresh-sm { background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 3px 5px; color: var(--text-muted); cursor: pointer; display: flex; }
        .se-refresh-sm:hover { color: var(--text); }

        .se-empty { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; font-style: italic; }

        .se-audit-list { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; max-height: 300px; overflow-y: auto; }
        .se-audit-row { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-bottom: 1px solid var(--border); font-size: 11px; }
        .se-audit-row:last-child { border-bottom: none; }
        .se-audit-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .se-audit-ok { background: #22c55e; }
        .se-audit-fail { background: #ef4444; }
        .se-audit-info { display: flex; align-items: center; gap: 6px; }
        .se-audit-method { color: var(--text); font-weight: 500; font-family: var(--font-mono); font-size: 10px; }
        .se-audit-class { font-size: 9px; padding: 1px 5px; border-radius: 8px; background: var(--bg); color: var(--text-muted); }
        .se-audit-hash { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); }
        .se-audit-time { font-size: 10px; color: var(--text-muted); display: flex; align-items: center; gap: 3px; white-space: nowrap; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
