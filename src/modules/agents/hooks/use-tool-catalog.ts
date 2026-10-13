/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

// ─── Tool catalog (shared) ──────────────────────────────────────────
//
// Fetches `GET /managed-agents/available-tools` ONCE and exposes the
// dynamic catalog of native OpenClaw tools + their presets, the
// workboard plugin tools (+ per-profile workboard sets), and the
// existing claw_* MCP facade / third-party MCP server lists.
//
// Both `AgentToolAccess.tsx` (per-agent surface) and
// `ToolAccessDefaultsSection.tsx` (global defaults surface) consume
// this hook instead of hardcoding their own copies of the tool
// catalog (kills the historical duplication between the two).

import { useEffect, useState } from 'react';
import { api } from '@/services/api';

export interface CatalogToolDef {
  name: string;
  desc: string;
}

export interface NativeToolGroup {
  label: string;
  tools: CatalogToolDef[];
}

export interface WorkboardToolGroup {
  key: string;
  label: string;
  tools: CatalogToolDef[];
}

export interface McpToolEntry {
  name: string;
  domain: string;
  label: string;
  actions: string[];
}

export interface ExternalMcpEntry {
  name: string;
  enabled: boolean;
}

export interface ProfileToolSet {
  groups: string[];
  tools: string[];
}

export interface UnifiedToolState {
  name: string;
  configured: boolean;
  available: boolean;
  runtime_loaded: boolean;
  effective: boolean;
  origin: 'openclaw_native' | 'micelclaw_system' | 'micelclaw_app' | 'external_mcp';
  reason: string;
}

export interface UnifiedToolGroup {
  id: string;
  origin: UnifiedToolState['origin'];
  label: string;
  policy?: string;
  tools: Array<{ name: string; description?: string; desc?: string; required?: boolean }>;
}

interface UnifiedCatalogResponseData {
  catalog_version: number;
  groups: UnifiedToolGroup[];
  effective: {
    profile: string;
    access_mode: 'standard' | 'restricted';
    capability_snapshot_stale: boolean;
    tools: UnifiedToolState[];
  };
  links: { apps: string; mcp_connections: string };
}

/** Native OpenClaw preset name ('minimal' | 'coding' | 'messaging' | 'full'). */
export type NativePresetName = string;

interface AvailableToolsResponseData {
  bundle_key: string;
  mcp_tools: McpToolEntry[];
  external_mcp?: ExternalMcpEntry[];
  native_tools?: {
    groups: NativeToolGroup[];
    presets: Record<NativePresetName, string[]>;
  };
  plugin_tools?: {
    workboard?: { enabled: boolean; groups: WorkboardToolGroup[] };
  };
  profile_tools?: Record<NativePresetName, ProfileToolSet>;
  workboard_enabled?: boolean;
}

export interface ToolCatalog {
  /** True while the initial fetch is in flight. */
  loading: boolean;
  /** True once a (successful or failed) response has landed. */
  loaded: boolean;
  bundleKey: string;
  mcpTools: McpToolEntry[];
  externalMcp: ExternalMcpEntry[];
  /** Native OpenClaw tools (26), grouped for display (Files/Runtime/Web/…). */
  nativeGroups: NativeToolGroup[];
  /** Flat list of every native tool name — replaces the old hardcoded `ALL_TOOLS`. */
  allNativeTools: string[];
  /** Native preset name → tool names (minimal/coding/messaging/full), server-sourced. */
  nativePresets: Record<string, string[]>;
  /** Whether the `workboard` OpenClaw plugin is enabled — gates rendering the section. */
  workboardEnabled: boolean;
  /** Workboard tools grouped by G1/G2/G4/G5 (Worker/Orchestration/Notifications/Attachments). */
  workboardGroups: WorkboardToolGroup[];
  /** Flat list of every workboard tool name across all groups. */
  allWorkboardTools: string[];
  /** Native preset name → the workboard tool set that preset materializes. */
  profileTools: Record<string, ProfileToolSet>;
  catalogVersion: number;
  unifiedGroups: UnifiedToolGroup[];
  systemGroups: UnifiedToolGroup[];
  effectiveTools: UnifiedToolState[];
  accessMode: 'standard' | 'restricted';
  capabilitySnapshotStale: boolean;
  mcpConnectionsLink: string;
}

const EMPTY_PRESETS: Record<string, string[]> = { minimal: [], coding: [], messaging: [], full: [] };

const INITIAL_STATE: ToolCatalog = {
  loading: true,
  loaded: false,
  bundleKey: 'bundle-mcp',
  mcpTools: [],
  externalMcp: [],
  nativeGroups: [],
  allNativeTools: [],
  nativePresets: EMPTY_PRESETS,
  workboardEnabled: false,
  workboardGroups: [],
  allWorkboardTools: [],
  profileTools: {},
  catalogVersion: 1,
  unifiedGroups: [],
  systemGroups: [],
  effectiveTools: [],
  accessMode: 'standard',
  capabilitySnapshotStale: false,
  mcpConnectionsLink: '/settings?group=connectivity&section=mcp-connections',
};

export function useToolCatalog(agentId?: string): ToolCatalog {
  const [catalog, setCatalog] = useState<ToolCatalog>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;
    const unifiedPath = `/managed-agents/tool-catalog${agentId ? `?agent_id=${encodeURIComponent(agentId)}` : ''}`;
    Promise.all([
      api.get<{ data: AvailableToolsResponseData }>('/managed-agents/available-tools'),
      api.get<{ data: UnifiedCatalogResponseData }>(unifiedPath),
    ])
      .then(([res, unifiedRes]) => {
        if (cancelled) return;
        const d = res.data;
        const nativeGroups = d.native_tools?.groups ?? [];
        const workboardGroups = d.plugin_tools?.workboard?.groups ?? [];
        const unified = unifiedRes.data;
        setCatalog({
          loading: false,
          loaded: true,
          bundleKey: d.bundle_key ?? 'bundle-mcp',
          mcpTools: d.mcp_tools ?? [],
          externalMcp: d.external_mcp ?? [],
          nativeGroups,
          allNativeTools: nativeGroups.flatMap((g) => g.tools.map((t) => t.name)),
          nativePresets: d.native_tools?.presets ?? EMPTY_PRESETS,
          workboardEnabled: d.workboard_enabled ?? d.plugin_tools?.workboard?.enabled ?? false,
          workboardGroups,
          allWorkboardTools: workboardGroups.flatMap((g) => g.tools.map((t) => t.name)),
          profileTools: d.profile_tools ?? {},
          catalogVersion: unified.catalog_version,
          unifiedGroups: unified.groups,
          systemGroups: unified.groups.filter((group) => group.origin === 'micelclaw_system'),
          effectiveTools: unified.effective.tools,
          accessMode: unified.effective.access_mode,
          capabilitySnapshotStale: unified.effective.capability_snapshot_stale,
          mcpConnectionsLink: unified.links.mcp_connections,
        });
      })
      .catch(() => {
        // Fail soft: la UI nativa (con listas vacías) sigue funcionando; los grupos
        // simplemente no se pintan hasta que el endpoint responda.
        if (!cancelled) setCatalog((prev) => ({ ...prev, loading: false, loaded: true }));
      });
    return () => { cancelled = true; };
  }, [agentId]);

  return catalog;
}
