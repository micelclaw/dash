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

// Single source of truth for tool-call visibility tiers and renderers.
// Used by ChatMessage to decide whether and how to render each tool
// call. The user can override visibility per tool from Settings →
// Chat → Tool visibility.

export type Tier = 1 | 2 | 3 | 4;

export type RendererKind =
  | 'spawn'
  | 'bash'
  | 'read'
  | 'edit'
  | 'browse'
  | 'search'
  | 'memory'
  | 'generic';

export interface ToolDef {
  /** Exact tool name (lowercased for match). */
  name: string;
  tier: Tier;
  icon: string;
  /** Human-readable label for settings. */
  label: string;
  renderer: RendererKind;
}

export const TOOL_DEFS: ToolDef[] = [
  // ─── Tier 1 — featured (delegation, scheduling) ───────────────────
  { name: 'sessions_spawn', tier: 1, icon: '🔀', label: 'Delegación a sub-agente', renderer: 'spawn' },
  { name: 'sessions_send',  tier: 1, icon: '🔀', label: 'Mensaje a sub-agente',    renderer: 'spawn' },
  { name: 'cron',           tier: 1, icon: '⏰', label: 'Programar tarea',          renderer: 'generic' },

  // ─── Tier 2 — visible collapsed by default ───────────────────────
  { name: 'bash',          tier: 2, icon: '💻', label: 'Comando bash',         renderer: 'bash' },
  { name: 'process',       tier: 2, icon: '💻', label: 'Proceso',              renderer: 'bash' },
  { name: 'exec',          tier: 2, icon: '💻', label: 'Exec',                 renderer: 'bash' },
  { name: 'read',          tier: 2, icon: '📄', label: 'Lectura de archivo',   renderer: 'read' },
  { name: 'write',         tier: 2, icon: '✏️',  label: 'Escritura de archivo', renderer: 'edit' },
  { name: 'edit',          tier: 2, icon: '✏️',  label: 'Edición de archivo',   renderer: 'edit' },
  { name: 'apply_patch',   tier: 2, icon: '✏️',  label: 'Patch',                renderer: 'edit' },
  { name: 'browser',       tier: 2, icon: '🌐', label: 'Navegador',            renderer: 'browse' },
  { name: 'web',           tier: 2, icon: '🌐', label: 'Fetch web',            renderer: 'browse' },
  { name: 'webfetch',      tier: 2, icon: '🌐', label: 'Fetch web',            renderer: 'browse' },
  { name: 'tavily-search', tier: 2, icon: '🔍', label: 'Búsqueda Tavily',      renderer: 'search' },
  { name: 'web-search',    tier: 2, icon: '🔍', label: 'Búsqueda web',         renderer: 'search' },

  // ─── Tier 3 — hidden by default, can opt-in ──────────────────────
  { name: 'memory_search', tier: 3, icon: '🧠', label: 'Búsqueda en memoria', renderer: 'memory' },
  { name: 'memory_get',    tier: 3, icon: '🧠', label: 'Lectura de memoria',  renderer: 'memory' },
  { name: 'agents_list',   tier: 3, icon: '👥', label: 'Listar agentes',      renderer: 'generic' },
  { name: 'sessions_list', tier: 3, icon: '📋', label: 'Listar sesiones',     renderer: 'generic' },
  { name: 'session.get',   tier: 3, icon: '📋', label: 'Detalle de sesión',   renderer: 'generic' },
  { name: 'process_status', tier: 3, icon: '📋', label: 'Estado de proceso',  renderer: 'generic' },
  { name: 'process_log',    tier: 3, icon: '📋', label: 'Log de proceso',     renderer: 'generic' },
  { name: 'process_kill',   tier: 3, icon: '📋', label: 'Matar proceso',      renderer: 'generic' },

  // ─── Plugin debug entries (`pluginDebugEntries` from sessions.json) ──
  // Chat-bridge emits one `chat.stream.tool` per OpenClaw plugin status
  // line, with `tool: "plugin:<pluginId>"`. Featured plugins get a tailored
  // icon/label; any other plugin falls back to the generic classifier
  // (tier 3, 🔧, lowercased name).
  { name: 'plugin:active-memory', tier: 3, icon: '🧩', label: 'OpenClaw: Active Memory', renderer: 'generic' },
  { name: 'plugin:memory-core',   tier: 3, icon: '🧠', label: 'OpenClaw: Memory Core',   renderer: 'generic' },
];

const BY_NAME = new Map<string, ToolDef>();
for (const def of TOOL_DEFS) BY_NAME.set(def.name.toLowerCase(), def);

/**
 * Classify a tool name. Unknown tools fall back to a Tier 3 generic
 * renderer (visible only when "verbose" or explicitly enabled).
 */
export function classify(toolName: string): ToolDef {
  const lower = toolName.toLowerCase();
  const direct = BY_NAME.get(lower);
  if (direct) return direct;
  // Tools MCP de Micelclaw OS: `<server>__<tool>` (p.ej. `claw-os__claw_notes`) o
  // `claw_<dominio>`. Son acciones de primer orden del agente sobre los datos del
  // usuario → tier 2 (visibles bajo el preset por defecto, como bash/read/edit).
  // Label = la parte de la tool sin el prefijo del server (claw_notes).
  if (lower.includes('__') ? /(^|__)claw[_-]/.test(lower) : lower.startsWith('claw_')) {
    const toolPart = lower.includes('__') ? lower.split('__').pop()! : lower;
    return { name: lower, tier: 2, icon: '🛠️', label: toolPart, renderer: 'generic' };
  }
  // Heurística para otras tools desconocidas (claw-* skills antiguas, etc.).
  return {
    name: lower,
    tier: 3,
    icon: '🔧',
    label: lower,
    renderer: 'generic',
  };
}

// ─── Visibility presets ────────────────────────────────────────────

export type Preset = 'minimal' | 'default' | 'verbose' | 'custom';

export interface ToolVisibility {
  preset: Preset;
  /** Set of tool names explicitly forced ON (regardless of tier). */
  enabledOverrides?: string[];
  /** Set of tool names explicitly forced OFF. */
  disabledOverrides?: string[];
}

export const DEFAULT_VISIBILITY: ToolVisibility = { preset: 'default' };

/**
 * Decide whether a given tool call should render in the chat history.
 * Hierarchy: explicit override > preset rule.
 */
export function shouldRenderTool(toolName: string, visibility: ToolVisibility): boolean {
  const lower = toolName.toLowerCase();
  if (visibility.disabledOverrides?.includes(lower)) return false;
  if (visibility.enabledOverrides?.includes(lower)) return true;
  const def = classify(toolName);
  switch (visibility.preset) {
    case 'minimal': return def.tier === 1;
    case 'default': return def.tier === 1 || def.tier === 2;
    case 'verbose': return def.tier <= 3;
    case 'custom':  return def.tier <= 2; // custom uses tier ≤ 2 as base
    default:        return def.tier === 1 || def.tier === 2;
  }
}
