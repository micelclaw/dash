/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, RotateCcw, Search, X, ChevronDown, ChevronRight, Check, ExternalLink, Stethoscope } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useToolCatalog } from './hooks/use-tool-catalog';

interface AgentToolAccessProps {
  agentId: string;
  agentName: string;
}

type ToolProfile = 'inherit' | 'minimal' | 'coding' | 'messaging' | 'full' | 'custom';

interface ToolAccessResponse {
  data: {
    global: { profile: string | null; allow: string[] | null; alsoAllow?: string[] | null; deny: string[] | null };
    agent: { profile: string | null; allow: string[] | null; alsoAllow?: string[] | null; deny: string[] | null };
    // Dominios de fachada ACTIVOS = los que conceden las apps/skills asignadas del
    // agente (unificación 2026-07-12). El bloque de tools `claw_*` es read-only y se
    // marca activo/inactivo por dominio a partir de esto.
    active_facade_domains?: string[];
    // Estado EFECTIVO del set de workboard del agente (perfil + override). `effective`
    // son las tools ON ahora mismo; se usa como estado inicial de los toggles.
    workboard?: { enabled: boolean; effective: string[]; override: { add: string[]; remove: string[] } | null };
    openclaw_agent_id: string;
  };
}

// Las entradas de la FACHADA MCP (`claw-os__*`) las gestiona el backend según las
// skills del agente (agent-tool-visibility): son la restricción por-app de los
// `claw_*`, NO tools nativos editables en esta matriz. Se filtran de allow/deny para
// que su `deny` no fuerce "custom" ni apague los 26 toggles nativos (era el bug
// "custom + todo OFF"). El backend re-aplica esta restricción en cada PATCH, así que
// el dash nunca necesita tocarlas.
function isServerGlob(t: string): boolean {
  return /__\*$/.test(t) && !t.startsWith('claw-os__');
}
// Strip BOTH the facade tools (claw-os__*) AND third-party MCP server globs
// (<server>__*, managed by the "MCP connections" subsection) → leaves only
// NATIVE tool names, so neither forces the agent into "custom" mode nor
// pollutes the native allow/deny sets.
function stripNonNative(list: string[] | null | undefined): string[] {
  return (list ?? []).filter((t) => !t.startsWith('claw-os__') && !isServerGlob(t));
}
/** The <server> names denied for this agent via `<server>__*` globs. */
function serverGlobsFrom(list: string[] | null | undefined): string[] {
  return (list ?? []).filter(isServerGlob).map((t) => t.replace(/__\*$/, ''));
}

const PRESET_META: { label: string; value: ToolProfile }[] = [
  { label: 'Inherit', value: 'inherit' },
  { label: 'Minimal', value: 'minimal' },
  { label: 'Coding', value: 'coding' },
  { label: 'Messaging', value: 'messaging' },
  { label: 'Full', value: 'full' },
  { label: 'Custom', value: 'custom' },
];

function getActiveProfile(agent: { profile: string | null; allow: string[] | null; deny: string[] | null }): ToolProfile {
  // If agent has explicit allow/deny lists of NATIVE tools → custom. El deny de
  // fachada (claw-os__*) se ignora aquí (lo gestiona el backend, no es nativo).
  if (stripNonNative(agent.allow).length > 0 || stripNonNative(agent.deny).length > 0) return 'custom';
  // If agent has a profile set → that profile
  if (agent.profile && ['minimal', 'coding', 'messaging', 'full'].includes(agent.profile)) {
    return agent.profile as ToolProfile;
  }
  // No override → inherit
  return 'inherit';
}

export function AgentToolAccess({ agentId }: AgentToolAccessProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  // B): filtro por nombre, grupos colapsados y confirmación visual de guardado.
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [justSaved, setJustSaved] = useState(false);
  const [accessMode, setAccessMode] = useState<'standard' | 'restricted'>('standard');

  // Catálogo dinámico (nativas + presets + workboard) — sustituye TOOL_GROUPS/
  // ALL_TOOLS/PRESET_TOOLS hardcodeados, compartido con ToolAccessDefaultsSection.
  const catalog = useToolCatalog(agentId);

  const [globalProfile, setGlobalProfile] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<ToolProfile>('inherit');
  const [customAllow, setCustomAllow] = useState<Set<string>>(new Set());
  const [customDeny, setCustomDeny] = useState<Set<string>>(new Set());
  // §B3: third-party MCP servers + which this agent is DENIED (by name).
  const [mcpDeny, setMcpDeny] = useState<Set<string>>(new Set());
  // Dominios de fachada activos según las apps asignadas (read-only, del GET tool-access).
  const [activeFacadeDomains, setActiveFacadeDomains] = useState<Set<string>>(new Set());
  // Set DESEADO de tools de workboard (toggleable, plugin de primera clase). Estado
  // inicial de `tool-access.workboard.effective`; se reescribe al elegir un preset.
  const [workboardOn, setWorkboardOn] = useState<Set<string>>(new Set());

  // Fase 3.6-B: tools MCP (claw_*) + third-party MCP servers — del catálogo compartido.
  const mcpTools = catalog.mcpTools;
  const externalMcp = catalog.externalMcp;

  const nativePresetSet = useCallback((profile: string): Set<string> => {
    return new Set(catalog.nativePresets[profile] ?? catalog.nativePresets.coding ?? []);
  }, [catalog.nativePresets]);

  const getToolsForProfile = useCallback((profile: ToolProfile, gProfile: string | null): Set<string> => {
    if (profile === 'inherit') {
      return nativePresetSet(gProfile ?? 'coding');
    }
    if (profile === 'custom') return new Set(catalog.allNativeTools); // custom starts with all enabled
    return nativePresetSet(profile);
  }, [nativePresetSet, catalog.allNativeTools]);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ToolAccessResponse>(`/managed-agents/${agentId}/tool-access`);
      setGlobalProfile(res.data.global.profile);
      const profile = getActiveProfile(res.data.agent);
      setActiveProfile(profile);
      if (profile === 'custom') {
        // Solo tools nativos: las claw-os__* y los globs <server>__* se re-aplican aparte.
        setCustomAllow(new Set(stripNonNative(res.data.agent.allow)));
        setCustomDeny(new Set(stripNonNative(res.data.agent.deny)));
      }
      // MCP per-server visibility lives in `deny` as <server>__* globs,
      // independent of the native profile (loaded for every mode).
      setMcpDeny(new Set(serverGlobsFrom(res.data.agent.deny)));
      setActiveFacadeDomains(new Set(res.data.active_facade_domains ?? []));
      setWorkboardOn(new Set(res.data.workboard?.effective ?? []));
      setDirty(false);
    } catch {
      toast.error('Failed to load tool access config');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  useEffect(() => { setAccessMode(catalog.accessMode); }, [catalog.accessMode]);

  const changeAccessMode = async (value: 'standard' | 'restricted') => {
    try {
      await api.patch(`/managed-agents/${agentId}`, { access_mode: value });
      setAccessMode(value);
      toast.success(`Access mode: ${value}. Las sesiones abiertas necesitan /reset.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo cambiar el modo de acceso'); }
  };

  const handleProfileSelect = (profile: ToolProfile) => {
    setActiveProfile(profile);
    if (profile !== 'custom') {
      setCustomAllow(new Set());
      setCustomDeny(new Set());
    }
    // Los presets aplican TAMBIÉN el set de workboard de profile_tools[preset]. 'custom'
    // conserva el workboardOn actual (igual que conserva allow/deny al pulsar el botón);
    // 'inherit' sigue el set del perfil global, igual que hace con las nativas.
    if (catalog.workboardEnabled) {
      if (profile === 'inherit') {
        const gp = globalProfile ?? 'coding';
        setWorkboardOn(new Set(catalog.profileTools[gp]?.tools ?? []));
      } else if (profile !== 'custom') {
        setWorkboardOn(new Set(catalog.profileTools[profile]?.tools ?? []));
      }
    }
    setDirty(true);
  };

  const isToolEnabled = (tool: string): boolean => {
    if (activeProfile === 'custom') {
      if (customDeny.has(tool)) return false;
      if (customAllow.has(tool)) return true;
      return false; // custom: explicit only
    }
    const profileTools = getToolsForProfile(activeProfile, globalProfile);
    return profileTools.has(tool);
  };

  const handleToolToggle = (tool: string) => {
    if (activeProfile !== 'custom') {
      // Switch to custom, starting from current profile's tools
      const currentTools = getToolsForProfile(activeProfile, globalProfile);
      const newAllow = new Set(currentTools);
      const newDeny = new Set<string>();
      if (currentTools.has(tool)) {
        newAllow.delete(tool);
        newDeny.add(tool);
      } else {
        newAllow.add(tool);
      }
      setCustomAllow(newAllow);
      setCustomDeny(newDeny);
      setActiveProfile('custom');
    } else {
      const newAllow = new Set(customAllow);
      const newDeny = new Set(customDeny);
      if (isToolEnabled(tool)) {
        newAllow.delete(tool);
        newDeny.add(tool);
      } else {
        newDeny.delete(tool);
        newAllow.add(tool);
      }
      setCustomAllow(newAllow);
      setCustomDeny(newDeny);
    }
    setDirty(true);
  };

  const isWorkboardToolEnabled = (tool: string): boolean => workboardOn.has(tool);

  const handleWorkboardToggle = (tool: string) => {
    setWorkboardOn((prev) => {
      const next = new Set(prev);
      if (next.has(tool)) next.delete(tool); else next.add(tool);
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // §B3: MCP per-server denies ride along in `deny` as <server>__* globs,
      // in every mode, without disturbing the native profile/allow/deny.
      const serverGlobs = [...mcpDeny].map((n) => `${n}__*`);
      // Workboard: el SET COMPLETO deseado — el backend lo convierte a delta contra
      // el perfil efectivo. Se envía siempre que el plugin esté activo, en TODOS los
      // modos (inherit/preset/custom), como campo independiente del bloque nativo.
      const workboardPatch = catalog.workboardEnabled ? [...workboardOn] : undefined;
      if (activeProfile === 'inherit') {
        // Remove per-agent override (native) but keep any MCP server denies.
        await api.patch(`/managed-agents/${agentId}/tool-access`, {
          scope: 'agent', profile: null, allow: null,
          deny: serverGlobs.length ? serverGlobs : null,
          ...(workboardPatch !== undefined ? { workboard: workboardPatch } : {}),
        });
      } else if (activeProfile === 'custom') {
        await api.patch(`/managed-agents/${agentId}/tool-access`, {
          scope: 'agent',
          profile: null,
          allow: [...customAllow],
          deny: [...customDeny, ...serverGlobs],
          ...(workboardPatch !== undefined ? { workboard: workboardPatch } : {}),
        });
      } else {
        // Standard profile (minimal, coding, messaging, full)
        await api.patch(`/managed-agents/${agentId}/tool-access`, {
          scope: 'agent', profile: activeProfile, allow: null,
          deny: serverGlobs.length ? serverGlobs : null,
          ...(workboardPatch !== undefined ? { workboard: workboardPatch } : {}),
        });
      }
      toast.success('Tool access updated');
      setDirty(false);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update tool access');
    } finally {
      setSaving(false);
    }
  };

  const toggleMcpServer = (name: string) => {
    setMcpDeny(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
    setDirty(true);
  };

  const toggleGroup = (label: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  const enabledCount = catalog.allNativeTools.filter(t => isToolEnabled(t)).length;
  const workboardEnabledCount = catalog.allWorkboardTools.filter(t => isWorkboardToolEnabled(t)).length;
  const effectiveByName = useMemo(() => new Map(catalog.effectiveTools.map((tool) => [tool.name, tool])), [catalog.effectiveTools]);

  const diagnoseRuntime = async () => {
    try {
      const response = await api.get<{ data: {
        recovery: string;
        reason?: string;
        gateway_loaded_version: number | null;
        expected_tools?: string[];
        plugin?: { gateway_registered?: boolean; sandbox_allowed?: boolean; registration_errors?: string[] };
      } }>(`/managed-agents/${agentId}/runtime-capabilities`);
      const recovery = response.data.recovery;
      if (recovery === 'none') toast.success(`Runtime al día · catálogo v${response.data.gateway_loaded_version}`);
      else if (recovery === 'reset_session') {
        toast.warning(`Gateway correcto · ${response.data.expected_tools?.length ?? 0} tools esperadas. Abre una sesión nueva o usa /reset.`);
      } else if (recovery === 'repair_sandbox_policy') {
        toast.error('Gateway ha cargado el plugin, pero la allowlist de la sandbox bloquea sus tools. /reset no basta: Core debe reparar esa política.');
      } else {
        const detail = response.data.plugin?.registration_errors?.[0];
        toast.error(detail
          ? `Gateway rechazó el catálogo: ${detail}`
          : 'El plugin nativo de Micelclaw no está registrado en Gateway. /reset todavía no lo solucionará.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo diagnosticar el runtime');
    }
  };

  const presets = useMemo(() => PRESET_META.map((p) => {
    if (p.value === 'inherit') return { ...p, desc: 'Use global defaults from Settings' };
    if (p.value === 'custom') return { ...p, desc: 'Per-agent allow/deny overrides' };
    const nativeCount = catalog.nativePresets[p.value]?.length ?? 0;
    const wbCount = catalog.workboardEnabled ? (catalog.profileTools[p.value]?.tools.length ?? 0) : 0;
    const desc = wbCount > 0
      ? `${nativeCount} native tools + ${wbCount} workboard tools`
      : `${nativeCount} native tools`;
    return { ...p, desc };
  }), [catalog.nativePresets, catalog.profileTools, catalog.workboardEnabled]);

  // Filtro por nombre/descripcion (case-insensitive). Con filtro activo, los
  // grupos sin coincidencias se ocultan y los demas se expanden.
  const q = filter.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!q) return catalog.nativeGroups;
    return catalog.nativeGroups
      .map(g => ({ ...g, tools: g.tools.filter(t => t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)) }))
      .filter(g => g.tools.length > 0);
  }, [q, catalog.nativeGroups]);

  const filteredWorkboardGroups = useMemo(() => {
    if (!catalog.workboardEnabled) return [];
    if (!q) return catalog.workboardGroups;
    return catalog.workboardGroups
      .map(g => ({ ...g, tools: g.tools.filter(t => t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)) }))
      .filter(g => g.tools.length > 0);
  }, [q, catalog.workboardGroups, catalog.workboardEnabled]);

  // El bloque bundle-mcp (claw_*) también respeta el filtro: chips por nombre,
  // y el bloque entero se oculta si nada coincide.
  const labelMatchesMcp = !q || 'bundle-mcp micelclaw os claw'.includes(q);
  const shownMcpTools = q ? mcpTools.filter(t => t.name.toLowerCase().includes(q)) : mcpTools;
  const showMcpBlock = mcpTools.length > 0 && (!q || labelMatchesMcp || shownMcpTools.length > 0);
  // Agrupar las tools claw_* por DOMINIO/módulo y marcar activas según las apps
  // asignadas (unificación 2026-07-12): vista READ-ONLY, sin toggle bundle-mcp.
  const mcpByDomain = (() => {
    const m = new Map<string, { label: string; tools: typeof mcpTools }>();
    for (const t of shownMcpTools) {
      const g = m.get(t.domain) ?? { label: (t.label || t.domain).split(' · ')[0] ?? t.domain, tools: [] as typeof mcpTools };
      g.tools.push(t); m.set(t.domain, g);
    }
    return [...m.entries()]
      .map(([domain, g]) => ({ domain, label: g.label, tools: g.tools, active: activeFacadeDomains.has(domain) }))
      .sort((a, b) => (a.active === b.active ? a.label.localeCompare(b.label) : a.active ? -1 : 1));
  })();

  if (loading || catalog.loading) {
    return <div style={{ padding: 16, color: 'var(--text-dim)', fontSize: '0.8125rem' }}>Loading tool access...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            Tool Access
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {enabledCount}/{catalog.allNativeTools.length} enabled
            {dirty && <span style={{ color: 'var(--warning)', marginLeft: 8 }}>unsaved</span>}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {dirty && (
            <button
              onClick={() => fetchConfig()}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', fontSize: '0.75rem', fontWeight: 500,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              <RotateCcw size={12} /> Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600,
              background: justSaved ? 'var(--success)' : dirty ? 'var(--error)' : 'var(--surface)',
              border: '1px solid transparent',
              borderRadius: 'var(--radius-sm)',
              color: justSaved || dirty ? '#fff' : 'var(--text-muted)',
              cursor: dirty ? 'pointer' : 'default',
              opacity: saving ? 0.7 : 1,
              fontFamily: 'var(--font-sans)',
              transition: 'background 0.2s',
            }}
          >
            {justSaved ? <><Check size={12} /> Guardado</> : <><Save size={12} /> Save</>}
          </button>
        </div>
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {presets.map(p => (
          <button
            key={p.value}
            onClick={() => handleProfileSelect(p.value)}
            title={p.desc}
            style={{
              padding: '4px 10px', fontSize: '0.6875rem', fontWeight: 500,
              background: activeProfile === p.value ? 'var(--surface-hover)' : 'transparent',
              border: activeProfile === p.value ? '1px solid var(--amber)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              color: activeProfile === p.value ? 'var(--amber)' : 'var(--text-dim)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Profile info */}
      {activeProfile === 'inherit' && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          Using global defaults ({globalProfile ?? 'coding'} profile). Configure in Settings &rarr; Tool Access Defaults.
        </div>
      )}
      {activeProfile === 'custom' && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          Custom per-agent configuration. Toggle individual tools below.
        </div>
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
              Micelclaw System
            </h4>
            <div style={{ marginTop: 3, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              Capacidades nativas del sistema · catálogo v{catalog.catalogVersion}
            </div>
          </div>
          <select value={accessMode} onChange={(event) => void changeAccessMode(event.target.value as 'standard' | 'restricted')} style={{ padding: '5px 7px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.6875rem' }}>
            <option value="standard">Standard · owner data</option>
            <option value="restricted">Restricted · assigned apps</option>
          </select>
          <button onClick={diagnoseRuntime} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.6875rem' }}>
            <Stethoscope size={12} /> Diagnose runtime
          </button>
        </div>
        {catalog.capabilitySnapshotStale && (
          <div style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: '#f59e0b16', color: 'var(--warning)', fontSize: '0.6875rem' }}>
            La sesión abierta puede tener un snapshot anterior. El diagnóstico indica si basta con /reset.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {catalog.systemGroups.map((group) => (
            <div key={group.id}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 5 }}>{group.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {group.tools.map((tool) => {
                  const state = effectiveByName.get(tool.name);
                  const label = !state?.available ? 'NO DISPONIBLE · PLUGIN' : !state.effective ? 'BLOQUEADA · PERFIL' : state.runtime_loaded ? 'ACTIVA · RUNTIME' : 'ACTIVA · SESIÓN NUEVA';
                  const active = state?.effective ?? false;
                  return (
                    <span key={tool.name} title={state?.reason ?? tool.description} style={{ padding: '4px 7px', borderRadius: 'var(--radius-sm)', border: `1px solid ${active ? '#22c55e30' : 'var(--border)'}`, background: active ? '#22c55e12' : 'transparent', color: active ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>
                      {tool.name} · {label}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
        <h4 style={{ margin: 0, fontSize: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Direct MCP Connections</h4>
        <p style={{ margin: '5px 0 10px', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          Grants personales o compartidos del agente. Asignar una app no concede una conexión MCP.
        </p>
        <Link to={catalog.mcpConnectionsLink} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--amber)', fontSize: '0.75rem', textDecoration: 'none' }}>
          Configure MCP connections <ExternalLink size={11} />
        </Link>
      </div>

      {/* Búsqueda/filtro por nombre de herramienta */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={13} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filtrar herramientas por nombre…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '7px 30px', fontSize: '0.75rem',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
            fontFamily: 'var(--font-sans)', outline: 'none',
          }}
        />
        {filter && (
          <button
            onClick={() => setFilter('')}
            title="Limpiar"
            style={{
              position: 'absolute', right: 6, display: 'flex', alignItems: 'center',
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 4,
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Tool groups — only show toggles for custom or when viewing a preset */}
      {filteredGroups.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 2px' }}>
          Ninguna herramienta coincide con «{filter}».
        </div>
      )}
      {filteredGroups.map(group => {
        const groupTotal = group.tools.length;
        const groupEnabled = group.tools.filter(t => isToolEnabled(t.name)).length;
        // Con filtro activo siempre expandido; si no, respeta el colapso manual.
        const isCollapsed = !q && collapsed.has(group.label);
        return (
        <div key={group.label}>
          <button
            onClick={() => !q && toggleGroup(group.label)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%',
              margin: '0 0 8px', padding: 0, background: 'transparent', border: 'none',
              cursor: q ? 'default' : 'pointer', textAlign: 'left',
            }}
          >
            {!q && (isCollapsed
              ? <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
              : <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />)}
            <h4 style={{
              fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)',
              margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {group.label}
            </h4>
            <span style={{
              fontSize: '0.625rem', fontWeight: 600, fontFamily: 'var(--font-mono)',
              color: groupEnabled > 0 ? 'var(--success)' : 'var(--text-muted)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-full)', padding: '1px 7px',
            }}>
              {groupEnabled}/{groupTotal}
            </span>
          </button>
          {!isCollapsed && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 6,
          }}>
            {group.tools.map(tool => {
              const enabled = isToolEnabled(tool.name);
              const isCustomMode = activeProfile === 'custom';
              return (
                <div
                  key={tool.name}
                  onClick={() => handleToolToggle(tool.name)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: isCustomMode || activeProfile !== 'inherit' ? 'pointer' : 'pointer',
                    transition: 'var(--transition-fast)',
                    opacity: activeProfile === 'inherit' ? 0.6 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>
                      {tool.name}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      {tool.desc}
                    </div>
                  </div>
                  <div style={{
                    width: 32, height: 18, borderRadius: 9,
                    background: enabled ? 'var(--success, #22c55e)' : 'var(--text-muted)',
                    position: 'relative', flexShrink: 0, marginLeft: 8,
                    transition: 'background 0.2s',
                  }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: '#fff', position: 'absolute', top: 2,
                      left: enabled ? 16 : 2, transition: 'left 0.2s',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
        );
      })}

      {/* Workboard (plugin de primera clase): tools toggleables como las nativas — a
          diferencia del bloque claw_* de abajo, que sigue read-only por-app. Solo se
          renderiza si el plugin está habilitado en el Gateway. */}
      {catalog.workboardEnabled && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <h4 style={{
              fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)',
              margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Workboard
            </h4>
            <span style={{
              fontSize: '0.625rem', fontWeight: 600, fontFamily: 'var(--font-mono)',
              color: workboardEnabledCount > 0 ? 'var(--success)' : 'var(--text-muted)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-full)', padding: '1px 7px',
            }}>
              {workboardEnabledCount}/{catalog.allWorkboardTools.length}
            </span>
          </div>
          <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.5 }}>
            Coordinación de tareas entre agentes (tablero Por reclamar/En curso/Hecho). Toggleables por tool,
            igual que las nativas — a diferencia del bloque de abajo (lo concede la app asignada).
          </p>
          {filteredWorkboardGroups.length === 0 && q && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 2px' }}>
              Ninguna herramienta de Workboard coincide con «{filter}».
            </div>
          )}
          {filteredWorkboardGroups.map(group => {
            const groupKey = `wb:${group.key}`;
            const groupTotal = group.tools.length;
            const groupEnabled = group.tools.filter(t => isWorkboardToolEnabled(t.name)).length;
            const isCollapsed = !q && collapsed.has(groupKey);
            return (
            <div key={groupKey} style={{ marginBottom: 8 }}>
              <button
                onClick={() => !q && toggleGroup(groupKey)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  margin: '0 0 8px', padding: 0, background: 'transparent', border: 'none',
                  cursor: q ? 'default' : 'pointer', textAlign: 'left',
                }}
              >
                {!q && (isCollapsed
                  ? <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                  : <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />)}
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-dim)',
                }}>
                  {group.label}
                </span>
                <span style={{
                  fontSize: '0.5625rem', fontWeight: 600, fontFamily: 'var(--font-mono)',
                  color: groupEnabled > 0 ? 'var(--success)' : 'var(--text-muted)',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-full)', padding: '1px 6px',
                }}>
                  {groupEnabled}/{groupTotal}
                </span>
              </button>
              {!isCollapsed && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 6,
              }}>
                {group.tools.map(tool => {
                  const enabled = isWorkboardToolEnabled(tool.name);
                  return (
                    <div
                      key={tool.name}
                      onClick={() => handleWorkboardToggle(tool.name)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>
                          {tool.name}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {tool.desc}
                        </div>
                      </div>
                      <div style={{
                        width: 32, height: 18, borderRadius: 9,
                        background: enabled ? 'var(--success, #22c55e)' : 'var(--text-muted)',
                        position: 'relative', flexShrink: 0, marginLeft: 8,
                        transition: 'background 0.2s',
                      }}>
                        <div style={{
                          width: 14, height: 14, borderRadius: '50%',
                          background: '#fff', position: 'absolute', top: 2,
                          left: enabled ? 16 : 2, transition: 'left 0.2s',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* Tools de Micelclaw OS (claw_*) por APP asignada (unificación 2026-07-12).
          READ-ONLY: cada app concede sus tools; no hay toggle bundle-mcp. Las apps
          se asignan en Overview → Apps; ahí se concede visibilidad Y permiso de uso. */}
      {showMcpBlock && (
        <div>
          <h4 style={{
            fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)',
            margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            Micelclaw OS · tools por app
          </h4>
          <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.5 }}>
            Estas tools las concede la <b>app</b> correspondiente (asígnala en <b>Overview → Apps</b>).
            El agente solo lleva en su contexto las tools de sus apps asignadas — no se activan una a una aquí.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mcpByDomain.map(({ domain, label, tools, active }) => (
              <div key={domain} style={{
                padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', opacity: active ? 1 : 0.5,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: tools.length > 0 ? 6 : 0 }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>{label}</span>
                  <span style={{
                    fontSize: '0.5625rem', padding: '1px 6px', borderRadius: 'var(--radius-full)',
                    background: active ? 'var(--success-dim, #22c55e22)' : 'var(--surface-hover)',
                    color: active ? 'var(--success, #22c55e)' : 'var(--text-muted)', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.03em',
                  }}>
                    {active ? 'activa · app asignada' : 'no asignada'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {tools.map((t) => (
                    <span key={t.name} title={t.actions.join(', ')} style={{
                      fontSize: '0.625rem', padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-dim)',
                    }}>
                      {t.name} <span style={{ color: 'var(--text-muted)' }}>({t.actions.length})</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legacy shared adapters remain visible during the positive-grants migration. Toggling a server
          writes <server>__* to this agent's deny (independent of the native matrix
          and de las tools de app de Micelclaw). */}
      {externalMcp.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Legacy shared MCP adapters
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {externalMcp.map((srv) => {
              const visible = !mcpDeny.has(srv.name);
              return (
                <div key={srv.name} onClick={() => toggleMcpServer(srv.name)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>{srv.name}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      {srv.enabled ? 'Enabled globally' : 'Disabled globally'}
                    </div>
                  </div>
                  <div style={{
                    width: 32, height: 18, borderRadius: 9,
                    background: visible ? 'var(--success, #22c55e)' : 'var(--text-muted)',
                    position: 'relative', flexShrink: 0, marginLeft: 8, transition: 'background 0.2s',
                  }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: visible ? 16 : 2, transition: 'left 0.2s' }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            Off blocks every tool from that server for this agent (writes <code>&lt;server&gt;__*</code> to its deny).
            Compatibility only: new personal/shared connections use explicit grants in Settings → MCP Connections.
          </p>
        </div>
      )}
    </div>
  );
}
