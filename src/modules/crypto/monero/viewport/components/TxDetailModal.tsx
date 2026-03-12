import { useState, useCallback } from 'react';
import { X, Copy, Check, Save, Loader2 } from 'lucide-react';
import { useMoneroRpc } from '../hooks/useMoneroRpc';
import { formatRelativeTime } from '../../../shared/crypto-formatters';

export interface TxEntry {
  txid: string;
  payment_id: string;
  height: number;
  timestamp: number;
  amount: number;
  fee: number;
  note: string;
  destinations?: Array<{ amount: number; address: string }>;
  type: string;
  unlock_time: number;
  subaddr_index: { major: number; minor: number };
  confirmations: number;
  suggested_confirmations_threshold: number;
  address: string;
}

interface Props {
  tx: TxEntry;
  onClose: () => void;
}

function picoToXmr(p: number): string {
  return (p / 1e12).toFixed(12);
}

export function TxDetailModal({ tx, onClose }: Props) {
  const rpc = useMoneroRpc();
  const { call } = rpc;
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState(tx.note || '');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const copyHash = () => {
    navigator.clipboard.writeText(tx.txid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveNote = useCallback(async () => {
    setSavingNote(true);
    await call('set_tx_notes', { txids: [tx.txid], notes: [note] });
    setSavingNote(false);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }, [call, tx.txid, note]);

  const isIn = tx.type === 'in' || tx.type === 'pool';
  const dateStr = tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : 'Pending';

  return (
    <div className="txd-overlay" onClick={onClose}>
      <div className="txd-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="txd-header">
          <span className="txd-header-title">Transaction Details</span>
          <button className="txd-close" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="txd-body">
          {/* Amount */}
          <div className={`txd-amount ${isIn ? 'txd-amount-in' : 'txd-amount-out'}`}>
            {isIn ? '+' : '-'}{picoToXmr(tx.amount)} XMR
          </div>

          {/* Hash */}
          <div className="txd-row">
            <span className="txd-label">TX Hash</span>
            <div className="txd-hash-row">
              <span className="txd-mono">{tx.txid}</span>
              <button className="txd-copy" onClick={copyHash}>
                {copied ? <Check size={11} style={{ color: '#22c55e' }} /> : <Copy size={11} />}
              </button>
            </div>
          </div>

          {/* Grid info */}
          <div className="txd-grid">
            <div className="txd-cell">
              <span className="txd-label">Type</span>
              <span className="txd-value">{tx.type}</span>
            </div>
            <div className="txd-cell">
              <span className="txd-label">Date</span>
              <span className="txd-value">{dateStr}</span>
            </div>
            <div className="txd-cell">
              <span className="txd-label">Height</span>
              <span className="txd-value">{tx.height > 0 ? tx.height.toLocaleString() : 'Mempool'}</span>
            </div>
            <div className="txd-cell">
              <span className="txd-label">Confirmations</span>
              <span className="txd-value">{tx.confirmations.toLocaleString()}</span>
            </div>
            <div className="txd-cell">
              <span className="txd-label">Fee</span>
              <span className="txd-value">{picoToXmr(tx.fee)} XMR</span>
            </div>
            <div className="txd-cell">
              <span className="txd-label">Time</span>
              <span className="txd-value">{tx.timestamp ? formatRelativeTime(tx.timestamp) : '-'}</span>
            </div>
          </div>

          {/* Payment ID */}
          {tx.payment_id && tx.payment_id !== '0000000000000000' && (
            <div className="txd-row">
              <span className="txd-label">Payment ID</span>
              <span className="txd-mono txd-small">{tx.payment_id}</span>
            </div>
          )}

          {/* Address */}
          {tx.address && (
            <div className="txd-row">
              <span className="txd-label">Address</span>
              <span className="txd-mono txd-small">{tx.address}</span>
            </div>
          )}

          {/* Destinations */}
          {tx.destinations && tx.destinations.length > 0 && (
            <div className="txd-row">
              <span className="txd-label">Destinations</span>
              <div className="txd-dests">
                {tx.destinations.map((d, i) => (
                  <div key={i} className="txd-dest">
                    <span className="txd-mono txd-small">{d.address.slice(0, 16)}...{d.address.slice(-8)}</span>
                    <span className="txd-dest-amount">{picoToXmr(d.amount)} XMR</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          <div className="txd-row">
            <span className="txd-label">Note</span>
            <div className="txd-note-row">
              <input
                className="txd-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note..."
                onKeyDown={(e) => e.key === 'Enter' && saveNote()}
              />
              <button className="txd-save-btn" onClick={saveNote} disabled={savingNote} title="Save note">
                {savingNote ? <Loader2 size={12} className="spin" /> : noteSaved ? <Check size={12} style={{ color: '#22c55e' }} /> : <Save size={12} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .txd-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .txd-dialog { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); width: 480px; max-width: 92vw; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        .txd-header { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border); }
        .txd-header-title { font-size: 13px; font-weight: 500; color: var(--text); flex: 1; }
        .txd-close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; border-radius: var(--radius-sm); }
        .txd-close:hover { color: var(--text); background: var(--surface-hover); }
        .txd-body { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }

        .txd-amount { font-size: 20px; font-weight: 600; text-align: center; padding: 8px 0; font-variant-numeric: tabular-nums; }
        .txd-amount-in { color: #22c55e; }
        .txd-amount-out { color: #ef4444; }

        .txd-row { display: flex; flex-direction: column; gap: 3px; }
        .txd-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; }
        .txd-value { font-size: 12px; color: var(--text); }
        .txd-mono { font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); word-break: break-all; }
        .txd-small { font-size: 10px; }

        .txd-hash-row { display: flex; align-items: flex-start; gap: 6px; }
        .txd-copy { background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 3px 5px; color: var(--text-muted); cursor: pointer; display: flex; flex-shrink: 0; margin-top: 1px; }
        .txd-copy:hover { color: var(--text); border-color: var(--text-muted); }

        .txd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
        .txd-cell { padding: 8px 10px; background: var(--bg); display: flex; flex-direction: column; gap: 2px; }

        .txd-dests { display: flex; flex-direction: column; gap: 4px; }
        .txd-dest { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: var(--bg); border-radius: var(--radius-sm); }
        .txd-dest-amount { font-size: 11px; color: var(--text); font-variant-numeric: tabular-nums; white-space: nowrap; }

        .txd-note-row { display: flex; gap: 6px; }
        .txd-input { flex: 1; padding: 6px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 12px; font-family: var(--font-sans); }
        .txd-input:focus { outline: none; border-color: #ff6600; }
        .txd-save-btn { background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 8px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; }
        .txd-save-btn:hover { color: var(--text); border-color: var(--text-muted); }
        .txd-save-btn:disabled { opacity: 0.5; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
