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

// ─── Permissions Section (redesign) ───────────────────────────────
//
// Two orthogonal dimensions per agent/app:
//   1. Domain access — checkbox grid of record types the agent can see
//   2. Tag filter (optional) — restrict to content with specific tags
//
// New data model saved to managed_agents.permissions JSONB:
//   { allowed_domains: string[], tag_filter: { mode, tags } | null }
//
// Preview counts come from POST /admin/scope-preview (rewritten).

import { useState, useEffect, useCallback, type KeyboardEvent } from 'react';
import { Loader2, Shield, Eye, X, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import * as approvalsSvc from '@/services/approvals.service';
import * as agentsAdmin from '@/services/agents-admin.service';
import { SettingSection } from '../SettingSection';
// Domain registry is shared with DigestSection — extending it in
// `config/domains.ts` updates both sections automatically.
import { DATA_DOMAINS as DOMAINS, ALL_DOMAIN_IDS } from '@/config/domains';

// ─── Types ──────────────────────────────────────────────

type DomainTagFilter = { mode: 'include' | 'exclude'; tags: string[] };

interface AgentPermissions {
  allowed_domains: string[];
  // Fase 3.6: filtro por etiqueta POR-DOMINIO.
  tag_filters?: Record<string, DomainTagFilter>;
  // Legacy: un filtro global (shape anterior). Se tolera al leer y se migra a
  // tag_filters al abrir el editor.
  tag_filter?: DomainTagFilter | null;
}

interface AgentRow {
  id: string;
  name: string;
  display_name: string;
  permissions: AgentPermissions;
}

// Note: App Permissions removed — apps access data through their
// agent's token, so agent permissions already cover access control.

interface PreviewResult {
  [domain: string]: { total: number; filtered: number };
}

function parsePermissions(raw: unknown): AgentPermissions {
  if (raw && typeof raw === 'object' && 'allowed_domains' in raw) {
    return raw as AgentPermissions;
  }
  return { allowed_domains: [], tag_filters: {} };
}

function tagFilterCount(p: AgentPermissions): number {
  const perDomain = Object.values(p.tag_filters ?? {}).filter((f) => f.tags?.length > 0).length;
  const legacy = p.tag_filter?.tags?.length ? 1 : 0;
  return perDomain + legacy;
}

function isFullAccess(p: AgentPermissions): boolean {
  return p.allowed_domains.length === 0 && tagFilterCount(p) === 0;
}

function permissionsSummary(p: AgentPermissions): string {
  if (isFullAccess(p)) return 'Full access to all data';
  const parts: string[] = [];
  if (p.allowed_domains.length > 0 && p.allowed_domains.length < ALL_DOMAIN_IDS.length) {
    parts.push(`${p.allowed_domains.length} domain${p.allowed_domains.length === 1 ? '' : 's'}`);
  }
  const tf = tagFilterCount(p);
  if (tf > 0) parts.push(`${tf} tag filter${tf === 1 ? '' : 's'}`);
  return parts.length > 0 ? parts.join(' · ') : 'Full access to all data';
}

// ─── Permission Badge ──────────────────────────────────

function PermBadge({ permissions }: { permissions: AgentPermissions }) {
  if (isFullAccess(permissions)) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
        style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
        Full access
      </span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
      style={{
        background: 'color-mix(in srgb, var(--amber) 18%, transparent)',
        color: 'var(--amber)',
        border: '1px solid color-mix(in srgb, var(--amber) 35%, transparent)',
      }}>
      {permissionsSummary({ ...permissions })}
    </span>
  );
}

// ─── Tag Chip Input ────────────────────────────────────

function TagChipInput({
  tags,
  onChange,
  inputId = 'tag-chip-input',
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  inputId?: string;
}) {
  const [input, setInput] = useState('');

  const addTag = (value: string) => {
    const t = value.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 p-2 min-h-[36px] rounded-md border border-[var(--border)] bg-[var(--surface)]"
      onClick={() => {
        const inp = document.getElementById(inputId);
        if (inp) inp.focus();
      }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
          style={{
            background: 'color-mix(in srgb, var(--amber) 18%, transparent)',
            color: 'var(--amber)',
            border: '1px solid color-mix(in srgb, var(--amber) 35%, transparent)',
          }}
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(tags.filter((t) => t !== tag));
            }}
            className="flex items-center p-0 bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--amber)' }}
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        id={inputId}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? 'Type a tag and press Enter...' : ''}
        className="flex-1 min-w-[100px] bg-transparent border-none outline-none text-xs text-[var(--text)] placeholder:text-[var(--text-muted)]"
      />
    </div>
  );
}

// ─── Scope Editor Dialog (redesigned) ──────────────────

function ScopeEditor({
  entityName,
  entityType,
  initialPermissions,
  onSave,
  onClose,
}: {
  entityName: string;
  entityType: 'agent' | 'app';
  initialPermissions: AgentPermissions;
  onSave: (permissions: AgentPermissions) => Promise<void>;
  onClose: () => void;
}) {
  // Domain access: if allowed_domains is empty, treat as "all checked"
  const [checkedDomains, setCheckedDomains] = useState<Set<string>>(() => {
    if (initialPermissions.allowed_domains.length === 0) return new Set(ALL_DOMAIN_IDS);
    return new Set(initialPermissions.allowed_domains);
  });

  // Filtro por etiqueta POR-DOMINIO (Fase 3.6). Si llega el legacy global lo
  // migramos al abrir: se aplica a cada dominio CON tags del set permitido.
  const initialTagFilters: Record<string, DomainTagFilter> = (() => {
    if (initialPermissions.tag_filters && Object.keys(initialPermissions.tag_filters).length > 0) {
      return { ...initialPermissions.tag_filters };
    }
    const legacy = initialPermissions.tag_filter;
    if (legacy && legacy.tags.length > 0) {
      const allowed = initialPermissions.allowed_domains.length === 0 ? ALL_DOMAIN_IDS : initialPermissions.allowed_domains;
      const out: Record<string, DomainTagFilter> = {};
      for (const id of allowed) {
        if (DOMAINS.find((d) => d.id === id)?.hasTagSupport) out[id] = { mode: legacy.mode, tags: [...legacy.tags] };
      }
      return out;
    }
    return {};
  })();
  const [tagFilters, setTagFilters] = useState<Record<string, DomainTagFilter>>(initialTagFilters);
  // Filas con el editor de filtro abierto.
  const [expanded, setExpanded] = useState<Set<string>>(new Set(Object.keys(initialTagFilters)));

  // Preview
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const allChecked = checkedDomains.size === ALL_DOMAIN_IDS.length;

  const toggleDomain = (id: string) => {
    setCheckedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Al desmarcar, quitamos su filtro y lo colapsamos.
    setTagFilters((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setExpanded((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setPreview(null);
  };

  const toggleAll = () => {
    setCheckedDomains(allChecked ? new Set() : new Set(ALL_DOMAIN_IDS));
    if (allChecked) { setTagFilters({}); setExpanded(new Set()); }
    setPreview(null);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
        // Al abrir por primera vez, inicializa un filtro include vacío.
        setTagFilters((tf) => (tf[id] ? tf : { ...tf, [id]: { mode: 'include', tags: [] } }));
      }
      return n;
    });
  };

  const setDomainFilter = (id: string, patch: Partial<DomainTagFilter>) => {
    setTagFilters((prev) => ({
      ...prev,
      [id]: { mode: prev[id]?.mode ?? 'include', tags: prev[id]?.tags ?? [], ...patch },
    }));
    setPreview(null);
  };

  const buildPermissions = (): AgentPermissions => {
    const allowed = allChecked ? [] : Array.from(checkedDomains);
    // Solo dominios marcados, con al menos una etiqueta.
    const tag_filters: Record<string, DomainTagFilter> = {};
    for (const [id, f] of Object.entries(tagFilters)) {
      if (checkedDomains.has(id) && f.tags.length > 0) tag_filters[id] = f;
    }
    return { allowed_domains: allowed, tag_filters };
  };

  const fetchPreview = async () => {
    setLoadingPreview(true);
    try {
      const perms = buildPermissions();
      setPreview(await approvalsSvc.previewScope({
        allowed_domains: perms.allowed_domains,
        tag_filters: perms.tag_filters ?? {},
      }));
    } catch {
      toast.error('Failed to load preview');
    }
    setLoadingPreview(false);
  };

  const handleSave = async () => {
    if (checkedDomains.size === 0) {
      toast.error('Select at least one domain');
      return;
    }
    setSaving(true);
    try {
      await onSave(buildPermissions());
      onClose();
    } catch {
      toast.error('Failed to save permissions');
    }
    setSaving(false);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 540, maxHeight: '85vh',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
              {entityName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {entityType === 'agent' ? 'Agent' : 'App'} permissions
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Domain access grid */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Domain access
              </span>
              <button
                type="button"
                onClick={toggleAll}
                style={{
                  fontSize: '0.625rem', color: 'var(--text-muted)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0,
                  textDecoration: 'underline',
                }}
              >
                {allChecked ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {DOMAINS.map((d) => {
                const Icon = d.icon;
                const checked = checkedDomains.has(d.id);
                const filter = tagFilters[d.id];
                const isOpen = expanded.has(d.id);
                const mode = filter?.mode ?? 'include';
                return (
                  <div
                    key={d.id}
                    style={{
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid',
                      borderColor: checked ? 'var(--border)' : 'transparent',
                      background: checked ? 'var(--surface)' : 'transparent',
                      transition: 'all 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, fontSize: '0.8125rem', color: checked ? 'var(--text)' : 'var(--text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDomain(d.id)}
                          style={{ accentColor: 'var(--amber)', width: 14, height: 14 }}
                        />
                        <Icon size={14} />
                        <span>{d.label}</span>
                      </label>
                      {checked && d.hasTagSupport && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(d.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px',
                            background: filter?.tags.length ? 'color-mix(in srgb, var(--amber) 14%, transparent)' : 'transparent',
                            border: '1px solid',
                            borderColor: filter?.tags.length ? 'color-mix(in srgb, var(--amber) 35%, transparent)' : 'var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            color: filter?.tags.length ? 'var(--amber)' : 'var(--text-muted)',
                            fontSize: '0.625rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
                          }}
                        >
                          {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          {filter?.tags.length ? `${mode} ${filter.tags.length}` : 'tag filter'}
                        </button>
                      )}
                      {checked && !d.hasTagSupport && (
                        <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>sin tags</span>
                      )}
                    </div>
                    {checked && d.hasTagSupport && isOpen && (
                      <div style={{ padding: '0 8px 10px 30px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                          {(['include', 'exclude'] as const).map((m) => (
                            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name={`mode-${d.id}`}
                                checked={mode === m}
                                onChange={() => setDomainFilter(d.id, { mode: m })}
                                style={{ accentColor: 'var(--amber)', width: 12, height: 12 }}
                              />
                              {m}
                            </label>
                          ))}
                        </div>
                        <TagChipInput
                          inputId={`tag-${d.id}`}
                          tags={filter?.tags ?? []}
                          onChange={(t) => setDomainFilter(d.id, { tags: t })}
                        />
                        <p style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', marginTop: 6 }}>
                          {mode === 'include'
                            ? `Solo registros de ${d.label} con alguna de estas etiquetas.`
                            : `Todos los de ${d.label} EXCEPTO los de estas etiquetas.`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          <div style={{ padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 500 }}>
                Access preview
              </span>
              <button
                type="button"
                onClick={fetchPreview}
                disabled={loadingPreview || checkedDomains.size === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', background: 'var(--surface-hover)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)', fontSize: '0.625rem',
                  fontFamily: 'var(--font-sans)',
                  cursor: loadingPreview ? 'not-allowed' : 'pointer',
                  opacity: loadingPreview || checkedDomains.size === 0 ? 0.5 : 1,
                }}
              >
                {loadingPreview ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Eye size={10} />}
                Preview
              </button>
            </div>
            {preview ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {DOMAINS.filter((d) => checkedDomains.has(d.id)).map((d) => {
                  const entry = preview[d.id];
                  const total = entry?.total ?? 0;
                  const filtered = entry?.filtered ?? 0;
                  const hasFilter = !!tagFilters[d.id]?.tags.length && d.hasTagSupport;
                  return (
                    <div key={d.id} style={{ textAlign: 'center', padding: '6px 0' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                        {hasFilter ? filtered : total}
                      </div>
                      <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                        {d.label}
                        {hasFilter && total > 0 && (
                          <span> / {total}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                Click Preview to see how many records this {entityType} can access.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              color: 'var(--text)', fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || checkedDomains.size === 0}
            style={{
              padding: '6px 16px', background: 'var(--amber)',
              border: 'none', borderRadius: 'var(--radius-md)',
              color: '#06060a', fontSize: '0.8125rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: saving || checkedDomains.size === 0 ? 'not-allowed' : 'pointer',
              opacity: saving || checkedDomains.size === 0 ? 0.5 : 1,
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

export function PermissionsSection() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState<AgentRow | null>(null);

  useEffect(() => {
    agentsAdmin.listManagedAgents()
      .then((list) => {
        setAgents(
          list.map((a) => ({
            id: a.id as string,
            name: (a.name || a.display_name || 'Agent') as string,
            display_name: (a.display_name || a.name || 'Agent') as string,
            permissions: parsePermissions(a.permissions),
          })),
        );
      })
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveAgent = useCallback(
    async (agentId: string, permissions: AgentPermissions) => {
      await agentsAdmin.updateManagedAgent(agentId, { permissions });
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, permissions } : a)),
      );
      toast.success('Permissions updated');
    },
    [],
  );

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
        description="Control which data domains each agent can access, optionally filtered by tags."
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
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={16} style={{ color: 'var(--text-dim)' }} />
                <div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500 }}>
                    {agent.display_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
                    {permissionsSummary(agent.permissions)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PermBadge permissions={agent.permissions} />
                <button
                  onClick={() => setEditingAgent(agent)}
                  style={{
                    padding: '4px 10px', background: 'var(--surface-hover)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    color: 'var(--text)', fontSize: '0.75rem',
                    fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          ))
        )}
      </SettingSection>

      {editingAgent && (
        <ScopeEditor
          entityName={editingAgent.display_name}
          entityType="agent"
          initialPermissions={editingAgent.permissions}
          onSave={(p) => handleSaveAgent(editingAgent.id, p)}
          onClose={() => setEditingAgent(null)}
        />
      )}
    </>
  );
}
