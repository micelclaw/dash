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

// ─── Semantic Permissions Section ───────────────────────────────────
// Settings → Permissions: per-agent semantic scope editor with preview.

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Shield, Box, Eye, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { SettingSection } from '../SettingSection';

// ─── Types ──────────────────────────────────────────────

interface AgentToken {
  id: string;
  agentId: string;
  agentName: string;
  displayName: string;
  semanticScopes: SemanticScope[];
}

interface SemanticScope {
  domain: string;
  filterType: 'include' | 'exclude';
  filter: ScopeFilter;
}

type ScopeFilter =
  | { type: 'tags'; tags: string[] }
  | { type: 'category'; values: string[] }
  | { type: 'entity'; entityIds: string[] };

interface ScopePreview {
  [domain: string]: number;
}

const DOMAINS = ['notes', 'emails', 'contacts', 'events', 'files', 'diary'];

const DOMAIN_LABELS: Record<string, string> = {
  notes: 'Notes',
  emails: 'Emails',
  contacts: 'Contacts',
  events: 'Events',
  files: 'Files',
  diary: 'Diary',
};

const FILTER_TYPE_OPTIONS = [
  { value: 'include', label: 'Include only' },
  { value: 'exclude', label: 'Exclude' },
];

const FILTER_KIND_OPTIONS = [
  { value: 'tags', label: 'By tags' },
  { value: 'category', label: 'By category' },
];

// ─── Scope Badge ────────────────────────────────────────

function ScopeBadge({ scopes }: { scopes: SemanticScope[] }) {
  if (scopes.length === 0) {
    return (
      <span style={{ fontSize: '0.625rem', padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
        Full access
      </span>
    );
  }
  return (
    <span style={{ fontSize: '0.625rem', padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>
      Filtered ({scopes.length} {scopes.length === 1 ? 'scope' : 'scopes'})
    </span>
  );
}

// ─── Scope Editor Dialog ────────────────────────────────

function ScopeEditor({
  agent,
  onSave,
  onClose,
}: {
  agent: AgentToken;
  onSave: (agentId: string, scopes: SemanticScope[]) => Promise<void>;
  onClose: () => void;
}) {
  const [scopes, setScopes] = useState<SemanticScope[]>(
    agent.semanticScopes.map((s) => ({ ...s })),
  );
  const [preview, setPreview] = useState<ScopePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      // Convert camelCase back to snake_case for the API
      const apiScopes = scopes.map((s) => ({
        domain: s.domain,
        filter_type: s.filterType,
        filter: s.filter.type === 'tags'
          ? { type: 'tags', tags: s.filter.tags }
          : s.filter.type === 'category'
            ? { type: 'category', values: s.filter.values }
            : { type: 'entity', entity_ids: (s.filter as { type: 'entity'; entityIds: string[] }).entityIds },
      }));
      const res = await api.post<{ data: ScopePreview }>('/admin/scope-preview', { scopes: apiScopes });
      setPreview(res.data);
    } catch {
      toast.error('Failed to load preview');
    }
    setLoadingPreview(false);
  }, [scopes]);

  const handleAddScope = useCallback(() => {
    setScopes((prev) => [
      ...prev,
      { domain: 'notes', filterType: 'include', filter: { type: 'tags', tags: [] } },
    ]);
  }, []);

  const handleRemoveScope = useCallback((index: number) => {
    setScopes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(agent.id, scopes);
      onClose();
    } catch {
      toast.error('Failed to save scopes');
    }
    setSaving(false);
  }, [agent.id, scopes, onSave, onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 520,
          maxHeight: '80vh',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
              {agent.displayName || agent.agentName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Semantic scope editor
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {scopes.length === 0 ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>
              No scopes — this agent has full access to all data domains.
            </div>
          ) : (
            scopes.map((scope, i) => (
              <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <select
                    value={scope.domain}
                    onChange={(e) => setScopes((prev) => prev.map((s, j) => (j === i ? { ...s, domain: e.target.value } : s)))}
                    style={{
                      height: 28,
                      padding: '0 24px 0 8px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text)',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-sans)',
                      outline: 'none',
                      appearance: 'none',
                    }}
                  >
                    {DOMAINS.map((d) => (
                      <option key={d} value={d}>{DOMAIN_LABELS[d]}</option>
                    ))}
                  </select>
                  <select
                    value={scope.filterType}
                    onChange={(e) => setScopes((prev) => prev.map((s, j) => (j === i ? { ...s, filterType: e.target.value as 'include' | 'exclude' } : s)))}
                    style={{
                      height: 28,
                      padding: '0 24px 0 8px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text)',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-sans)',
                      outline: 'none',
                      appearance: 'none',
                    }}
                  >
                    {FILTER_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => handleRemoveScope(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: 0, display: 'flex' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Tag input */}
                {scope.filter.type === 'tags' && (
                  <div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Tags (comma-separated)
                    </div>
                    <input
                      value={scope.filter.tags.join(', ')}
                      onChange={(e) => {
                        const tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
                        setScopes((prev) => prev.map((s, j) => (j === i ? { ...s, filter: { type: 'tags', tags } } : s)));
                      }}
                      placeholder="work, personal, finance"
                      style={{
                        width: '100%',
                        height: 28,
                        padding: '0 8px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text)',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-sans)',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}

                {scope.filter.type === 'category' && (
                  <div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Categories (comma-separated)
                    </div>
                    <input
                      value={scope.filter.values.join(', ')}
                      onChange={(e) => {
                        const values = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
                        setScopes((prev) => prev.map((s, j) => (j === i ? { ...s, filter: { type: 'category', values } } : s)));
                      }}
                      placeholder="work, personal"
                      style={{
                        width: '100%',
                        height: 28,
                        padding: '0 8px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text)',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-sans)',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}
              </div>
            ))
          )}

          <button
            onClick={handleAddScope}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              margin: '12px 0',
              padding: '6px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-dim)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            <Plus size={12} />
            Add scope
          </button>

          {/* Preview */}
          <div style={{ marginTop: 16, padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 500 }}>
                Access preview
              </span>
              <button
                onClick={fetchPreview}
                disabled={loadingPreview}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                  fontSize: '0.625rem',
                  fontFamily: 'var(--font-sans)',
                  cursor: loadingPreview ? 'not-allowed' : 'pointer',
                  opacity: loadingPreview ? 0.5 : 1,
                }}
              >
                {loadingPreview ? (
                  <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Eye size={10} />
                )}
                Preview
              </button>
            </div>
            {preview ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {DOMAINS.map((d) => (
                  <div key={d} style={{ textAlign: 'center', padding: '6px 0' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                      {preview[d] ?? '-'}
                    </div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                      {DOMAIN_LABELS[d]}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                Click Preview to see how many records this agent can access.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '6px 16px',
              background: 'var(--amber)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: '#06060a',
              fontSize: '0.8125rem',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Section ───────────────────────────────────────

interface AppToken {
  id: string;
  appName: string;
  displayName: string;
  semanticScopes: SemanticScope[];
}

export function PermissionsSection() {
  const [agents, setAgents] = useState<AgentToken[]>([]);
  const [apps, setApps] = useState<AppToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState<AgentToken | null>(null);
  const [editingApp, setEditingApp] = useState<AppToken | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ data: AgentToken[] }>('/managed-agents').catch(() => ({ data: [] as AgentToken[] })),
      api.get<{ data: Array<Record<string, unknown>> }>('/apps').catch(() => ({ data: [] as Array<Record<string, unknown>> })),
    ])
      .then(([agentsRes, appsRes]) => {
        const tokens: AgentToken[] = (agentsRes.data as Array<Record<string, unknown>>).map((a) => ({
          id: a.id as string,
          agentId: a.id as string,
          agentName: (a.name || a.display_name || a.displayName || 'Agent') as string,
          displayName: (a.display_name || a.displayName || a.name || 'Agent') as string,
          semanticScopes: (a.semantic_scopes || a.semanticScopes || []) as SemanticScope[],
        }));
        setAgents(tokens);

        const appTokens: AppToken[] = appsRes.data.map((a) => ({
          id: a.id as string,
          appName: (a.app_name || a.appName || a.name || 'App') as string,
          displayName: (a.app_name || a.appName || a.name || 'App') as string,
          semanticScopes: (a.semantic_scopes || a.semanticScopes || []) as SemanticScope[],
        }));
        setApps(appTokens);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveScopes = useCallback(async (agentId: string, scopes: SemanticScope[]) => {
    // Convert to snake_case for API
    const apiScopes = scopes.map((s) => ({
      domain: s.domain,
      filter_type: s.filterType,
      filter: s.filter.type === 'tags'
        ? { type: 'tags', tags: s.filter.tags }
        : s.filter.type === 'category'
          ? { type: 'category', values: s.filter.values }
          : { type: 'entity', entity_ids: (s.filter as { type: 'entity'; entityIds: string[] }).entityIds },
    }));

    await api.put(`/managed-agents/${agentId}`, { semantic_scopes: apiScopes });
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, semanticScopes: scopes } : a)),
    );
    toast.success('Semantic scopes updated');
  }, []);

  const handleSaveAppScopes = useCallback(async (appId: string, scopes: SemanticScope[]) => {
    const apiScopes = scopes.map((s) => ({
      domain: s.domain,
      filter_type: s.filterType,
      filter: s.filter.type === 'tags'
        ? { type: 'tags', tags: s.filter.tags }
        : s.filter.type === 'category'
          ? { type: 'category', values: s.filter.values }
          : { type: 'entity', entity_ids: (s.filter as { type: 'entity'; entityIds: string[] }).entityIds },
    }));

    await api.put(`/apps/${appId}`, { semantic_scopes: apiScopes });
    setApps((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, semanticScopes: scopes } : a)),
    );
    toast.success('App scopes updated');
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', padding: 24 }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
        Loading permissions...
      </div>
    );
  }

  return (
    <>
      <SettingSection
        title="Agent Permissions"
        description="Configure semantic scopes to restrict which data each agent can access. Scopes filter by tags, categories, or specific entities."
      >
        {agents.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
            No agents configured. Create agents in the Agents section first.
          </div>
        ) : (
          agents.map((agent) => (
            <div
              key={agent.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={16} style={{ color: 'var(--text-dim)' }} />
                <div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500 }}>
                    {agent.displayName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
                    {agent.semanticScopes.length === 0
                      ? 'Full access to all data'
                      : `${agent.semanticScopes.length} scope${agent.semanticScopes.length === 1 ? '' : 's'} configured`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ScopeBadge scopes={agent.semanticScopes} />
                <button
                  onClick={() => setEditingAgent(agent)}
                  style={{
                    padding: '4px 10px',
                    background: 'var(--surface-hover)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          ))
        )}
      </SettingSection>

      {/* App Permissions */}
      <SettingSection
        title="App Permissions"
        description="Configure semantic scopes for installed apps. Same filtering applies as for agents."
      >
        {apps.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
            No apps installed. Install apps from ClawHub first.
          </div>
        ) : (
          apps.map((app) => (
            <div
              key={app.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Box size={16} style={{ color: 'var(--text-dim)' }} />
                <div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500 }}>
                    {app.displayName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
                    {app.semanticScopes.length === 0
                      ? 'Full access to all data'
                      : `${app.semanticScopes.length} scope${app.semanticScopes.length === 1 ? '' : 's'} configured`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ScopeBadge scopes={app.semanticScopes} />
                <button
                  onClick={() => setEditingApp(app)}
                  style={{
                    padding: '4px 10px',
                    background: 'var(--surface-hover)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          ))
        )}
      </SettingSection>

      {/* Scope Editor Modals */}
      {editingAgent && (
        <ScopeEditor
          agent={editingAgent}
          onSave={handleSaveScopes}
          onClose={() => setEditingAgent(null)}
        />
      )}
      {editingApp && (
        <ScopeEditor
          agent={{
            id: editingApp.id,
            agentId: editingApp.id,
            agentName: editingApp.appName,
            displayName: editingApp.displayName,
            semanticScopes: editingApp.semanticScopes,
          }}
          onSave={handleSaveAppScopes}
          onClose={() => setEditingApp(null)}
        />
      )}
    </>
  );
}
