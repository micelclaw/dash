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
import { Key, Plus, Trash2, Copy, Check, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { SettingSection } from '../SettingSection';

interface AgentToken {
  id: string;
  name: string;
  scopes: string[];
  agent_id: string | null;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
}

interface CreateTokenResponse {
  id: string;
  name: string;
  scopes: string[];
  token: string;
}

export function AgentTokensSection() {
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScopes, setNewScopes] = useState('read');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const loadTokens = useCallback(async () => {
    try {
      const res = await api.get<{ data: AgentToken[] }>('/agent-tokens');
      setTokens(res.data ?? []);
    } catch {
      toast.error('Failed to load agent tokens');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTokens(); }, [loadTokens]);

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Name is required'); return; }
    setCreating(true);
    try {
      const res = await api.post<{ data: CreateTokenResponse }>('/agent-tokens', {
        name: newName.trim(),
        scopes: newScopes.split(',').map(s => s.trim()).filter(Boolean),
      });
      setNewToken(res.data.token);
      setNewName('');
      setNewScopes('read');
      loadTokens();
    } catch {
      toast.error('Failed to create token');
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/agent-tokens/${id}`);
      toast.success('Token revoked');
      setTokens(prev => prev.filter(t => t.id !== id));
    } catch {
      toast.error('Failed to revoke token');
    }
  };

  const handleCopy = () => {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEditSave = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await api.patch(`/agent-tokens/${id}`, { name: editName.trim() });
      setTokens(prev => prev.map(t => t.id === id ? { ...t, name: editName.trim() } : t));
      setEditingId(null);
      toast.success('Token updated');
    } catch {
      toast.error('Failed to update token');
    }
  };

  if (loading) return null;

  return (
    <SettingSection
      title="Agent Tokens"
      description="Personal access tokens for agents and API clients."
      action={
        !showForm && !newToken ? (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:opacity-90"
          >
            <Plus size={14} /> Create Token
          </button>
        ) : undefined
      }
    >
      {/* Create form */}
      {showForm && !newToken && (
        <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] mb-4 space-y-3">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Name</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. CI Pipeline"
              className="w-full px-3 py-1.5 text-sm rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Scopes (comma-separated)</label>
            <input
              value={newScopes}
              onChange={e => setNewScopes(e.target.value)}
              placeholder="read, write, notes, events"
              className="w-full px-3 py-1.5 text-sm rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => { setShowForm(false); setNewName(''); setNewScopes('read'); }}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--surface-hover)] text-[var(--text-muted)] hover:opacity-90"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Newly created token display */}
      {newToken && (
        <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/5 mb-4 space-y-2">
          <p className="text-xs font-semibold text-amber-400">
            Copy this token now — you won't be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-2 py-1.5 text-xs rounded bg-[var(--bg)] text-[var(--text)] font-mono break-all border border-[var(--border)]">
              {newToken}
            </code>
            <button onClick={handleCopy} className="p-1.5 rounded hover:bg-[var(--surface-hover)]">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-[var(--text-muted)]" />}
            </button>
          </div>
          <button
            onClick={() => { setNewToken(null); setShowForm(false); }}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--surface-hover)] text-[var(--text-muted)]"
          >
            Done
          </button>
        </div>
      )}

      {/* Token list */}
      {tokens.length === 0 && !showForm && !newToken ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">
          <Key size={24} className="mx-auto mb-2 opacity-40" />
          No agent tokens yet
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map(token => (
            <div
              key={token.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
            >
              <Key size={14} className="text-[var(--text-muted)] shrink-0" />
              <div className="flex-1 min-w-0">
                {editingId === token.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEditSave(token.id); if (e.key === 'Escape') setEditingId(null); }}
                      className="px-2 py-0.5 text-sm rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none"
                      autoFocus
                    />
                    <button onClick={() => handleEditSave(token.id)} className="text-xs text-[var(--accent)]">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-[var(--text-muted)]">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-[var(--text)] truncate">{token.name}</span>
                    <button
                      onClick={() => { setEditingId(token.id); setEditName(token.name); }}
                      className="p-0.5 rounded hover:bg-[var(--surface-hover)] opacity-0 group-hover:opacity-100"
                    >
                      <Pencil size={10} className="text-[var(--text-muted)]" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex gap-1 flex-wrap">
                    {token.scopes.map(s => (
                      <span
                        key={s}
                        className="px-1.5 py-0.5 text-[10px] rounded font-medium"
                        style={{
                          background: 'color-mix(in srgb, var(--amber) 18%, transparent)',
                          color: 'var(--amber)',
                          border: '1px solid color-mix(in srgb, var(--amber) 35%, transparent)',
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Created {new Date(token.created_at).toLocaleDateString()}
                  </span>
                  {token.last_used_at && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      · Last used {new Date(token.last_used_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(token.id)}
                className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 shrink-0"
                title="Revoke token"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </SettingSection>
  );
}
