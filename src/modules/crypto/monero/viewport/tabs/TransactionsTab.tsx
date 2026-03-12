import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, ArrowDownLeft, ArrowUpRight, Clock, Filter, Download } from 'lucide-react';
import { useMoneroRpc } from '../hooks/useMoneroRpc';
import { TxDetailModal, type TxEntry } from '../components/TxDetailModal';
import { formatRelativeTime } from '../../../shared/crypto-formatters';

type TxFilter = 'all' | 'in' | 'out' | 'pending';

const PAGE_SIZE = 25;

function picoToXmr(p: number): string {
  return (p / 1e12).toFixed(6);
}

function truncHash(h: string): string {
  if (h.length <= 18) return h;
  return `${h.slice(0, 8)}...${h.slice(-8)}`;
}

export function TransactionsTab() {
  const rpc = useMoneroRpc();
  const { call } = rpc;
  const [txs, setTxs] = useState<TxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TxFilter>('all');
  const [selectedTx, setSelectedTx] = useState<TxEntry | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const result = await call<Record<string, TxEntry[]>>('get_transfers', {
      in: true,
      out: true,
      pending: true,
      pool: true,
      failed: true,
    });

    if (result) {
      const all: TxEntry[] = [
        ...(result.in ?? []).map((t) => ({ ...t, type: 'in' })),
        ...(result.out ?? []).map((t) => ({ ...t, type: 'out' })),
        ...(result.pending ?? []).map((t) => ({ ...t, type: 'pending' })),
        ...(result.pool ?? []).map((t) => ({ ...t, type: 'pool' })),
        ...(result.failed ?? []).map((t) => ({ ...t, type: 'failed' })),
      ];
      all.sort((a, b) => b.timestamp - a.timestamp);
      setTxs(all);
    }
    setLoading(false);
  }, [call]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const filtered = txs.filter((tx) => {
    if (filter === 'all') return true;
    if (filter === 'in') return tx.type === 'in';
    if (filter === 'out') return tx.type === 'out';
    if (filter === 'pending') return tx.type === 'pending' || tx.type === 'pool';
    return true;
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const exportCsv = () => {
    const header = 'Date,Type,Amount (XMR),Fee (XMR),TX Hash,Confirmations\n';
    const rows = filtered.map((tx) =>
      `${tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : 'pending'},${tx.type},${picoToXmr(tx.amount)},${picoToXmr(tx.fee)},${tx.txid},${tx.confirmations}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monero-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tt-root">
      <div className="tt-header">
        <h3 className="tt-title">Transactions</h3>
        <div style={{ flex: 1 }} />
        <button className="tt-icon-btn" onClick={exportCsv} title="Export CSV">
          <Download size={13} />
        </button>
        <button className="tt-icon-btn" onClick={() => { setVisibleCount(PAGE_SIZE); fetchTransactions(); }} title="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Filters */}
      <div className="tt-filters">
        <Filter size={12} style={{ color: 'var(--text-muted)' }} />
        {(['all', 'in', 'out', 'pending'] as TxFilter[]).map((f) => (
          <button
            key={f}
            className={`tt-filter-btn ${filter === f ? 'tt-filter-active' : ''}`}
            onClick={() => { setFilter(f); setVisibleCount(PAGE_SIZE); }}
          >
            {f === 'all' ? 'All' : f === 'in' ? 'Received' : f === 'out' ? 'Sent' : 'Pending'}
          </button>
        ))}
        <span className="tt-count">{filtered.length} transactions</span>
      </div>

      {loading ? (
        <div className="tt-loading">
          <Loader2 size={16} className="spin" /> Loading transactions...
        </div>
      ) : filtered.length === 0 ? (
        <div className="tt-empty">No transactions found</div>
      ) : (
        <>
          {/* Table header */}
          <div className="tt-table-head">
            <span className="tt-th tt-th-type">Type</span>
            <span className="tt-th tt-th-hash">TX Hash</span>
            <span className="tt-th tt-th-amount">Amount</span>
            <span className="tt-th tt-th-fee">Fee</span>
            <span className="tt-th tt-th-conf">Conf</span>
            <span className="tt-th tt-th-date">Date</span>
          </div>

          {/* Rows */}
          <div className="tt-table-body">
            {visible.map((tx) => {
              const isIn = tx.type === 'in' || tx.type === 'pool';
              const isPending = tx.type === 'pending' || tx.type === 'pool';
              return (
                <button
                  key={tx.txid + tx.type}
                  className="tt-row"
                  onClick={() => setSelectedTx(tx)}
                >
                  <span className="tt-td tt-th-type">
                    <span style={{ color: isIn ? '#22c55e' : tx.type === 'failed' ? '#6b7280' : '#ef4444' }}>
                      {isIn ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                    </span>
                  </span>
                  <span className="tt-td tt-th-hash tt-mono">{truncHash(tx.txid)}</span>
                  <span className={`tt-td tt-th-amount ${isIn ? 'tt-in' : 'tt-out'}`}>
                    {isIn ? '+' : '-'}{picoToXmr(tx.amount)}
                  </span>
                  <span className="tt-td tt-th-fee">{picoToXmr(tx.fee)}</span>
                  <span className="tt-td tt-th-conf">
                    {isPending ? <Clock size={10} style={{ color: 'var(--text-muted)' }} /> : tx.confirmations.toLocaleString()}
                  </span>
                  <span className="tt-td tt-th-date">
                    {tx.timestamp ? formatRelativeTime(tx.timestamp) : 'pending'}
                  </span>
                </button>
              );
            })}
          </div>

          {hasMore && (
            <button className="tt-load-more" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
              Load more ({filtered.length - visibleCount} remaining)
            </button>
          )}
        </>
      )}

      {/* Detail modal */}
      {selectedTx && (
        <TxDetailModal tx={selectedTx} onClose={() => setSelectedTx(null)} />
      )}

      <style>{`
        .tt-root { max-width: 900px; }
        .tt-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .tt-title { font-size: 16px; font-weight: 500; color: var(--text); margin: 0; }
        .tt-icon-btn { background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 6px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; }
        .tt-icon-btn:hover { color: var(--text); border-color: var(--text-muted); }

        .tt-filters { display: flex; align-items: center; gap: 4px; margin-bottom: 12px; }
        .tt-filter-btn { padding: 4px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-dim); cursor: pointer; font-size: 11px; font-family: var(--font-sans); }
        .tt-filter-btn:hover { border-color: var(--text-muted); color: var(--text); }
        .tt-filter-active { border-color: #ff6600; color: #ff6600; background: rgba(255,102,0,0.05); }
        .tt-count { font-size: 11px; color: var(--text-muted); margin-left: auto; }

        .tt-loading, .tt-empty { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 8px; padding: 24px 0; }
        .tt-empty { font-style: italic; }

        .tt-table-head { display: flex; padding: 6px 10px; border-bottom: 1px solid var(--border); }
        .tt-th { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; }
        .tt-th-type { width: 36px; }
        .tt-th-hash { flex: 1; min-width: 0; }
        .tt-th-amount { width: 120px; text-align: right; }
        .tt-th-fee { width: 90px; text-align: right; }
        .tt-th-conf { width: 50px; text-align: right; }
        .tt-th-date { width: 80px; text-align: right; }

        .tt-table-body { display: flex; flex-direction: column; }
        .tt-row { display: flex; align-items: center; padding: 7px 10px; border-bottom: 1px solid var(--border); background: none; border-left: none; border-right: none; border-top: none; cursor: pointer; font-family: var(--font-sans); width: 100%; text-align: left; }
        .tt-row:hover { background: var(--surface-hover); }
        .tt-td { font-size: 12px; color: var(--text-dim); font-variant-numeric: tabular-nums; display: flex; align-items: center; }
        .tt-mono { font-family: var(--font-mono); font-size: 11px; }
        .tt-in { color: #22c55e; font-weight: 500; }
        .tt-out { color: #ef4444; font-weight: 500; }

        .tt-load-more { display: block; width: 100%; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-muted); cursor: pointer; font-size: 12px; font-family: var(--font-sans); margin-top: 8px; }
        .tt-load-more:hover { color: var(--text); border-color: var(--text-muted); }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
