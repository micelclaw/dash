/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, AlertTriangle, X, Puzzle, Plus, LayoutGrid, List, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useAppsStore } from '@/stores/apps.store';
import { AppCard } from './AppCard';
import { AppListRow, AppListHeader } from './AppListRow';
import { AppDetail, ForkNameDialog } from './AppDetail';
import type { AppPrimaryAction, CatalogView } from './AppCatalogPresentation';
import { appOrigin, registryApp, matchesCatalog, ORIGIN_FILTERS } from './catalog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { importRegistryPackage, type PublicRegistryPackage } from '@/services/public-registry.service';
import { officeColor } from '@/config/office-colors';
import { AppEditor } from './AppEditor';
import { AssignAppsModal as SharedAssignAppsModal } from '@/components/shared/AssignAppsModal';
import { AppIcon } from '@/components/shared/AppIcon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMediaQuery } from '@/hooks/use-media-query';
import { RegistryBrowser } from './RegistryBrowser';
import { useRegistryStore } from '@/stores/registry.store';
import { PluginsBrowser } from './PluginsBrowser';
import { WorkshopTab } from './WorkshopTab';
import { useAuthStore } from '@/stores/auth.store';
import { useSearchParams } from 'react-router';
import { api } from '@/services/api';
import * as gwService from '@/services/gateway.service';
import { getInstalledApps, getAppStorage, suggestForkName, forkApp } from '@/services/apps.service';
import type { InstalledApp } from '@/types/apps';
import { useI18n } from '@/i18n';

// Claves internas (se conservan por compat). Etiquetas: 'available'→"Instaladas"
// (apps activas), 'disponibles'→"Disponibles" (en el sistema, no activas), 'installed'
// →"Asignadas" (a agentes), 'registry'→"Registro". Adaptadas se editan en Taller.
type Tab = 'available' | 'disponibles' | 'installed' | 'registry' | 'plugins' | 'workshop';

// Origin tag colors (quién hizo la app). Micelclaw = cian (oficial), OpenClaw = granate
// (de serie), Community = slate (comunidad y aplicaciones propias).
const ORIGIN_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Micelclaw: { bg: '#06b6d412', border: '#06b6d430', text: '#06b6d4' },
  OpenClaw:  { bg: '#9f123912', border: '#9f123930', text: '#9f1239' },
  Community: { bg: '#64748b12', border: '#64748b30', text: '#64748b' },
};

// Level tag colors
const LEVEL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  L1: { bg: '#64748b18', border: '#64748b40', text: 'var(--text-dim)' },
  L2: { bg: '#3b82f618', border: '#3b82f640', text: '#3b82f6' },
  L3: { bg: '#a855f718', border: '#a855f740', text: '#a855f7' },
};

// Tier (plan) tag colors — orden Free · Pro · Plus.
const TIER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Free:    { bg: '#22c55e12', border: '#22c55e30', text: '#22c55e' },
  Pro:     { bg: '#d4a01712', border: '#d4a01730', text: 'var(--amber)' },
  Plus:    { bg: '#3b82f612', border: '#3b82f630', text: '#3b82f6' },
};

// Distintivos (sellos de Micelclaw): Verified (revisada) · Featured (destacada).
const DISTINTIVO_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Verified: { bg: '#22c55e12', border: '#22c55e30', text: '#22c55e' },
  Featured: { bg: '#f59e0b12', border: '#f59e0b30', text: '#f59e0b' },
};

function TagButton({ label, active, colors, onClick }: {
  label: string;
  active: boolean;
  colors: { bg: string; border: string; text: string };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '3px 10px',
        fontSize: '0.6875rem',
        fontWeight: active ? 600 : 400,
        background: active ? colors.bg : 'transparent',
        border: `1px solid ${active ? colors.border : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        color: active ? colors.text : 'var(--text-muted)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        transition: 'var(--transition-fast)',
      }}
    >
      {label}
    </button>
  );
}

export function Component() {
  const { t: tr } = useI18n();
  const {
    error, restartRequired, clearRestart,
  } = useAppsStore();

  const [tab, setTab] = useState<Tab>('registry');
  const userRole = useAuthStore((s) => s.user?.role);
  const isAdmin = userRole === 'admin' || userRole === 'owner';
  const principal = useAuthStore((s) => `${s.user?.id??''}:${s.sessionGeneration}:${s.user?.role??''}`);
  const [searchParams] = useSearchParams();
  const focusPlugin = searchParams.get('focus') ?? undefined;
  // Deep-link support: /micelhub?tab=plugins&focus=acpx (from Studio Engines).
  useEffect(() => {
    if (searchParams.get('tab') === 'plugins' && isAdmin) setTab('plugins');
    if (searchParams.get('tab') === 'workshop') setTab('workshop');
    if (searchParams.get('tab') === 'adapted') setTab('workshop');
  }, [searchParams, isAdmin]);
  const [search, setSearch] = useState('');
  const [exactResult, setExactResult] = useState<{name:string;version:string}|null>(null);
  const [storage, setStorage] = useState<Record<string,number|null>>({});
  const [pendingUninstall, setPendingUninstall] = useState<InstalledApp|null>(null);
  const [forkSource, setForkSource] = useState<InstalledApp|null>(null);
  const [forkName, setForkName] = useState('');
  const registry = useRegistryStore();
  const registryOwned = registry.owner === principal;
  const localPackages = registryOwned ? registry.local : [];
  const publicEntries = registryOwned ? registry.catalog : [];
  const [selectedApp, setSelectedApp] = useState<InstalledApp | null>(null);
  const [editingApp, setEditingApp] = useState<InstalledApp | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Clickable tag filters — 4 grupos: Origen · Nivel · Plan · Distintivos.
  const [originFilters, setOriginFilters] = useState<Set<string>>(new Set(ORIGIN_FILTERS));
  const [levelFilters, setLevelFilters] = useState<Set<string>>(new Set(['L1', 'L2', 'L3']));
  const [tierFilters, setTierFilters] = useState<Set<string>>(new Set(['Free', 'Pro', 'Plus']));
  // Distintivos: inicialmente sin restricción; cada botón reduce los resultados.
  const [distintivoFilters, setDistintivoFilters] = useState<Set<string>>(new Set());
  // Modo de visualización del grid de apps (Installed/Adapted): cuadrícula de tarjetas o lista
  // por columnas. Persistido en localStorage (patrón de Flows view-mode).
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try { return localStorage.getItem('micelhub-view') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
  });
  const changeViewMode = (m: 'grid' | 'list') => {
    setViewMode(m);
    try { localStorage.setItem('micelhub-view', m); } catch { /* ignore */ }
  };

  // Available tab: merged MicelclawOS skills + OpenClaw bundled skills
  const [availableApps, setAvailableApps] = useState<InstalledApp[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  // Apps del registry que están INSTALADAS (p.ej. n8n) → se muestran como tarjetas normales
  // en la pestaña "Installed". La asignación a agentes la maneja AssignAppsModal vía
  // GET /managed-agents/available-skills (que ya las incluye desde F2), no esta página.
  const registryApps = registryOwned ? registry.installed.filter(app => app.source === 'registry') : [];
  useEffect(() => {
    setSelectedApp(null);
    setEditingApp(null);
    setAvailableApps([]);
    setStorage({}); setExactResult(null); setPendingUninstall(null); setForkSource(null);
  }, [principal]);

  // Installed tab: agents with their skills
  const [agentsWithSkills, setAgentsWithSkills] = useState<Array<{
    id: string; name: string; display_name: string; avatar: string | null;
    skills: Array<{ id: string; name: string; icon: string; icon_kind?: 'emoji' | 'lucide'; color?: string }>;
  }>>([]);
  const [installedLoading, setInstalledLoading] = useState(false);

  const toggleFilter = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    setExactResult(null);
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  // Fetch available apps: SINGLE SOURCE via skills.status RPC
  const fetchAvailable = useCallback(async () => {
    const actor = principal;
    const current = () => `${useAuthStore.getState().user?.id??''}:${useAuthStore.getState().sessionGeneration}:${useAuthStore.getState().user?.role??''}` === actor;
    setAvailableLoading(true);
    try {
      const skills = await gwService.getSkillsStatus().catch(() => []);
      if (!current()) return;
      // Apps L1 deshabilitadas (store Core, GET /apps/skill-state): skills.status no conoce ese
      // estado (las L1 no están en installed_apps) → lo mergeamos para que la tarjeta muestre el
      // toggle Enable/Disable correcto.
      const disabledApps = isAdmin ? await api.get<{ data: { disabled: string[] } }>('/apps/skill-state')
        .then((r) => new Set(r.data?.disabled ?? []))
        .catch(() => new Set<string>()) : new Set<string>();
      if (!current()) return;

      // Las apps con backend (L2/L3) viven en installed_apps con su nivel/autor/estado REALES
      // (p.ej. una app salida de Studio: L3, author='studio', status active/available). skills.status solo ve la
      // SKILL.md materializada y sintetiza un nivel/origen heurístico (L1·Micelclaw) que MIENTE.
      // Indexamos TODAS las filas de DB por nombre (cualquier source: studio/local/registry/adapted)
      // para corregir nivel+autor+estado de la tarjeta (cero tarjetas nuevas: solo enriquece).
      const installedByName = isAdmin ? await getInstalledApps({})
        .then((r) => new Map((r.data ?? []).map((a) => [a.app_name, a])))
        .catch(() => new Map<string, InstalledApp>()) : new Map<string, InstalledApp>();
      if (!current()) return;

      // Convert skills.status data to InstalledApp shape for unified rendering
      const seenNames = new Set<string>();
      const allApps: InstalledApp[] = skills.filter((s) => {
        // Dedup defensivo por nombre (dos SKILL.md con el mismo `name` → una tarjeta).
        if (seenNames.has(s.name)) return false;
        seenNames.add(s.name);
        return true;
      }).map((s) => {
        // Determine origin: openclaw-extra = Micelclaw, openclaw-bundled = OpenClaw
        const synthSource = s.source === 'openclaw-extra' ? 'micelhub' as const
          : s.source === 'openclaw-bundled' ? 'openclaw' as const
          : 'local' as const;

        // DISPLAY unificado (Fase E): el backend resuelve nombre/icono en `s.display`;
        // ES la fuente correcta (por encima de los crudos `s.name`/`s.emoji`).
        const displayName = s.display?.name ?? s.name;
        const displayIcon = s.display?.icon ?? s.emoji ?? '🔧';
        const displayIconKind = s.display?.icon_kind ?? 'emoji';
        const displayColor = s.display?.color;

        // Determine app state for UI
        const hasOsIssue = (s.missing?.os?.length ?? 0) > 0;
        const needsEnvOrConfig = !s.eligible && (s.missing?.env?.length ?? 0) + (s.missing?.config?.length ?? 0) > 0 && (s.install?.length ?? 0) === 0;

        // ¿Hay app instalada (DB) homónima? → nivel/autor/source/estado REALES ganan al heurístico.
        const dbApp = installedByName.get(s.name);
        const dbManifest = (dbApp?.manifest ?? undefined) as Record<string, unknown> | undefined;
        const dbAuthor = typeof dbManifest?.author === 'string' ? (dbManifest.author as string) : undefined;
        const source = (dbApp?.source as typeof synthSource) ?? synthSource;
        const author = dbAuthor ?? (synthSource === 'micelhub' ? 'Micelclaw' : synthSource === 'openclaw' ? 'OpenClaw' : 'Community');

        // Estado unificado: 'active' = Instalada; 'available' = Disponible (en el sistema,
        // no activa). Para apps L1 (skills.status), off/no-elegible = 'available'.
        const status: 'active' | 'available' = dbApp
          ? (dbApp.status === 'active' ? 'active' : 'available')
          : ((disabledApps.has(s.name) || !s.eligible) ? 'available' : 'active');

        // Determine level: L1 = no external deps, L2 = has deps/install/external env/config
        const hasBins = (s.requirements?.bins?.length ?? 0) > 0 || (s.requirements?.any_bins?.length ?? 0) > 0;
        const hasExternalEnv = (s.requirements?.env ?? []).filter((e: string) => e !== 'CLAW_API_KEY' && e !== 'CLAW_CORE_TOKEN').length > 0;
        const hasConfig = (s.requirements?.config?.length ?? 0) > 0;
        const hasInstall = (s.install?.length ?? 0) > 0;
        const appLevel = dbApp?.app_level ?? ((hasBins || hasExternalEnv || hasConfig || hasInstall) ? 2 : 1);

        // Installed metadata owns identity/version/plan/tags and local editing.
        if (dbApp) return {
          ...dbApp,
          manifest: { ...dbApp.manifest, icon: dbApp.manifest.icon ?? displayIcon,
            icon_kind: dbApp.manifest.icon_kind ?? (dbApp.manifest.ui?.module?.icon ? 'lucide' : displayIconKind),
            ...(dbApp.manifest.ui?.module?.icon && !dbApp.manifest.icon ? {icon:dbApp.manifest.ui.module.icon} : {}),
            color: officeColor(dbApp.app_name) ?? dbApp.manifest.color ?? dbApp.manifest.ui?.module?.color ?? displayColor,
          },
        };
        return {
          id: `${source}-${s.skill_key ?? s.name}`,
          app_name: s.name,
          version: '0.0.0',
          app_level: appLevel,
          status,
          source,
          install_path: null,
          manifest: {
            name: displayName,
            version: '0.0.0',
            app_level: appLevel as 1 | 2 | 3,
            min_core_version: '0.0.0',
            skill: '',
            description: s.description || '',
            author,
            icon: displayIcon,
            icon_kind: displayIconKind,
            color: displayColor,
            tier_required: 'free' as const,
            permissions: [],
            tags: [
              // Status tags
              ...(s.eligible ? ['ready'] : []),
              ...((s.install?.length ?? 0) > 0 && !s.eligible && !hasOsIssue ? ['installable'] : []),
              ...(needsEnvOrConfig ? ['needs-setup'] : []),
              ...(hasOsIssue ? ['unsupported'] : []),
              // First-party / curated apps (built-in Micelclaw + OpenClaw
              // skills) are verified. Registry/community/Studio apps are NOT
              // (see fetchRegistryApps / RegistryBrowser) so the badge means
              // something instead of appearing on every card.
              'verified',
              'free',
            ],
          },
          forked_from: null,
          installed_by: null,
          installed_at: '',
          updated_at: '',
        } as InstalledApp;
      });

      // Apps de DB (L2/L3: studio/local) que NO están en skills.status — típicamente una app
      // DESINSTALADA (status='available'), cuya SKILL.md se desmaterializó → el Gateway ya no la
      // lista. Deben seguir apareciendo (en Disponibles) para poder reinstalarla. Las 'registry'
      // ya vienen por su propio fetch; las adaptadas conservan sus metadatos y estado.
      const extras: InstalledApp[] = [...installedByName.values()].filter(
        (a) => !seenNames.has(a.app_name) && a.source !== 'registry' && a.status !== 'archived',
      );

      setAvailableApps([...allApps, ...extras]);
    } catch { /* silent */ }
    finally { if(current())setAvailableLoading(false); }
  }, [isAdmin, principal]);

  // Fetch apps del registry que están INSTALADAS → tarjetas en "Installed", tratadas como
  // CUALQUIER otra app instalada. Fuente = installed_apps (GET /apps?source=registry) para que
  // el `status` sea el REAL (active/disabled) → el toggle Enable/Disable de la tarjeta queda
  // sincronizado (antes se hardcodeaba 'active' desde /apps/registry y se desincronizaba).
  const fetchRegistryApps = useCallback(async () => { await useRegistryStore.getState().refresh(); }, []);

  // Fetch agents with skills for Installed tab
  const fetchInstalled = useCallback(async () => {
    const actor = principal;
    setInstalledLoading(true);
    try {
      const res = await api.get<{ data: typeof agentsWithSkills }>('/managed-agents');
      if (`${useAuthStore.getState().user?.id??''}:${useAuthStore.getState().sessionGeneration}:${useAuthStore.getState().user?.role??''}` === actor) setAgentsWithSkills(res.data);
    } catch { /* silent */ }
    finally { setInstalledLoading(false); }
  }, [principal]);

  // Preload all data sources on mount for accurate tab counts
  useEffect(() => {
    fetchAvailable();
    fetchInstalled();
    fetchRegistryApps();
  }, [fetchAvailable, fetchInstalled, fetchRegistryApps]);

  useEffect(() => {
    if (tab === 'available' || tab === 'disponibles' || tab === 'workshop') void fetchAvailable();
    else if (tab === 'installed') void fetchInstalled();
  }, [tab, fetchAvailable, fetchInstalled]);

  // Assign/unassign skills to agents (Installed tab). La asignación la maneja
  // SharedAssignAppsModal; aquí solo el desasignar inline (handleUnassignSkill).
  const [assigningAgent, setAssigningAgent] = useState<string | null>(null);

  const handleUnassignSkill = async (agentId: string, skillId: string) => {
    const agent = agentsWithSkills.find(a => a.id === agentId);
    if (!agent) return;
    // Use skill_id (original skill ID), filter out the one to remove
    const currentSkills = agent.skills
      .map((s: Record<string, unknown>) => (s.skill_id ?? s.id) as string)
      .filter(id => id !== skillId);
    try {
      await api.patch(`/managed-agents/${agentId}/skills`, { skills: currentSkills });
      toast.success('App removed');
      fetchInstalled();
    } catch { toast.error('Failed to remove app'); }
  };

  const handleRefresh = useCallback(() => {
    void useRegistryStore.getState().refresh();
    if (tab === 'available' || tab === 'disponibles' || tab === 'workshop') { void fetchAvailable(); }
    else if (tab === 'installed') fetchInstalled();
  }, [tab, fetchAvailable, fetchInstalled]);

  const isCatalogTab = tab === 'available' || tab === 'disponibles' || tab === 'registry';
  const catalogView: CatalogView = tab === 'registry' ? 'registry' : tab === 'disponibles' ? 'available' : 'installed';
  const registryNames = new Set(registryApps.map(app => app.app_name));
  const knownApps = [...registryApps, ...availableApps.filter(app => !registryNames.has(app.app_name) && app.status !== 'archived')];
  const pendingPackages = localPackages.filter(local => !knownApps.some(app => app.app_name === local.name && app.version === local.version))
    .map(local => registryApp(local, publicEntries.find(entry => entry.name === local.name && entry.version === local.version)));
  const catalog = [...knownApps, ...pendingPackages].map(app => {
    // Exact-version catalogue distinctions describe editorial selection, never
    // local package integrity, installation success or functional acceptance.
    const editorial = publicEntries.find(entry => entry.name === app.app_name && entry.version === app.version)?.tags ?? [];
    return {...app, manifest:{...app.manifest,tags:[...new Set([...(app.manifest?.tags ?? []),...editorial])]}, installation_size_bytes:storage[app.app_name] ?? app.installation_size_bytes};
  });
  const installedList = catalog.filter(app => app.status === 'active');
  const disponiblesList = catalog.filter(app => app.status !== 'active');
  const publicApps = publicEntries.map(entry => registryApp(localPackages.find(local => local.name === entry.name && local.version === entry.version), entry));
  const currentApps = tab === 'registry' ? publicApps : tab === 'available' ? installedList : disponiblesList;
  const filters = {origins:originFilters, levels:levelFilters, tiers:tierFilters, distinctions:distintivoFilters};
  const filtered = currentApps.filter(app => matchesCatalog(app, search, filters, tab === 'disponibles' ? exactResult : null));
  const installedCount = installedList.length;
  const disponiblesCount = disponiblesList.length;
  const isLoading = isCatalogTab && (tab === 'registry' ? registry.loading && !publicApps.length : availableLoading && !catalog.length);
  const storageNames = [...new Set(knownApps.map(app => app.app_name))].sort().join(',');
  useEffect(() => {
    if (!isAdmin || !storageNames) return;
    let current = true;
    void getAppStorage(storageNames.split(',')).then(rows => { if (current) setStorage(Object.fromEntries(rows.map(row => [row.name, row.installation_size_bytes]))); }).catch(() => { /* Size remains explicitly unavailable on older Core. */ });
    return () => { current = false; };
  }, [storageNames, isAdmin, principal, registry.installed]);
  const shownApp = selectedApp && ((tab === 'registry' ? [...publicApps, ...catalog] : [...catalog, ...publicApps]).find(app => app.app_name === selectedApp.app_name && app.version === selectedApp.version) ?? selectedApp);

  const download = async (entry: PublicRegistryPackage) => {
    const actor = principal;
    try {
      const local = await registry.download(entry);
      if (!local || useRegistryStore.getState().owner !== actor) return;
      setOriginFilters(new Set(ORIGIN_FILTERS)); setLevelFilters(new Set(['L1','L2','L3']));
      setTierFilters(new Set(['Free','Pro','Plus'])); setDistintivoFilters(new Set());
      setSearch(entry.display_name); setExactResult({name:entry.name,version:entry.version});
      setSelectedApp(null); setTab('disponibles'); void fetchAvailable();
      toast.success(tr('micelhub.getAppSuccess',{name:entry.display_name}));
    } catch (cause) { toast.error(tr('micelhub.registryActionFailed'),{description:cause instanceof Error ? cause.message : String(cause)}); }
  };
  const primaryAction = (app: InstalledApp, view: CatalogView = catalogView): AppPrimaryAction => {
    const busy = registryOwned ? registry.busy[app.app_name] : undefined;
    const local = localPackages.find(row => row.name === app.app_name && row.version === app.version && row.claw_file);
    const entry = publicEntries.find(row => row.name === app.app_name && row.version === app.version);
    const active = installedList.find(row => row.app_name === app.app_name && row.version === app.version);
    const progress = registry.progress[app.app_name];
    if (view === 'registry') return {
      registryState: active ? 'installed' : local ? 'downloaded' : 'public',
      label: tr('micelhub.download'),
      disabled: !isAdmin || !!active || !!local || !entry || !!busy, busy: busy === 'downloading',
      title: !isAdmin ? tr('micelhub.registryAdminRequired') : undefined,
      statusText: busy === 'downloading' ? tr(progress?.phase === 'checking' ? 'micelhub.registryChecking' : 'micelhub.registryDownloading') : active ? tr('micelhub.appInstalled') : local ? tr('micelhub.appDownloaded') : undefined,
      progress: progress?.phase === 'downloading' && progress.total_bytes > 0 ? Math.min(100, progress.received_bytes / progress.total_bytes * 100) : null,
      error: registry.errors[app.app_name], onClick: () => { if (entry) void download(entry); },
    };
    return { busy: !!busy, disabled: !isAdmin || !!busy || !!registry.installed_error,
      title: !isAdmin ? tr('micelhub.registryAdminRequired') : undefined,
      statusText: busy ? tr(busy === 'removing' ? 'micelhub.registryRemoving' : 'micelhub.registryInstalling') : undefined,
      onClick: async () => {
        if (view === 'installed') { setPendingUninstall(app); return; }
        try {
          if (local && app.source === 'registry') await registry.install(local); else await registry.activate(app);
          if (useRegistryStore.getState().owner !== principal) return;
          setSelectedApp(null); handleRefresh(); toast.success(tr('micelhub.installedSuccess'));
        } catch (cause) { toast.error(tr('micelhub.installFailed'), {description:cause instanceof Error ? cause.message : String(cause)}); }
      },
    };
  };
  const confirmUninstall = async () => {
    if (!pendingUninstall) return;
    const app = pendingUninstall;
    try {
      const local = localPackages.some(row => row.name === app.app_name && row.version === app.version && row.claw_file);
      await registry.deactivate(app, app.source === 'registry' && local);
      if (useRegistryStore.getState().owner !== principal) return;
      setPendingUninstall(null); setSelectedApp(null); handleRefresh(); toast.success(tr('micelhub.uninstalledSuccess'));
    } catch (cause) { toast.error(tr('micelhub.registryActionFailed'),{description:cause instanceof Error ? cause.message : String(cause)}); }
  };
  const importFile = () => {
    const input = document.createElement('input'); input.type='file'; input.accept='.claw';
    input.onchange = async () => { const file=input.files?.[0]; if(!file)return;
      try { await importRegistryPackage(file); await registry.refresh(); } catch(cause){toast.error(tr('micelhub.registryActionFailed'),{description:cause instanceof Error?cause.message:String(cause)});} };
    input.click();
  };
  const startCopy = async (app: InstalledApp) => {
    try { setForkName(await suggestForkName(app.app_name)); setForkSource(app); }
    catch(cause){toast.error(tr('micelhub.registryActionFailed'),{description:cause instanceof Error?cause.message:String(cause)});}
  };
  const createCopy = async (name:string) => {
    if (!forkSource) return;
    try { await forkApp(forkSource.app_name,name); setForkSource(null); await fetchAvailable(); toast.success(tr('micelhub.copiedSuccess')); }
    catch(cause){toast.error(tr('micelhub.registryActionFailed'),{description:cause instanceof Error?cause.message:String(cause)});}
  };

  const dialogs = <>
    <ConfirmDialog open={!!pendingUninstall} title={tr('micelhub.uninstallAppTitle',{name:pendingUninstall?.manifest?.name??pendingUninstall?.app_name??''})}
      description={tr('micelhub.uninstallKeepData')} confirmLabel={tr('micelhub.uninstall')} variant="warning" closeOnConfirm={false}
      pending={!!(pendingUninstall&&registry.busy[pendingUninstall.app_name])} onClose={()=>setPendingUninstall(null)} onConfirm={()=>void confirmUninstall()}/>
    {forkSource&&<ForkNameDialog suggestedName={forkName} onClose={()=>setForkSource(null)} onConfirm={name=>void createCopy(name)}/>}
  </>;

  // Mobile: push to detail (salvo si hay editor abierto — el editor de :361 gana).
  if (isMobile && shownApp && !editingApp) {
    return <><AppDetail key={shownApp.id} app={shownApp} catalogView={catalogView} primaryAction={primaryAction(shownApp)} origin={appOrigin(shownApp)} onBack={() => setSelectedApp(null)} onRefresh={handleRefresh} />{dialogs}</>;
  }

  const needsRestart = restartRequired.openclaw || restartRequired.core;

  // Full-screen editor for adapted apps
  if (editingApp) {
    return (
      <div style={{ height: '100%', fontFamily: 'var(--font-sans)' }}>
        <AppEditor app={editingApp} onBack={() => { setEditingApp(null); handleRefresh(); }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'var(--font-sans)' }}>
      {/* Main panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Restart banner */}
          {needsRestart && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)',
              borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: 'var(--warning)',
            }}>
              <AlertTriangle size={14} />
              <span style={{ flex: 1 }}>
                {tr('micelhub.restartRequired', { reason: restartRequired.reason || tr('micelhub.appModified') })}
                {restartRequired.openclaw && tr('micelhub.openclawRestart')}
                {restartRequired.core && tr('micelhub.coreRestart')}
              </span>
              <button onClick={() => { if (restartRequired.openclaw) clearRestart('openclaw'); if (restartRequired.core) clearRestart('core'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2, display: 'flex' }}>
                <X size={14} />
              </button>
            </div>
          )}

          <div className="micelhub-topbar">
            <nav className="micelhub-tabs" role="tablist" aria-label="MicelHub" onKeyDown={event=>{
              if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
              const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
              const index=tabs.indexOf(document.activeElement as HTMLButtonElement);
              const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
              event.preventDefault();tabs[next]?.focus();tabs[next]?.click();
            }}>
              {(['registry','disponibles','available','installed','workshop',...(isAdmin?['plugins']:[])] as Tab[]).map(value => {
                const label = value==='registry'?tr('micelhub.registry'):value==='disponibles'?tr('micelhub.available'):value==='available'?tr('micelhub.installed'):value==='installed'?tr('micelhub.assigned'):value==='workshop'?tr('micelhub.workshop'):tr('micelhub.plugins');
                const count = value==='disponibles'?disponiblesCount:value==='available'?installedCount:value==='installed'?agentsWithSkills.filter(agent=>agent.skills.length>0).length:0;
                return <button key={value} role="tab" aria-selected={tab===value} tabIndex={tab===value?0:-1} onClick={event=>{setTab(value);setSelectedApp(null);setExactResult(null);event.currentTarget.scrollIntoView({block:'nearest',inline:'nearest'});}}
                  className="shrink-0 rounded-[var(--radius-md)] border px-3 py-2 text-[13px] transition-colors"
                  style={{borderColor:tab===value?'var(--border)':'transparent',background:tab===value?'var(--surface-hover)':'transparent',color:tab===value?'var(--text)':'var(--text-dim)',fontWeight:tab===value?600:400}}>
                  {label}{count>0&&<> <span className="ml-1 text-[11px] text-[var(--text-muted)]">({count})</span></>}
                </button>;
              })}
            </nav>
            {isCatalogTab&&<div className="micelhub-search flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 focus-within:border-[var(--amber)]">
              <Search size={16} className="shrink-0 text-[var(--text-dim)]"/>
              <input type="search" aria-label={tr('micelhub.search')} value={search} onChange={event=>{setSearch(event.target.value);setExactResult(null);}} placeholder={tr('micelhub.search')}
                className="h-9 min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--text)] outline-none [&::-webkit-search-cancel-button]:hidden"/>
              {search&&<button type="button" aria-label={tr('micelhub.clearSearch')} onClick={()=>{setSearch('');setExactResult(null);}} className="rounded p-1 text-[var(--text-dim)] hover:text-[var(--text)]"><X size={14}/></button>}
            </div>}
          </div>

          {/* Filtros por tag — 4 grupos: Origen · Nivel · Plan · Distintivos */}
          {isCatalogTab && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1" aria-label="Application filters">
              {/* Origen */}
              {ORIGIN_FILTERS.map(origin => (
                <TagButton key={origin} label={origin} active={originFilters.has(origin)}
                  colors={(ORIGIN_COLORS[origin] ?? ORIGIN_COLORS.Community)!}
                  onClick={() => toggleFilter(originFilters, origin, setOriginFilters)} />
              ))}
              <span style={{ color: 'var(--border)', margin: '0 2px' }}>|</span>
              {/* Nivel */}
              {['L1', 'L2', 'L3'].map(level => (
                <TagButton key={level} label={level} active={levelFilters.has(level)}
                  colors={LEVEL_COLORS[level]!}
                  onClick={() => toggleFilter(levelFilters, level, setLevelFilters)} />
              ))}
              <span style={{ color: 'var(--border)', margin: '0 2px' }}>|</span>
              {/* Plan */}
              {['Free', 'Pro', 'Plus'].map(tier => (
                <TagButton key={tier} label={tier} active={tierFilters.has(tier)}
                  colors={TIER_COLORS[tier]!}
                  onClick={() => toggleFilter(tierFilters, tier, setTierFilters)} />
              ))}
              <span style={{ color: 'var(--border)', margin: '0 2px' }}>|</span>
              {/* Distintivos */}
              {['Verified', 'Featured'].map(st => (
                <TagButton key={st} label={st === 'Verified' ? '✓ Verified' : st} active={distintivoFilters.has(st)}
                  colors={DISTINTIVO_COLORS[st]!}
                  onClick={() => toggleFilter(distintivoFilters, st, setDistintivoFilters)} />
              ))}
            </div>
            <div className="ml-auto flex shrink-0 gap-1" aria-label="View">
              {([['grid',LayoutGrid,tr('micelhub.grid')],['list',List,tr('micelhub.list')]] as const).map(([mode,Icon,label])=><button key={mode} type="button" title={label} aria-label={label} aria-pressed={viewMode===mode} onClick={()=>changeViewMode(mode)} className="rounded-[var(--radius-md)] border p-1.5" style={{borderColor:viewMode===mode?'var(--border)':'transparent',background:viewMode===mode?'var(--surface-hover)':'transparent',color:viewMode===mode?'var(--text)':'var(--text-dim)'}}><Icon size={16}/></button>)}
            </div>
            </div>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="min-h-0 flex-1">
          {isCatalogTab&&tab!=='registry'&&(registry.local_error||registry.installed_error)&&<p role="alert" className="mx-4 mt-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--text-dim)]">{tr('micelhub.registryFailed')}</p>}
          {tab==='disponibles'&&isAdmin&&<div className="flex justify-end px-4 pt-3"><Button variant="outline" size="sm" onClick={importFile}><Upload size={13}/>{tr('micelhub.registryImport')}</Button></div>}
          {tab === 'workshop' ? (
            <WorkshopTab adaptedApps={catalog.filter(app=>app.source==='adapted')} copyableApps={installedList} onEditApp={isAdmin?setEditingApp:undefined} onCreateCopy={isAdmin?startCopy:undefined} />
          ) : tab === 'plugins' ? (
            <PluginsBrowser focusId={focusPlugin} />
          ) : tab === 'registry' ? (
            <RegistryBrowser apps={filtered} onSelect={setSelectedApp} selectedId={selectedApp?.id??null} onRefresh={()=>void registry.refresh(true)} getAction={app=>primaryAction(app,'registry')} viewMode={viewMode} loading={isLoading} error={registry.public_error} hasQuery={!!search.trim()}/>
          ) : tab === 'installed' ? (
            /* Installed: view by agent */
            installedLoading ? (
              <div style={{ padding: 16 }}>
                {[1, 2, 3].map(i => <div key={i} style={{ height: 80, background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: 8, animation: 'pulse 2s infinite' }} />)}
              </div>
            ) : (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {agentsWithSkills.filter(a => a.name !== '_system' || a.skills.length > 0).map(agent => (
                  <div key={agent.id}
                    onClick={() => setAssigningAgent(agent.id)}
                    style={{ background: 'var(--card)', border: assigningAgent === agent.id ? '1px solid var(--amber-dim)' : '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px', cursor: 'pointer', transition: 'var(--transition-fast)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: '1.125rem' }}>{agent.avatar ?? '🤖'}</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{agent.display_name}</span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {agent.skills.length} app{agent.skills.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                      {agent.skills.map(s => {
                        const chipColor=officeColor(s.id)??officeColor(s.name.toLowerCase())??s.color??'#06b6d4';
                        return (
                        <span key={s.id} style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          padding: '3px 8px', fontSize: '0.6875rem',
                          background: `color-mix(in srgb, ${chipColor} 7%, transparent)`, border: `1px solid color-mix(in srgb, ${chipColor} 30%, transparent)`,
                          borderRadius: 'var(--radius-sm)', color: chipColor,
                        }}>
                          <AppIcon icon={s.icon ?? '📦'} icon_kind={s.icon_kind} color={chipColor} size={13} /> {s.name}
                          <button onClick={(e) => { e.stopPropagation(); handleUnassignSkill(agent.id, ((s as Record<string, unknown>).skill_id as string) ?? s.id); }}
                            title={tr('micelhub.removeApp', { name: s.name })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', marginLeft: 2 }}>
                            <X size={10} />
                          </button>
                        </span>
                      );})}
                      {agent.skills.length === 0 && (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{tr('micelhub.noAppsAssigned')}</span>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setAssigningAgent(agent.id); }} title={tr('micelhub.assignApps')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {agentsWithSkills.length === 0 && (
                  <div style={{ padding: 48, textAlign: 'center' }}>
                    <Puzzle size={40} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', margin: 0 }}>{tr('micelhub.noAgents')}</p>
                  </div>
                )}
              </div>
            )
          ) : isLoading ? (
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,280px), 1fr))', gap: 12 }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} style={{ height: 140, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', animation: 'pulse 2s infinite' }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--error)', fontSize: '0.875rem' }}>
              {error}<br />
              <button onClick={handleRefresh} style={{ marginTop: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '6px 12px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)' }}>{tr('micelhub.retry')}</button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Puzzle size={40} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 12 }} />
              <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', margin: 0 }}>
                {search ? tr('micelhub.noLocalSearchResults') : tr('micelhub.noFilterResults')}
              </p>
            </div>
          ) : viewMode === 'list' ? (
            <div>
              <AppListHeader catalogView={catalogView} />
              {filtered.map((app) => (
                <AppListRow key={app.id} app={app} origin={appOrigin(app)}
                  selected={selectedApp?.id === app.id}
                  onClick={() => setSelectedApp(app)}
                  onRefresh={handleRefresh} catalogView={catalogView} primaryAction={primaryAction(app)} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,280px), 1fr))', gap: 12, padding: 16 }}>
              {filtered.map((app) => (
                <AppCard key={app.id} app={app} origin={appOrigin(app)}
                  selected={selectedApp?.id === app.id}
                  onClick={() => setSelectedApp(app)}
                  onRefresh={handleRefresh} catalogView={catalogView} primaryAction={primaryAction(app)} />
              ))}
            </div>
          )}

        </ScrollArea>
      </div>

      {/* Detail panel (desktop) */}
      {!isMobile && shownApp && (
        <div style={{ width: 400, minWidth: 400, borderLeft: '1px solid var(--border)', overflow: 'hidden' }}>
          <AppDetail key={shownApp.id} app={shownApp} origin={appOrigin(shownApp)} catalogView={catalogView} primaryAction={primaryAction(shownApp)} onBack={() => setSelectedApp(null)} onRefresh={handleRefresh} />
        </div>
      )}

      {dialogs}

      {/* Assign Apps Modal (Installed tab) — shared component */}
      {assigningAgent && (() => {
        const agent = agentsWithSkills.find(a => a.id === assigningAgent);
        if (!agent) return null;
        const currentIds = agent.skills.map((s: Record<string, unknown>) => (s.skill_id ?? s.id) as string);
        return (
          <SharedAssignAppsModal
            agentId={agent.id}
            agentName={agent.display_name}
            agentAvatar={agent.avatar ?? undefined}
            currentSkillIds={currentIds}
            open={true}
            onClose={() => setAssigningAgent(null)}
            onSaved={() => { fetchInstalled(); setAssigningAgent(null); }}
          />
        );
      })()}

      <style>{`
        .micelhub-topbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .micelhub-tabs { display:flex; gap:2px; align-items:center; flex:1 1 510px; min-width:0; overflow-x:auto; }
        .micelhub-search { flex:1 1 280px; max-width:380px; min-width:0; }
        @media(max-width:768px) { .micelhub-search { flex-basis:100%; max-width:none; } .micelhub-tabs { flex-basis:100%; } }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
