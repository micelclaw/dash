import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Search, Loader2, Copy, Check, Send } from 'lucide-react';
import { useMoneroRpc } from '../hooks/useMoneroRpc';

interface AddressBookEntry {
  index: number;
  address: string;
  description: string;
  payment_id: string;
}

export function AddressBookTab() {
  const rpc = useMoneroRpc();
  const { call } = rpc;
  const [entries, setEntries] = useState<AddressBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newAddr, setNewAddr] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const result = await call<{ entries?: AddressBookEntry[] }>('get_address_book', { entries: [] });
    setEntries(result?.entries ?? []);
    setLoading(false);
  }, [call]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const addEntry = useCallback(async () => {
    if (!newAddr.trim()) return;
    setAdding(true);
    await call('add_address_book', {
      address: newAddr.trim(),
      description: newDesc.trim() || undefined,
    });
    setNewAddr('');
    setNewDesc('');
    setShowAdd(false);
    await fetchEntries();
    setAdding(false);
  }, [call, newAddr, newDesc, fetchEntries]);

  const deleteEntry = useCallback(async (index: number) => {
    setDeleting(index);
    await call('delete_address_book', { index });
    await fetchEntries();
    setDeleting(null);
  }, [call, fetchEntries]);

  const copyAddr = (addr: string, idx: number) => {
    navigator.clipboard.writeText(addr);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = entries.filter((e) =>
    !search || e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="ab-root">
      <div className="ab-header">
        <h3 className="ab-title">Address Book</h3>
        <div style={{ flex: 1 }} />
        <button className="ab-add-btn" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={12} /> Add Contact
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="ab-add-form">
          <div className="ab-field">
            <label className="ab-label">Address</label>
            <input
              className="ab-input"
              placeholder="4... or 8... Monero address"
              value={newAddr}
              onChange={(e) => setNewAddr(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="ab-field">
            <label className="ab-label">Description</label>
            <input
              className="ab-input"
              placeholder="Contact name or note"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addEntry()}
            />
          </div>
          <div className="ab-add-actions">
            <button className="ab-btn ab-btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="ab-btn ab-btn-primary" onClick={addEntry} disabled={!newAddr.trim() || adding}>
              {adding ? <><Loader2 size={12} className="spin" /> Adding...</> : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="ab-search-row">
        <Search size={13} style={{ color: 'var(--text-muted)' }} />
        <input
          className="ab-search-input"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="ab-count">{filtered.length} contacts</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="ab-loading"><Loader2 size={16} className="spin" /> Loading address book...</div>
      ) : filtered.length === 0 ? (
        <div className="ab-empty">{entries.length === 0 ? 'No contacts saved yet' : 'No matches'}</div>
      ) : (
        <div className="ab-list">
          {filtered.map((e) => (
            <div key={e.index} className="ab-entry">
              <div className="ab-entry-top">
                <span className="ab-entry-desc">{e.description || 'Unnamed'}</span>
                <div className="ab-entry-actions">
                  <button className="ab-entry-btn" onClick={() => copyAddr(e.address, e.index)} title="Copy address">
                    {copied === e.index ? <Check size={11} style={{ color: '#22c55e' }} /> : <Copy size={11} />}
                  </button>
                  <button
                    className="ab-entry-btn ab-entry-btn-danger"
                    onClick={() => deleteEntry(e.index)}
                    disabled={deleting === e.index}
                    title="Delete"
                  >
                    {deleting === e.index ? <Loader2 size={11} className="spin" /> : <Trash2 size={11} />}
                  </button>
                </div>
              </div>
              <div className="ab-entry-addr">{e.address.slice(0, 20)}...{e.address.slice(-8)}</div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .ab-root { max-width: 680px; }
        .ab-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .ab-title { font-size: 16px; font-weight: 500; color: var(--text); margin: 0; }
        .ab-add-btn { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: #ff6600; color: white; border: none; border-radius: var(--radius-sm); font-size: 11px; cursor: pointer; font-family: var(--font-sans); }
        .ab-add-btn:hover { background: #e65c00; }

        .ab-add-form { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px; }
        .ab-field { display: flex; flex-direction: column; gap: 3px; }
        .ab-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; }
        .ab-input { padding: 7px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 12px; font-family: var(--font-sans); }
        .ab-input:focus { outline: none; border-color: #ff6600; }
        .ab-add-actions { display: flex; justify-content: flex-end; gap: 6px; }
        .ab-btn { padding: 6px 14px; border-radius: var(--radius-sm); font-size: 11px; font-family: var(--font-sans); cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
        .ab-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ab-btn-primary { background: #ff6600; color: white; border: none; }
        .ab-btn-ghost { background: none; border: 1px solid var(--border); color: var(--text-muted); }

        .ab-search-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 12px; }
        .ab-search-input { flex: 1; background: none; border: none; color: var(--text); font-size: 12px; font-family: var(--font-sans); outline: none; }
        .ab-count { font-size: 10px; color: var(--text-muted); white-space: nowrap; }

        .ab-loading, .ab-empty { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 8px; padding: 20px 0; }
        .ab-empty { font-style: italic; }

        .ab-list { display: flex; flex-direction: column; gap: 4px; }
        .ab-entry { padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .ab-entry:hover { border-color: var(--text-muted); }
        .ab-entry-top { display: flex; align-items: center; gap: 8px; }
        .ab-entry-desc { font-size: 13px; font-weight: 500; color: var(--text); flex: 1; }
        .ab-entry-actions { display: flex; gap: 4px; }
        .ab-entry-btn { background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 3px 5px; color: var(--text-muted); cursor: pointer; display: flex; }
        .ab-entry-btn:hover { color: var(--text); border-color: var(--text-muted); }
        .ab-entry-btn-danger:hover { color: #ef4444; border-color: #ef4444; }
        .ab-entry-btn:disabled { opacity: 0.5; }
        .ab-entry-addr { font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 4px; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
