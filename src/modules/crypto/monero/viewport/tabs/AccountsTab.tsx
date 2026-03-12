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
import { Plus, Loader2, Edit3, Check, X, Tag } from 'lucide-react';
import { useMoneroRpc } from '../hooks/useMoneroRpc';

interface AccountInfo {
  account_index: number;
  balance: number;
  base_address: string;
  label: string;
  tag: string;
  unlocked_balance: number;
}

interface AccountTag {
  tag: string;
  label: string;
  accounts: number[];
}

function picoToXmr(p: number): string {
  return (p / 1e12).toFixed(6);
}

export function AccountsTab() {
  const rpc = useMoneroRpc();
  const { call } = rpc;
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [tags, setTags] = useState<AccountTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    const [acctResult, tagResult] = await Promise.allSettled([
      call<{ subaddress_accounts: AccountInfo[]; total_balance: number; total_unlocked_balance: number }>('get_accounts'),
      call<{ account_tags: AccountTag[] }>('get_account_tags'),
    ]);

    if (acctResult.status === 'fulfilled' && acctResult.value) {
      setAccounts(acctResult.value.subaddress_accounts ?? []);
    }
    if (tagResult.status === 'fulfilled' && tagResult.value) {
      setTags(tagResult.value.account_tags ?? []);
    }
    setLoading(false);
  }, [call]);

  useEffect(() => { refresh(); }, [refresh]);

  const createAccount = useCallback(async () => {
    setCreating(true);
    await call('create_account', { label: newLabel.trim() || undefined });
    setNewLabel('');
    setShowCreate(false);
    await refresh();
    setCreating(false);
  }, [call,newLabel, refresh]);

  const startEdit = (idx: number, currentLabel: string) => {
    setEditing(idx);
    setEditLabel(currentLabel);
  };

  const saveLabel = useCallback(async (idx: number) => {
    await call('label_account', {
      account_index: idx,
      label: editLabel.trim(),
    });
    setEditing(null);
    await refresh();
  }, [call,editLabel, refresh]);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalUnlocked = accounts.reduce((sum, a) => sum + a.unlocked_balance, 0);

  return (
    <div className="ac-root">
      <div className="ac-header">
        <h3 className="ac-title">Accounts</h3>
        <div style={{ flex: 1 }} />
        <button className="ac-add-btn" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={12} /> New Account
        </button>
      </div>

      {/* Totals */}
      <div className="ac-totals">
        <div className="ac-total-item">
          <span className="ac-total-label">Total Balance</span>
          <span className="ac-total-value">{picoToXmr(totalBalance)} XMR</span>
        </div>
        <div className="ac-total-item">
          <span className="ac-total-label">Total Unlocked</span>
          <span className="ac-total-value">{picoToXmr(totalUnlocked)} XMR</span>
        </div>
        <div className="ac-total-item">
          <span className="ac-total-label">Accounts</span>
          <span className="ac-total-value">{accounts.length}</span>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="ac-create-row">
          <input
            className="ac-input"
            placeholder="Account label (optional)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createAccount()}
          />
          <button className="ac-btn ac-btn-primary" onClick={createAccount} disabled={creating}>
            {creating ? <Loader2 size={12} className="spin" /> : 'Create'}
          </button>
          <button className="ac-btn ac-btn-ghost" onClick={() => setShowCreate(false)}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Account list */}
      {loading ? (
        <div className="ac-loading"><Loader2 size={16} className="spin" /> Loading accounts...</div>
      ) : (
        <div className="ac-list">
          {accounts.map((a) => (
            <div key={a.account_index} className="ac-account">
              <div className="ac-account-top">
                <span className="ac-account-idx">#{a.account_index}</span>
                {editing === a.account_index ? (
                  <div className="ac-edit-row">
                    <input
                      className="ac-input ac-input-sm"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveLabel(a.account_index);
                        if (e.key === 'Escape') setEditing(null);
                      }}
                      autoFocus
                    />
                    <button className="ac-entry-btn" onClick={() => saveLabel(a.account_index)}>
                      <Check size={11} style={{ color: '#22c55e' }} />
                    </button>
                    <button className="ac-entry-btn" onClick={() => setEditing(null)}>
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="ac-account-label">{a.label || 'Unnamed'}</span>
                    <button className="ac-entry-btn" onClick={() => startEdit(a.account_index, a.label)} title="Rename">
                      <Edit3 size={11} />
                    </button>
                  </>
                )}
                {a.tag && (
                  <span className="ac-tag"><Tag size={9} /> {a.tag}</span>
                )}
                <div style={{ flex: 1 }} />
              </div>
              <div className="ac-account-balances">
                <div className="ac-account-bal">
                  <span className="ac-bal-value">{picoToXmr(a.balance)}</span>
                  <span className="ac-bal-label">Balance</span>
                </div>
                <div className="ac-account-bal">
                  <span className="ac-bal-value">{picoToXmr(a.unlocked_balance)}</span>
                  <span className="ac-bal-label">Unlocked</span>
                </div>
              </div>
              <div className="ac-account-addr">
                {a.base_address.slice(0, 20)}...{a.base_address.slice(-8)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tags section */}
      {tags.length > 0 && (
        <div className="ac-tags-section">
          <div className="ac-tags-title">Account Tags</div>
          <div className="ac-tags-list">
            {tags.map((t) => (
              <div key={t.tag} className="ac-tag-item">
                <Tag size={11} style={{ color: '#ff6600' }} />
                <span className="ac-tag-name">{t.tag}</span>
                {t.label && <span className="ac-tag-desc">{t.label}</span>}
                <span className="ac-tag-accounts">{t.accounts.length} accounts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .ac-root { max-width: 680px; }
        .ac-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .ac-title { font-size: 16px; font-weight: 500; color: var(--text); margin: 0; }
        .ac-add-btn { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: #ff6600; color: white; border: none; border-radius: var(--radius-sm); font-size: 11px; cursor: pointer; font-family: var(--font-sans); }

        .ac-totals { display: flex; gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 16px; }
        .ac-total-item { flex: 1; padding: 10px 12px; background: var(--surface); display: flex; flex-direction: column; gap: 2px; }
        .ac-total-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; }
        .ac-total-value { font-size: 13px; font-weight: 500; color: var(--text); font-variant-numeric: tabular-nums; }

        .ac-create-row { display: flex; gap: 6px; margin-bottom: 16px; align-items: center; }
        .ac-input { flex: 1; padding: 7px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 12px; font-family: var(--font-sans); }
        .ac-input:focus { outline: none; border-color: #ff6600; }
        .ac-input-sm { padding: 4px 8px; font-size: 11px; }
        .ac-btn { padding: 6px 12px; border-radius: var(--radius-sm); font-size: 11px; font-family: var(--font-sans); cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
        .ac-btn:disabled { opacity: 0.5; }
        .ac-btn-primary { background: #ff6600; color: white; border: none; }
        .ac-btn-ghost { background: none; border: 1px solid var(--border); color: var(--text-muted); }

        .ac-loading { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 8px; padding: 20px 0; }

        .ac-list { display: flex; flex-direction: column; gap: 6px; }
        .ac-account { padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .ac-account:hover { border-color: var(--text-muted); }
        .ac-account-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .ac-account-idx { font-size: 11px; color: var(--text-muted); font-variant-numeric: tabular-nums; min-width: 20px; }
        .ac-account-label { font-size: 13px; font-weight: 500; color: var(--text); }
        .ac-entry-btn { background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 2px 4px; color: var(--text-muted); cursor: pointer; display: flex; }
        .ac-entry-btn:hover { color: var(--text); border-color: var(--text-muted); }
        .ac-edit-row { display: flex; align-items: center; gap: 4px; flex: 1; }
        .ac-tag { font-size: 10px; color: #ff6600; background: rgba(255,102,0,0.08); padding: 2px 6px; border-radius: 8px; display: inline-flex; align-items: center; gap: 3px; }

        .ac-account-balances { display: flex; gap: 24px; margin-bottom: 6px; }
        .ac-account-bal { display: flex; flex-direction: column; gap: 1px; }
        .ac-bal-value { font-size: 13px; color: var(--text); font-variant-numeric: tabular-nums; }
        .ac-bal-label { font-size: 10px; color: var(--text-muted); }
        .ac-account-addr { font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); }

        .ac-tags-section { margin-top: 24px; }
        .ac-tags-title { font-size: 12px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .ac-tags-list { display: flex; flex-direction: column; gap: 4px; }
        .ac-tag-item { display: flex; align-items: center; gap: 6px; padding: 8px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 12px; }
        .ac-tag-name { font-weight: 500; color: var(--text); }
        .ac-tag-desc { color: var(--text-muted); }
        .ac-tag-accounts { margin-left: auto; font-size: 10px; color: var(--text-muted); }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
