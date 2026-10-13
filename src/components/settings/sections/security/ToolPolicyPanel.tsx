import type { ToolPresentationPayload } from '@/types/chat';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CircleAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { shouldRenderTool } from '@/config/tool-rendering';
import { useToolVisibility } from '@/hooks/use-tool-visibility';
import { useAuthStore } from '@/stores/auth.store';

type NativeProfile = 'minimal' | 'coding' | 'messaging' | 'full';
type Tool = { presentation?: Pick<ToolPresentationPayload, 'origin' | 'visibility'>; name: string; label: string; description: string; origin: string; group: string; parameters: Record<string, unknown>; profiles: NativeProfile[]; require_approval: boolean; approval_locked: boolean };
type AccessProfile = { id: string; name: string; base_profile: NativeProfile; also_allow: string[]; deny: string[] };
type Snapshot = { active_profile_id: string | null; active_native_profile: NativeProfile; native_catalog_source: 'gateway' | 'fallback'; profiles: AccessProfile[]; catalog: Tool[] };

const nativeProfiles: Array<{ id: `native:${NativeProfile}`; label: string }> = [
  { id: 'native:minimal', label: 'OpenClaw · Minimal' }, { id: 'native:coding', label: 'OpenClaw · Coding' },
  { id: 'native:messaging', label: 'OpenClaw · Messaging' }, { id: 'native:full', label: 'OpenClaw · Full' },
];
function sourceIcon(origin: string): string { return origin === 'openclaw_native' ? '◫' : origin === 'external_mcp' ? '↗' : origin === 'openclaw_plugin' ? '🧩' : origin === 'unknown' ? '?' : origin === 'micelclaw_system' ? '◆' : '✦'; }
function title(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }

const positiveStatus = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15';
const negativeStatus = 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15';
const disabledStatus = 'cursor-not-allowed opacity-60';

export function ToolPolicyPanel() {
  const role = useAuthStore((state) => state.user?.role);
  const canEdit = role === 'owner' || role === 'admin';
  const {
    visibility,
    visibilityProfiles,
    activeVisibilityProfileId,
    setPreset,
    selectVisibilityProfile,
    createVisibilityProfile,
    toggleTool,
  } = useToolVisibility();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const [selectedProfile, setSelectedProfile] = useState('');
  const [accessProfileName, setAccessProfileName] = useState('');
  const [visibilityProfileName, setVisibilityProfileName] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ data: Snapshot }>('/security/tool-policy');
      setSnapshot(response.data);
      setSelectedProfile(response.data.active_profile_id ?? `native:${response.data.active_native_profile}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo cargar la política de herramientas'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const tools = useMemo(() => (snapshot?.catalog ?? []).filter((tool) => `${tool.name} ${tool.description} ${tool.group}`.toLowerCase().includes(query.toLowerCase())), [snapshot, query]);
  const toolGroups = useMemo(() => {
    const groups = new Map<string, Tool[]>();
    for (const tool of tools) {
      const label = tool.group.trim() || 'Otras herramientas';
      groups.set(label, [...(groups.get(label) ?? []), tool]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tools]);
  const activeProfile = snapshot?.profiles.find((profile) => profile.id === selectedProfile) ?? snapshot?.profiles.find((profile) => profile.id === snapshot?.active_profile_id);

  const updateApproval = async (tool: Tool) => {
    if (!canEdit || tool.approval_locked) return;
    try {
      const response = await api.patch<{ data: { require_approval: boolean } }>(`/security/tool-policy/approvals/${encodeURIComponent(tool.name)}`, { require_approval: !tool.require_approval });
      setSnapshot((previous) => previous ? { ...previous, catalog: previous.catalog.map((item) => item.name === tool.name ? { ...item, require_approval: response.data.require_approval } : item) } : previous);
      toast.success(response.data.require_approval ? 'La herramienta pedirá aprobación' : 'La herramienta queda autorizada por la política');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo guardar la aprobación'); }
  };
  const activate = async () => {
    if (!selectedProfile || !canEdit) return;
    try {
      if (selectedProfile.startsWith('native:')) {
        const baseProfile = selectedProfile.slice('native:'.length) as NativeProfile;
        await api.post('/security/tool-policy/native-profile', { base_profile: baseProfile });
        setSnapshot((previous) => previous ? { ...previous, active_profile_id: null, active_native_profile: baseProfile } : previous);
      } else {
        await api.post(`/security/tool-policy/profiles/${selectedProfile}/activate`, {});
        setSnapshot((previous) => previous ? { ...previous, active_profile_id: selectedProfile } : previous);
      }
      toast.success('Perfil de acceso aplicado a OpenClaw');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo activar el perfil'); }
  };
  const createProfile = async () => {
    const name = accessProfileName.trim(); if (!name || !canEdit) return;
    try {
      const response = await api.post<{ data: AccessProfile }>('/security/tool-policy/profiles', { name, base_profile: 'coding', also_allow: [], deny: [] });
      setSnapshot((previous) => previous ? { ...previous, profiles: [...previous.profiles, response.data] } : previous);
      setSelectedProfile(response.data.id); setAccessProfileName('');
      toast.success('Perfil creado. Ajusta sus herramientas y actívalo cuando esté listo.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo crear el perfil'); }
  };
  const selectVisibility = (value: string) => {
    if (value.startsWith('preset:')) {
      setPreset(value.slice('preset:'.length) as typeof visibility.preset);
      return;
    }
    selectVisibilityProfile(value);
  };
  const createDisplayProfile = () => {
    const profile = createVisibilityProfile(visibilityProfileName);
    if (!profile) {
      toast.error('Escribe un nombre para el perfil de visualización');
      return;
    }
    setVisibilityProfileName('');
    toast.success(`Perfil de visualización “${profile.name}” creado en este navegador`);
  };
  const toggleAccess = async (tool: Tool) => {
    if (!canEdit || !activeProfile) return;
    const baseHas = tool.profiles.includes(activeProfile.base_profile);
    const allow = new Set(activeProfile.also_allow ?? []); const deny = new Set(activeProfile.deny ?? []);
    const enabled = !deny.has(tool.name) && (allow.has(tool.name) || baseHas);
    if (enabled) { allow.delete(tool.name); if (baseHas) deny.add(tool.name); } else { deny.delete(tool.name); if (!baseHas) allow.add(tool.name); }
    try {
      const response = await api.patch<{ data: AccessProfile }>(`/security/tool-policy/profiles/${activeProfile.id}`, { also_allow: [...allow].sort(), deny: [...deny].sort() });
      setSnapshot((previous) => previous ? { ...previous, profiles: previous.profiles.map((profile) => profile.id === response.data.id ? response.data : profile) } : previous);
      toast.success(snapshot?.active_profile_id === activeProfile.id ? 'Cambio aplicado al perfil activo' : 'Cambio guardado en el perfil seleccionado');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el acceso'); }
  };
  const setToolVisibility = (tool: Tool) => toggleTool(tool.name, !shouldRenderTool(tool.name, visibility, tool.presentation));
  const toggleGroup = (group: string) => setOpenGroups((previous) => {
    const next = new Set(previous);
    if (next.has(group)) next.delete(group); else next.add(group);
    return next;
  });

  if (loading && !snapshot) return <p className="text-sm text-[var(--text-dim)]">Cargando catálogo de herramientas…</p>;
  if (!snapshot) return <p className="flex items-center gap-2 text-sm text-[var(--danger)]"><CircleAlert size={16} />No se pudo cargar el catálogo.</p>;
  return <div className="space-y-4">
    <header><h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-[var(--text)]"><ShieldCheck size={19} className="text-[var(--amber)]" />Tools & approvals</h2><p className="mt-1 max-w-3xl text-sm text-[var(--text-dim)]">El acceso se compila a OpenClaw; la visibilidad del chat es una preferencia personal de este dispositivo; las aprobaciones son una política global de seguridad.</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">Catálogo nativo: {snapshot.native_catalog_source === 'gateway' ? 'Gateway en vivo' : 'inventario local de compatibilidad (Gateway no disponible)'}. Apps y MCP se leen desde Core.</p></header>
    <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-end gap-3 border-b border-[var(--border)] pb-3">
        <label className="text-xs text-[var(--text-dim)]">Perfil de acceso a tools<select value={selectedProfile} onChange={(event) => setSelectedProfile(event.target.value)} className="ml-2 rounded border border-[var(--border)] bg-[var(--card)] p-1.5 text-[var(--text)]">{nativeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}{snapshot.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · base {title(profile.base_profile)}</option>)}</select></label>
        <button type="button" disabled={!canEdit} onClick={() => void activate()} className="rounded border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text)] disabled:opacity-50">Aplicar acceso</button>
        {canEdit && <><input value={accessProfileName} onChange={(event) => setAccessProfileName(event.target.value)} placeholder="Nombre del perfil de acceso" className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs text-[var(--text)]" /><button type="button" onClick={() => void createProfile()} className="rounded border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text)]">+ Crear perfil de acceso</button></>}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-[var(--text-dim)]">Perfil de visualización en chat<select value={activeVisibilityProfileId ?? `preset:${visibility.preset}`} onChange={(event) => selectVisibility(event.target.value)} className="ml-2 rounded border border-[var(--border)] bg-[var(--card)] p-1.5 text-[var(--text)]"><option value="preset:minimal">Minimal</option><option value="preset:default">Default</option><option value="preset:verbose">Verbose</option><option value="preset:custom">Custom</option>{visibilityProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
        <input value={visibilityProfileName} onChange={(event) => setVisibilityProfileName(event.target.value)} placeholder="Nombre del perfil de visualización" className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs text-[var(--text)]" />
        <button type="button" onClick={createDisplayProfile} className="rounded border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text)]">+ Crear perfil de visualización</button>
        <span className="text-[11px] text-[var(--text-muted)]">Solo afecta a cómo ves las tools en este navegador.</span>
      </div>
    </div>
    {!activeProfile && <p className="rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-xs text-[var(--text-dim)]">Los perfiles nativos de OpenClaw son inmutables. Crea un perfil nombrado para añadir o retirar herramientas.</p>}
    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar herramienta…" className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]" />
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]"><table className="w-full min-w-[870px] text-left text-sm"><thead className="bg-[var(--surface)] text-xs text-[var(--text-dim)]"><tr><th className="p-3">Nombre</th><th>Acceso por perfil</th><th>Mostrar en chat</th><th>Aprobación</th></tr></thead><tbody>{toolGroups.map(([group, groupTools]) => {
      const groupOpen = query.trim().length > 0 || openGroups.has(group);
      const enabledCount = groupTools.filter((tool) => {
        const baseHas = activeProfile ? tool.profiles.includes(activeProfile.base_profile) : tool.profiles.includes(selectedProfile.replace('native:', '') as NativeProfile);
        return activeProfile ? !activeProfile.deny?.includes(tool.name) && (baseHas || activeProfile.also_allow?.includes(tool.name)) : baseHas;
      }).length;
      return <Fragment key={group}><tr className="border-t border-[var(--border)] bg-[var(--surface)]"><td colSpan={4} className="p-0"><button type="button" onClick={() => toggleGroup(group)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-[var(--text)] hover:bg-[var(--card)]"><ChevronDown size={15} className={groupOpen ? '' : '-rotate-90'} /><span>{title(group)}</span><span className="rounded-full bg-[var(--card)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--text-muted)]">{groupTools.length}</span><span className="text-[10px] font-normal text-[var(--text-muted)]">{enabledCount} activas en el perfil</span></button></td></tr>{groupOpen && groupTools.map((tool) => {
      const baseHas = activeProfile ? tool.profiles.includes(activeProfile.base_profile) : tool.profiles.includes(selectedProfile.replace('native:', '') as NativeProfile);
      const enabled = activeProfile ? !activeProfile.deny?.includes(tool.name) && (baseHas || activeProfile.also_allow?.includes(tool.name)) : baseHas;
      const shown = shouldRenderTool(tool.name, visibility, tool.presentation);
      const profileLabel = enabled ? (baseHas ? 'Heredada' : 'Añadida') : 'Retirada';
      return <Fragment key={tool.name}><tr className="border-t border-[var(--border)]"><td className="p-3"><button type="button" onClick={() => setOpen(open === tool.name ? null : tool.name)} className="flex items-center gap-2 text-left text-[var(--text)]"><ChevronRight size={14} className={open === tool.name ? 'rotate-90' : ''} /><span aria-hidden>{sourceIcon(tool.presentation?.origin ?? tool.origin)}</span><span className="font-mono">{tool.name}</span></button><span className="ml-10 text-xs text-[var(--text-muted)]">{tool.description}</span></td><td><button type="button" disabled={!canEdit || !activeProfile} onClick={() => void toggleAccess(tool)} className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${enabled ? positiveStatus : negativeStatus}`}>{profileLabel}</button></td><td><button type="button" onClick={() => setToolVisibility(tool)} className={`rounded border px-2 py-1 text-xs ${shown ? positiveStatus : negativeStatus}`}>{shown ? 'Visible' : 'Oculta'}</button></td><td><button type="button" disabled={!canEdit || tool.approval_locked} onClick={() => void updateApproval(tool)} className={`rounded border px-2 py-1 text-xs ${tool.approval_locked ? `${positiveStatus} ${disabledStatus}` : tool.require_approval ? positiveStatus : negativeStatus}`}>{tool.approval_locked ? 'Exec · política separada' : tool.require_approval ? 'Sí' : 'No'}</button></td></tr>{open === tool.name && <tr className="border-t border-[var(--border)] bg-[var(--surface)]"><td colSpan={4} className="p-3 text-xs text-[var(--text-dim)]"><strong>Parámetros y capacidades</strong><p className="mt-1">Fuente: {tool.presentation?.origin ?? tool.origin} · grupo {tool.group}</p><pre className="mt-2 max-h-56 overflow-auto rounded bg-[var(--card)] p-2 text-[11px]">{JSON.stringify(tool.parameters, null, 2)}</pre></td></tr>}</Fragment>;
    })}</Fragment>})}</tbody></table></div>
  </div>;
}
