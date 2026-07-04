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

// ─── Settings → Connectivity → MCP Connections (§B) ─────────────────
// Configure any MCP server (local or public Internet), see what each
// exposes (Test → tools/list) and manage them. Admin-only (mcp.servers
// is GLOBAL). The `claw-os` facade is shown read-only ("System"). Per-
// agent visibility lives in each Agent → Tools tab; activity for our own
// servers is in the Activity Center.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  Plug, Plus, LayoutGrid, Check, TriangleAlert, X, Loader2, Trash2, Pencil,
  Zap, ChevronLeft, Github, Folder, Globe, BookOpen, MessageSquare, Database, ShieldAlert,
} from 'lucide-react';
import * as gwService from '@/services/gateway.service';
import type { McpServerView, McpServerInput, McpProbeResult } from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { SectionShell } from '../shared/SectionShell';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { MCP_PRESETS, type McpPreset } from './mcp-presets';

const PRESET_ICON: Record<McpPreset['icon'], typeof Plug> = {
  github: Github, folder: Folder, browser: Globe, book: BookOpen, slack: MessageSquare, database: Database,
};

interface KV { key: string; value: string }
interface FormState {
  editingName: string | null; // null = new
  name: string;
  transport: 'http' | 'stdio';
  url: string;
  command: string;
  argsText: string;
  headers: KV[];
  env: KV[];
  timeout: string;
  includeText: string;
  excludeText: string;
  enabled: boolean;
}

const EMPTY_FORM: FormState = {
  editingName: null, name: '', transport: 'http', url: '', command: '', argsText: '',
  headers: [], env: [], timeout: '30000', includeText: '', excludeText: '', enabled: true,
};

// ─── view <-> input mappers ─────────────────────────────────────────

function kvToRecord(rows: KV[]): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const { key, value } of rows) if (key.trim()) out[key.trim()] = value;
  return Object.keys(out).length ? out : undefined;
}
function recordToKv(rec?: Record<string, string>): KV[] {
  return rec ? Object.entries(rec).map(([key, value]) => ({ key, value })) : [];
}
function splitList(s: string): string[] {
  return s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
}

function viewToInput(v: McpServerView): McpServerInput {
  return {
    transport: v.transport === 'stdio' ? 'stdio' : 'http',
    url: v.url, command: v.command, args: v.args,
    headers: v.headers, env: v.env, enabled: v.enabled, timeout: v.timeout,
    tool_filter: v.tool_filter,
  };
}
function formToInput(f: FormState): McpServerInput {
  const isHttp = f.transport === 'http';
  const include = splitList(f.includeText);
  const exclude = splitList(f.excludeText);
  const timeout = Number(f.timeout);
  return {
    transport: f.transport,
    url: isHttp ? f.url.trim() || undefined : undefined,
    headers: isHttp ? kvToRecord(f.headers) : undefined,
    command: !isHttp ? f.command.trim() || undefined : undefined,
    args: !isHttp ? splitList(f.argsText.replace(/\s+/g, '\n')).length ? f.argsText.split('\n').map((a) => a.trim()).filter(Boolean) : undefined : undefined,
    env: !isHttp ? kvToRecord(f.env) : undefined,
    enabled: f.enabled,
    timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : undefined,
    tool_filter: (include.length || exclude.length) ? { include: include.length ? include : undefined, exclude: exclude.length ? exclude : undefined } : undefined,
  };
}

// ─── main ───────────────────────────────────────────────────────────

type Health = { status: 'idle' | 'testing' | 'ok' | 'auth' | 'error'; result?: McpProbeResult };

export function McpConnectionsSection() {
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<McpServerView | null>(null);
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<McpServerView[]>([]);
  const [view, setView] = useState<'list' | 'form' | 'catalog'>('list');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [health, setHealth] = useState<Record<string, Health>>({});
  const [saving, setSaving] = useState(false);
  // Test result shown in the form / introspection panel.
  const [formTest, setFormTest] = useState<Health>({ status: 'idle' });
  const [catalogQuery, setCatalogQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setServers(await gwService.getMcpConfig());
    } catch (err) {
      toast.error(describeError(err, 'Failed to load MCP connections'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function classifyProbe(r: McpProbeResult): Health {
    if (r.ok) return { status: 'ok', result: r };
    if (r.error && /auth|401|403|unauthor|forbidden/i.test(r.error)) return { status: 'auth', result: r };
    return { status: 'error', result: r };
  }

  async function testRow(s: McpServerView) {
    setHealth((h) => ({ ...h, [s.name]: { status: 'testing' } }));
    try {
      const r = await gwService.testMcpServer({ name: s.name, ...viewToInput(s) });
      setHealth((h) => ({ ...h, [s.name]: classifyProbe(r) }));
    } catch (err) {
      setHealth((h) => ({ ...h, [s.name]: { status: 'error', result: { ok: false, error: describeError(err) } } }));
    }
  }

  async function toggleEnabled(s: McpServerView) {
    try {
      await gwService.upsertMcpServer(s.name, { ...viewToInput(s), enabled: !s.enabled });
      toast.success(`${s.name} ${!s.enabled ? 'enabled' : 'disabled'} — reload the Gateway to apply`);
      void load();
    } catch (err) {
      toast.error(describeError(err, 'Failed to update connection'));
    }
  }

  async function doDelete() {
    const s = pendingDelete;
    if (!s) return;
    setPendingDelete(null);
    try {
      await gwService.deleteMcpServer(s.name);
      toast.success(`${s.name} deleted`);
      void load();
    } catch (err) {
      toast.error(describeError(err, 'Failed to delete connection'));
    }
  }

  function openNew() { setForm(EMPTY_FORM); setFormTest({ status: 'idle' }); setView('form'); }
  function openEdit(s: McpServerView) {
    setForm({
      editingName: s.name, name: s.name,
      transport: s.transport === 'stdio' ? 'stdio' : 'http',
      url: s.url ?? '', command: s.command ?? '', argsText: (s.args ?? []).join('\n'),
      headers: recordToKv(s.headers), env: recordToKv(s.env),
      timeout: String(s.timeout ?? 30000),
      includeText: (s.tool_filter?.include ?? []).join(', '),
      excludeText: (s.tool_filter?.exclude ?? []).join(', '),
      enabled: s.enabled,
    });
    setFormTest({ status: 'idle' });
    setView('form');
  }
  function applyPreset(p: McpPreset) {
    setForm({
      ...EMPTY_FORM,
      name: p.slug, transport: p.transport,
      url: p.url ?? '', command: p.command ?? '', argsText: (p.args ?? []).join('\n'),
      headers: recordToKv(p.headers), env: recordToKv(p.env),
      includeText: (p.suggested_include ?? []).join(', '),
    });
    setFormTest({ status: 'idle' });
    setView('form');
  }

  async function runFormTest() {
    setFormTest({ status: 'testing' });
    try {
      const r = await gwService.testMcpServer({ name: form.editingName ?? undefined, ...formToInput(form) });
      setFormTest(classifyProbe(r));
    } catch (err) {
      setFormTest({ status: 'error', result: { ok: false, error: describeError(err) } });
    }
  }

  async function saveForm() {
    const name = form.name.trim();
    if (!name) { toast.error('A name is required'); return; }
    if (name === 'claw-os') { toast.error('“claw-os” is reserved by Micelclaw'); return; }
    setSaving(true);
    try {
      await gwService.upsertMcpServer(name, formToInput(form));
      toast.success(`Saved — reload the Gateway to apply “${name}”`);
      setView('list');
      void load();
    } catch (err) {
      toast.error(describeError(err, 'Failed to save connection'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionShell
      title="MCP Connections"
      description="Connect any MCP server (local or public) so your agents can use its tools. Admin only — this config is shared across all agents."
      loading={loading}
      dirty={false}
      saving={false}
      onSave={() => {}}
      appliesAt="gateway-restart"
    >
      {view === 'list' && (
        <ListView
          servers={servers} health={health}
          onAdd={openNew} onCatalog={() => setView('catalog')}
          onTest={testRow} onEdit={openEdit} onDelete={setPendingDelete} onToggle={toggleEnabled}
          onOpenActivity={() => navigate('/activity?tab=events')}
        />
      )}
      {view === 'form' && (
        <FormView
          form={form} setForm={setForm} saving={saving} test={formTest}
          onBack={() => setView('list')} onTest={runFormTest} onSave={saveForm}
        />
      )}
      {view === 'catalog' && (
        <CatalogView
          query={catalogQuery} setQuery={setCatalogQuery}
          onPick={applyPreset} onBlank={openNew} onBack={() => setView('list')}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name ?? ''}"?`}
        description="The connection is removed on the next Gateway reload. Agents lose its tools."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => void doDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </SectionShell>
  );
}

// ─── List view ──────────────────────────────────────────────────────

function HealthChip({ h }: { h?: Health }) {
  if (!h || h.status === 'idle') return <span style={chip('var(--text-muted)')}>untested</span>;
  if (h.status === 'testing') return <span style={chip('var(--text-dim)')}><Loader2 size={11} className="spin" /> testing…</span>;
  if (h.status === 'ok') return <span style={chip('#22c55e')}><Check size={11} /> Connected · {h.result?.tool_count ?? 0} tools</span>;
  if (h.status === 'auth') return <span style={chip('var(--amber)')}><TriangleAlert size={11} /> Auth needed</span>;
  return <span style={chip('#ef4444')}><X size={11} /> Error</span>;
}

function ListView({
  servers, health, onAdd, onCatalog, onTest, onEdit, onDelete, onToggle, onOpenActivity,
}: {
  servers: McpServerView[]; health: Record<string, Health>;
  onAdd: () => void; onCatalog: () => void;
  onTest: (s: McpServerView) => void; onEdit: (s: McpServerView) => void;
  onDelete: (s: McpServerView) => void; onToggle: (s: McpServerView) => void;
  onOpenActivity: () => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={onAdd} style={btnPrimary}><Plus size={14} /> Add connection</button>
        <button onClick={onCatalog} style={btnGhost}><LayoutGrid size={14} /> Add from catalog</button>
      </div>

      <div style={securityNote}>
        <ShieldAlert size={14} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
        <span>Third-party MCP tools run host-side and are <b>not</b> covered by Micelclaw's tool governance (scope / approvals). Prefer HTTP + a minimal allowlist for untrusted servers.</span>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {servers.length === 0 && (
          <div style={{ padding: 16, fontSize: '0.8125rem', color: 'var(--text-dim)' }}>No MCP connections yet.</div>
        )}
        {servers.map((s, i) => (
          <div key={s.name} style={{ padding: '12px 14px', borderBottom: i < servers.length - 1 ? '1px solid var(--border)' : 'none', opacity: s.enabled || s.system ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {s.system ? (
                <Plug size={15} style={{ color: 'var(--text-dim)' }} />
              ) : (
                <button
                  onClick={() => onToggle(s)}
                  title={s.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                  style={toggleDot(s.enabled)}
                />
              )}
              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>{s.name}</span>
              {s.system && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.03em' }}>System</span>}
              <span style={{ marginLeft: 'auto' }}>
                {s.system
                  ? <span style={chip('#22c55e')}><Check size={11} /> Connected</span>
                  : <HealthChip h={health[s.name]} />}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, marginLeft: 25, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span>{s.transport}</span>
              <span style={{ fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                {s.url ?? [s.command, ...(s.args ?? [])].filter(Boolean).join(' ')}
              </span>
              {s.system ? (
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>provided by Micelclaw · read-only</span>
              ) : (
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
                  <button onClick={() => onTest(s)} style={rowBtn}><Zap size={12} /> Test</button>
                  <button onClick={() => onEdit(s)} style={rowBtn}><Pencil size={12} /> Edit</button>
                  <button onClick={() => onDelete(s)} style={{ ...rowBtn, color: '#ef4444' }}><Trash2 size={12} /></button>
                </span>
              )}
            </div>
            {/* Introspection result (after Test) */}
            {health[s.name]?.result?.ok && (health[s.name]!.result!.tools?.length ?? 0) > 0 && (
              <ExposesPanel result={health[s.name]!.result!} />
            )}
            {health[s.name]?.result && !health[s.name]!.result!.ok && (
              <div style={{ marginLeft: 25, marginTop: 6, fontSize: '0.7rem', color: '#ef4444' }}>{health[s.name]!.result!.error}</div>
            )}
          </div>
        ))}
      </div>

      {/* Activity (v1 pragmatic) */}
      <div style={{ marginTop: 16 }}>
        <h3 style={sub}>Activity</h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '0 0 6px', lineHeight: 1.5 }}>
          Live tool activity for our own servers (<code style={inlineCode}>claw-os</code>, <code style={inlineCode}>studio-sandbox</code>) is in the{' '}
          <button onClick={onOpenActivity} style={linkBtn}>Activity Center → Events</button>.
          Per-session activity for third-party servers is coming soon.
        </p>
      </div>
    </div>
  );
}

function ExposesPanel({ result }: { result: McpProbeResult }) {
  const [showAll, setShowAll] = useState(false);
  const tools = result.tools ?? [];
  const shown = showAll ? tools : tools.slice(0, 6);
  return (
    <div style={{ marginLeft: 25, marginTop: 8, padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text)' }}>Exposes</span>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{result.tool_count ?? tools.length} tools · Resources: {result.resources ? 'yes' : 'no'} · Prompts: {result.prompts ? 'yes' : 'no'}</span>
      </div>
      {shown.map((t) => (
        <div key={t.name} style={{ display: 'flex', gap: 8, fontSize: '0.7rem', padding: '2px 0' }}>
          <code style={{ ...inlineCode, minWidth: 140 }}>{t.name}</code>
          <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description ?? ''}</span>
        </div>
      ))}
      {tools.length > 6 && (
        <button onClick={() => setShowAll((v) => !v)} style={{ ...linkBtn, marginTop: 4 }}>
          {showAll ? 'show less' : `… ${tools.length - 6} more`}
        </button>
      )}
    </div>
  );
}

// ─── Form view ──────────────────────────────────────────────────────

function KVEditor({ label, rows, onChange, addLabel }: { label: string; rows: KV[]; onChange: (r: KV[]) => void; addLabel: string }) {
  const set = (i: number, patch: Partial<KV>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={fieldLabel}>{label}</label>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
          <input value={r.key} placeholder="key" onChange={(e) => set(i, { key: e.target.value })} style={{ ...input, flex: 1 }} />
          <input value={r.value} placeholder="value" onChange={(e) => set(i, { value: e.target.value })} style={{ ...input, flex: 1.4 }} />
          <button onClick={() => onChange(rows.filter((_, idx) => idx !== i))} style={{ ...rowBtn, color: '#ef4444' }}><X size={12} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...rows, { key: '', value: '' }])} style={{ ...rowBtn, marginTop: 2 }}><Plus size={12} /> {addLabel}</button>
    </div>
  );
}

function FormView({
  form, setForm, saving, test, onBack, onTest, onSave,
}: {
  form: FormState; setForm: (f: FormState) => void; saving: boolean; test: Health;
  onBack: () => void; onTest: () => void; onSave: () => void;
}) {
  const up = (patch: Partial<FormState>) => setForm({ ...form, ...patch });
  const isHttp = form.transport === 'http';
  return (
    <div>
      <button onClick={onBack} style={{ ...linkBtn, marginBottom: 12 }}><ChevronLeft size={13} /> Back to list</button>

      <label style={fieldLabel}>Name</label>
      <input value={form.name} disabled={form.editingName !== null} placeholder="github"
        onChange={(e) => up({ name: e.target.value })} style={{ ...input, marginBottom: 12, opacity: form.editingName ? 0.7 : 1 }} />

      <label style={fieldLabel}>Transport</label>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        {(['http', 'stdio'] as const).map((t) => (
          <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text)', cursor: 'pointer' }}>
            <input type="radio" checked={form.transport === t} onChange={() => up({ transport: t })} />
            {t === 'http' ? 'Streamable HTTP' : 'Stdio'}
          </label>
        ))}
      </div>

      {isHttp ? (
        <>
          <label style={fieldLabel}>URL</label>
          <input value={form.url} placeholder="https://mcp.example.com/mcp" onChange={(e) => up({ url: e.target.value })} style={{ ...input, marginBottom: 12 }} />
          <KVEditor label="Headers" rows={form.headers} onChange={(headers) => up({ headers })} addLabel="Add header" />
        </>
      ) : (
        <>
          <label style={fieldLabel}>Command</label>
          <input value={form.command} placeholder="npx" onChange={(e) => up({ command: e.target.value })} style={{ ...input, marginBottom: 12 }} />
          <label style={fieldLabel}>Arguments (one per line)</label>
          <textarea value={form.argsText} rows={3} placeholder={'-y\n@modelcontextprotocol/server-filesystem\n/srv/share'} onChange={(e) => up({ argsText: e.target.value })} style={{ ...input, marginBottom: 12, fontFamily: 'var(--font-mono)', resize: 'vertical' }} />
          <KVEditor label="Environment variables" rows={form.env} onChange={(env) => up({ env })} addLabel="Add variable" />
        </>
      )}

      <label style={fieldLabel}>Timeout (ms)</label>
      <input value={form.timeout} onChange={(e) => up({ timeout: e.target.value })} style={{ ...input, marginBottom: 16, maxWidth: 160 }} />

      <div style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: 12 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Which tools this server may use</div>
        <label style={{ ...fieldLabel, marginBottom: 4 }}>Allow only <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(recommended — comma-separated)</span></label>
        <input value={form.includeText} placeholder="create_issue, list_issues" onChange={(e) => up({ includeText: e.target.value })} style={{ ...input, marginBottom: 8 }} />
        <label style={{ ...fieldLabel, marginBottom: 4 }}>Never allow <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(comma-separated)</span></label>
        <input value={form.excludeText} placeholder="delete_repo" onChange={(e) => up({ excludeText: e.target.value })} style={input} />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text)', marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.enabled} onChange={(e) => up({ enabled: e.target.checked })} /> Enabled
      </label>

      {/* Test */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <button onClick={onTest} disabled={test.status === 'testing'} style={btnGhost}>
          {test.status === 'testing' ? <Loader2 size={14} className="spin" /> : <Zap size={14} />} Test connection
        </button>
        {test.status === 'ok' && <span style={{ fontSize: '0.75rem', color: '#22c55e' }}><Check size={12} /> Connected — {test.result?.tool_count ?? 0} tools found</span>}
        {test.status === 'auth' && <span style={{ fontSize: '0.75rem', color: 'var(--amber)' }}><TriangleAlert size={12} /> {test.result?.error}</span>}
        {test.status === 'error' && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}><X size={12} /> {test.result?.error}</span>}
      </div>
      {test.status === 'ok' && (test.result?.tools?.length ?? 0) > 0 && <ExposesPanel result={test.result!} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: 'auto' }}><TriangleAlert size={11} /> Saving takes effect on the next Gateway reload.</span>
        <button onClick={onBack} style={btnGhost}>Cancel</button>
        <button onClick={onSave} disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

// ─── Catalog view ───────────────────────────────────────────────────

function CatalogView({
  query, setQuery, onPick, onBlank, onBack,
}: {
  query: string; setQuery: (q: string) => void;
  onPick: (p: McpPreset) => void; onBlank: () => void; onBack: () => void;
}) {
  const filtered = MCP_PRESETS.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.blurb.toLowerCase().includes(query.toLowerCase()));
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button onClick={onBack} style={linkBtn}><ChevronLeft size={13} /> Back</button>
        <button onClick={onBlank} style={{ ...btnGhost, marginLeft: 'auto' }}><Plus size={14} /> Blank connection</button>
      </div>
      <input value={query} placeholder="Filter the catalog…" onChange={(e) => setQuery(e.target.value)} style={{ ...input, marginBottom: 12 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {filtered.map((p) => {
          const Icon = PRESET_ICON[p.icon] ?? Plug;
          return (
            <button key={p.slug} onClick={() => onPick(p)} style={presetCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={16} style={{ color: 'var(--text-dim)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>{p.name}</span>
              </div>
              <p style={{ margin: '6px 0 4px', fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>{p.blurb}</p>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Suggests {p.suggested_include?.length ?? 0} tools</span>
            </button>
          );
        })}
      </div>
      <p style={{ marginTop: 10, fontSize: '0.7rem', color: 'var(--text-muted)' }}>Presets fill a small, safe tool list. Review it, then Save.</p>
    </div>
  );
}

// ─── styles ─────────────────────────────────────────────────────────

const chip = (color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 500, color,
});
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: '0.8rem', fontWeight: 600,
  background: 'var(--amber)', color: '#000', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: '0.8rem', fontWeight: 500,
  background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const rowBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: '0.7rem', fontWeight: 500,
  background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const linkBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, background: 'none', border: 'none',
  color: 'var(--amber)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const toggleDot = (on: boolean): React.CSSProperties => ({
  width: 15, height: 15, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
  border: `2px solid ${on ? '#22c55e' : 'var(--text-muted)'}`, background: on ? '#22c55e' : 'transparent', padding: 0,
});
const securityNote: React.CSSProperties = {
  display: 'flex', gap: 8, padding: '10px 12px', marginBottom: 12,
  background: 'color-mix(in srgb, var(--amber) 7%, transparent)',
  border: '1px solid color-mix(in srgb, var(--amber) 30%, var(--border))',
  borderRadius: 'var(--radius-md)', fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.5,
};
const sub: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 5, fontWeight: 500,
};
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: '0.8rem',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text)', fontFamily: 'var(--font-sans)', outline: 'none',
};
const inlineCode: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: '0.9em', background: 'var(--surface)', padding: '1px 4px', borderRadius: 3, color: 'var(--text)',
};
const presetCard: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left',
  padding: '12px 14px', background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
};

export default McpConnectionsSection;
