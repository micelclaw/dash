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
import { Plus, Trash2, RefreshCw, ShieldCheck, User, Globe, X, Pencil } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface AccessList {
  id: string;
  name: string;
  satisfy_any: boolean;
  pass_auth: boolean;
  created_at: string;
  auth?: { id: string; username: string }[];
  clients?: { id: string; address: string; directive: string }[];
}

export function AccessListsSection() {
  const [lists, setLists] = useState<AccessList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<AccessList | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [satisfyAny, setSatisfyAny] = useState(false);
  const [passAuth, setPassAuth] = useState(false);
  const [authEntries, setAuthEntries] = useState<{ username: string; password: string }[]>([]);
  const [clientEntries, setClientEntries] = useState<{ address: string; directive: string }[]>([]);

  const fetchLists = useCallback(async () => {
    try {
      const res = await api.get<{ data: AccessList[] }>('/hal/network/proxy/access-lists');
      setLists(res.data);
    } catch { setLists([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const fetchDetail = async (id: string) => {
    if (expanded === id) { setExpanded(null); setDetail(null); return; }
    try {
      const res = await api.get<{ data: AccessList }>(`/hal/network/proxy/access-lists/${id}`);
      setDetail(res.data);
      setExpanded(id);
    } catch { toast.error('Failed to load details'); }
  };

  const resetForm = () => {
    setName(''); setSatisfyAny(false); setPassAuth(false);
    setAuthEntries([]); setClientEntries([]);
    setEditId(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body: any = {
        name: name.trim(),
        satisfy_any: satisfyAny,
        pass_auth: passAuth,
      };
      if (authEntries.length) {
        body.auth = authEntries.filter(a => a.username && a.password).map(a => ({
          username: a.username,
          password_hash: a.password, // Backend should hash this
        }));
      }
      if (clientEntries.length) {
        body.clients = clientEntries.filter(c => c.address).map(c => ({
          address: c.address,
          directive: c.directive,
        }));
      }

      if (editId) {
        await api.put(`/hal/network/proxy/access-lists/${editId}`, body);
        toast.success('Access list updated');
      } else {
        await api.post('/hal/network/proxy/access-lists', body);
        toast.success('Access list created');
      }
      setShowForm(false); resetForm();
      await fetchLists();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save access list');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await api.delete(`/hal/network/proxy/access-lists/${id}`);
      toast.success('Access list deleted');
      if (expanded === id) { setExpanded(null); setDetail(null); }
      await fetchLists();
    } catch (err: any) { toast.error(err?.message ?? 'Failed to delete'); }
    setDeleting(null);
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading access lists...</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', margin: 0, fontFamily: 'var(--font-sans)' }}>
          Access Lists <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-muted)' }}>({lists.length})</span>
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn icon={RefreshCw} onClick={fetchLists} title="Refresh" />
          <button onClick={() => { resetForm(); setShowForm(!showForm); }} style={addBtnStyle}><Plus size={14} /> Add List</button>
        </div>
      </div>

      {showForm && (
        <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid rgba(59,130,246,0.3)', background: 'var(--surface)', padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 16, fontFamily: 'var(--font-sans)' }}>
            {editId ? 'Edit Access List' : 'New Access List'}
          </div>

          <div style={{ marginBottom: 12 }}>
            <Label>Name</Label>
            <input type="text" placeholder="e.g. Admin Only" value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, maxWidth: 300 }} />
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <input type="checkbox" checked={satisfyAny} onChange={(e) => setSatisfyAny(e.target.checked)} style={{ accentColor: '#3b82f6' }} />
              Satisfy Any (OR logic)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <input type="checkbox" checked={passAuth} onChange={(e) => setPassAuth(e.target.checked)} style={{ accentColor: '#3b82f6' }} />
              Pass Auth to upstream
            </label>
          </div>

          {/* Auth Users */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Label>HTTP Basic Auth Users</Label>
              <button onClick={() => setAuthEntries([...authEntries, { username: '', password: '' }])} style={miniAddBtn}><Plus size={12} /> Add User</button>
            </div>
            {authEntries.map((entry, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input type="text" placeholder="username" value={entry.username} onChange={(e) => { const a = [...authEntries]; a[i].username = e.target.value; setAuthEntries(a); }} style={{ ...inputStyle, flex: 1 }} />
                <input type="password" placeholder="password" value={entry.password} onChange={(e) => { const a = [...authEntries]; a[i].password = e.target.value; setAuthEntries(a); }} style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => setAuthEntries(authEntries.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><X size={14} /></button>
              </div>
            ))}
          </div>

          {/* IP Rules */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Label>IP Allow/Deny Rules</Label>
              <button onClick={() => setClientEntries([...clientEntries, { address: '', directive: 'allow' }])} style={miniAddBtn}><Plus size={12} /> Add Rule</button>
            </div>
            {clientEntries.map((entry, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <select value={entry.directive} onChange={(e) => { const c = [...clientEntries]; c[i].directive = e.target.value; setClientEntries(c); }} style={{ ...inputStyle, width: 100, flex: 'none' }}>
                  <option value="allow">Allow</option>
                  <option value="deny">Deny</option>
                </select>
                <input type="text" placeholder="192.168.1.0/24" value={entry.address} onChange={(e) => { const c = [...clientEntries]; c[i].address = e.target.value; setClientEntries(c); }} style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => setClientEntries(clientEntries.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><X size={14} /></button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => { setShowForm(false); resetForm(); }} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleCreate} disabled={!name.trim() || saving} style={{ ...saveBtnStyle, opacity: (!name.trim() || saving) ? 0.5 : 1, cursor: (!name.trim() || saving) ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : editId ? 'Update' : 'Create'}</button>
          </div>
        </div>
      )}

      {lists.length === 0 ? (
        <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', padding: '48px 24px', textAlign: 'center' }}>
          <ShieldCheck size={28} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
          <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', margin: '0 0 4px', fontWeight: 500 }}>No access lists</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>Create access lists with auth users and IP rules to assign to proxy hosts.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lists.map(list => (
            <div key={list.id} style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }} onClick={() => fetchDetail(list.id)}>
                <ShieldCheck size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{list.name}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Created {new Date(list.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {list.satisfy_any && ' \u00b7 Satisfy Any'}
                    {list.pass_auth && ' \u00b7 Pass Auth'}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(list.id); }} disabled={deleting === list.id} title="Delete" style={deleteBtnStyle}><Trash2 size={13} /></button>
              </div>

              {expanded === list.id && detail && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', background: 'var(--bg)' }}>
                  {(detail.auth?.length ?? 0) > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Auth Users</div>
                      {detail.auth!.map(a => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text)', padding: '2px 0' }}>
                          <User size={12} style={{ color: 'var(--text-muted)' }} />
                          {a.username}
                        </div>
                      ))}
                    </div>
                  )}
                  {(detail.clients?.length ?? 0) > 0 && (
                    <div>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>IP Rules</div>
                      {detail.clients!.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', padding: '2px 0' }}>
                          <Globe size={12} style={{ color: c.directive === 'allow' ? '#22c55e' : '#ef4444' }} />
                          <span style={{ color: c.directive === 'allow' ? '#22c55e' : '#ef4444', fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase' }}>{c.directive}</span>
                          <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>{c.address}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!(detail.auth?.length ?? 0) && !(detail.clients?.length ?? 0) && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No auth users or IP rules configured.</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IconBtn({ icon: Icon, onClick, title }: { icon: React.ComponentType<{ size?: number }>; onClick: () => void; title: string }) {
  return <button onClick={onClick} title={title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-dim)' }}><Icon size={14} /></button>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>{children}</div>;
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono, monospace)', outline: 'none' };
const addBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const miniAddBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.6875rem', fontFamily: 'var(--font-sans)' };
const cancelBtnStyle: React.CSSProperties = { padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer' };
const saveBtnStyle: React.CSSProperties = { padding: '8px 20px', background: '#3b82f6', border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)' };
const deleteBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'transparent', border: '1px solid transparent', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)' };
