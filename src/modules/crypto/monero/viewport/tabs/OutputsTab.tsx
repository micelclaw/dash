import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, RefreshCw, Snowflake, Sun, Download, Upload, Filter } from 'lucide-react';
import { useMoneroRpc } from '../hooks/useMoneroRpc';

interface OutputEntry {
  amount: number;
  spent: boolean;
  frozen: boolean;
  global_index: number;
  key_image: string;
  subaddr_index: { major: number; minor: number };
  tx_hash: string;
}

type OutputFilter = 'all' | 'available' | 'unavailable';

function picoToXmr(p: number): string {
  return (p / 1e12).toFixed(6);
}

function truncStr(s: string, n = 8): string {
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}...${s.slice(-n)}`;
}

export function OutputsTab() {
  const rpc = useMoneroRpc();
  const { call } = rpc;
  const [outputs, setOutputs] = useState<OutputEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OutputFilter>('all');
  const [toggling, setToggling] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchOutputs = useCallback(async () => {
    setLoading(true);
    const result = await call<{ transfers?: OutputEntry[] }>('incoming_transfers', {
      transfer_type: filter,
      verbose: true,
    });
    setOutputs(result?.transfers ?? []);
    setLoading(false);
  }, [call, filter]);

  useEffect(() => { fetchOutputs(); }, [fetchOutputs]);

  const toggleFreeze = useCallback(async (keyImage: string, isFrozen: boolean) => {
    setToggling(keyImage);
    await call(isFrozen ? 'thaw' : 'freeze', { key_image: keyImage });
    await fetchOutputs();
    setToggling(null);
  }, [call, fetchOutputs]);

  const exportOutputs = useCallback(async () => {
    const result = await call<{ outputs_data_hex: string }>('export_outputs', { all: true });
    if (!result?.outputs_data_hex) return;
    const blob = new Blob([result.outputs_data_hex], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monero-outputs-${new Date().toISOString().slice(0, 10)}.hex`;
    a.click();
    URL.revokeObjectURL(url);
  }, [call]);

  const importOutputs = useCallback(async (file: File) => {
    const text = await file.text();
    await call('import_outputs', { outputs_data_hex: text.trim() });
    if (rpc.pendingConfirmation) return; // confirmation dialog will handle it
    await fetchOutputs();
  }, [call, fetchOutputs]);

  const exportKeyImages = useCallback(async () => {
    const result = await call<{ signed_key_images: Array<{ key_image: string; signature: string }> }>('export_key_images', { all: true });
    if (!result?.signed_key_images) return;
    const blob = new Blob([JSON.stringify(result.signed_key_images, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monero-key-images-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [call]);

  const totalAmount = outputs.reduce((s, o) => s + o.amount, 0);
  const frozenCount = outputs.filter((o) => o.frozen).length;

  return (
    <div className="ot-root">
      <div className="ot-header">
        <h3 className="ot-title">Outputs</h3>
        <div style={{ flex: 1 }} />
        <button className="ot-icon-btn" onClick={exportOutputs} title="Export outputs">
          <Download size={13} /> Outputs
        </button>
        <button className="ot-icon-btn" onClick={exportKeyImages} title="Export key images">
          <Download size={13} /> Keys
        </button>
        <button className="ot-icon-btn" onClick={() => fileRef.current?.click()} title="Import outputs">
          <Upload size={13} />
        </button>
        <input ref={fileRef} type="file" accept=".hex,.txt,.json" hidden onChange={(e) => e.target.files?.[0] && importOutputs(e.target.files[0])} />
        <button className="ot-icon-btn" onClick={fetchOutputs} title="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Stats */}
      <div className="ot-stats">
        <span>{outputs.length} outputs</span>
        <span>Total: {picoToXmr(totalAmount)} XMR</span>
        {frozenCount > 0 && <span>{frozenCount} frozen</span>}
      </div>

      {/* Filters */}
      <div className="ot-filters">
        <Filter size={12} style={{ color: 'var(--text-muted)' }} />
        {(['all', 'available', 'unavailable'] as OutputFilter[]).map((f) => (
          <button
            key={f}
            className={`ot-filter-btn ${filter === f ? 'ot-filter-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'available' ? 'Available' : 'Spent'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ot-loading"><Loader2 size={16} className="spin" /> Loading outputs...</div>
      ) : outputs.length === 0 ? (
        <div className="ot-empty">No outputs found</div>
      ) : (
        <>
          {/* Table header */}
          <div className="ot-thead">
            <span className="ot-th ot-th-amount">Amount</span>
            <span className="ot-th ot-th-ki">Key Image</span>
            <span className="ot-th ot-th-tx">TX Hash</span>
            <span className="ot-th ot-th-sub">Subaddr</span>
            <span className="ot-th ot-th-status">Status</span>
            <span className="ot-th ot-th-action"></span>
          </div>

          <div className="ot-tbody">
            {outputs.map((o) => (
              <div key={o.key_image} className="ot-row">
                <span className="ot-td ot-th-amount ot-num">{picoToXmr(o.amount)}</span>
                <span className="ot-td ot-th-ki ot-mono">{truncStr(o.key_image, 6)}</span>
                <span className="ot-td ot-th-tx ot-mono">{truncStr(o.tx_hash, 6)}</span>
                <span className="ot-td ot-th-sub">{o.subaddr_index.major}/{o.subaddr_index.minor}</span>
                <span className="ot-td ot-th-status">
                  {o.frozen ? (
                    <span className="ot-badge ot-badge-frozen"><Snowflake size={9} /> Frozen</span>
                  ) : o.spent ? (
                    <span className="ot-badge ot-badge-spent">Spent</span>
                  ) : (
                    <span className="ot-badge ot-badge-avail">Available</span>
                  )}
                </span>
                <span className="ot-td ot-th-action">
                  {!o.spent && (
                    <button
                      className="ot-freeze-btn"
                      onClick={() => toggleFreeze(o.key_image, o.frozen)}
                      disabled={toggling === o.key_image}
                      title={o.frozen ? 'Thaw output' : 'Freeze output'}
                    >
                      {toggling === o.key_image ? (
                        <Loader2 size={11} className="spin" />
                      ) : o.frozen ? (
                        <Sun size={11} />
                      ) : (
                        <Snowflake size={11} />
                      )}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`
        .ot-root { max-width: 900px; }
        .ot-header { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
        .ot-title { font-size: 16px; font-weight: 500; color: var(--text); margin: 0; }
        .ot-icon-btn { display: flex; align-items: center; gap: 4px; background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 8px; color: var(--text-muted); cursor: pointer; font-size: 11px; font-family: var(--font-sans); }
        .ot-icon-btn:hover { color: var(--text); border-color: var(--text-muted); }

        .ot-stats { display: flex; gap: 16px; font-size: 11px; color: var(--text-muted); margin-bottom: 10px; }
        .ot-filters { display: flex; align-items: center; gap: 4px; margin-bottom: 12px; }
        .ot-filter-btn { padding: 4px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-dim); cursor: pointer; font-size: 11px; font-family: var(--font-sans); }
        .ot-filter-btn:hover { border-color: var(--text-muted); }
        .ot-filter-active { border-color: #ff6600; color: #ff6600; background: rgba(255,102,0,0.05); }

        .ot-loading, .ot-empty { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 8px; padding: 20px 0; }

        .ot-thead { display: flex; padding: 6px 8px; border-bottom: 1px solid var(--border); }
        .ot-th { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; }
        .ot-th-amount { width: 100px; }
        .ot-th-ki { flex: 1; min-width: 0; }
        .ot-th-tx { flex: 1; min-width: 0; }
        .ot-th-sub { width: 60px; text-align: center; }
        .ot-th-status { width: 80px; text-align: center; }
        .ot-th-action { width: 32px; }

        .ot-tbody { display: flex; flex-direction: column; }
        .ot-row { display: flex; align-items: center; padding: 6px 8px; border-bottom: 1px solid var(--border); }
        .ot-row:hover { background: var(--surface-hover); }
        .ot-td { font-size: 11px; color: var(--text-dim); }
        .ot-num { font-variant-numeric: tabular-nums; font-weight: 500; color: var(--text); }
        .ot-mono { font-family: var(--font-mono); font-size: 10px; }

        .ot-badge { font-size: 9px; padding: 2px 6px; border-radius: 8px; display: inline-flex; align-items: center; gap: 3px; }
        .ot-badge-avail { color: #22c55e; background: rgba(34,197,94,0.08); }
        .ot-badge-spent { color: var(--text-muted); background: var(--bg); }
        .ot-badge-frozen { color: #3b82f6; background: rgba(59,130,246,0.08); }

        .ot-freeze-btn { background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 3px; color: var(--text-muted); cursor: pointer; display: flex; }
        .ot-freeze-btn:hover { color: var(--text); border-color: var(--text-muted); }
        .ot-freeze-btn:disabled { opacity: 0.5; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
