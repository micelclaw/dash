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

/**
 * Static keyword index for the Settings sidebar search.
 *
 * Each entry maps a sectionId → list of searchable keywords (Spanish
 * + English + technical terms). When the user types in the sidebar
 * search box, we match against `label` AND `tags` so they can find
 * "PIN" → Security or "mDNS" → Gateway without remembering structure.
 *
 * Maintained by hand because we want synonyms in two languages and
 * because field names alone are not enough — users think in concepts.
 */

export interface SettingsSearchEntry {
  sectionId: string;
  groupId: string;
  label: string;
  tags: string[];
}

export const SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = [
  // ── Cuenta ──
  { sectionId: 'account', groupId: 'account', label: 'Account', tags: ['cuenta', 'profile', 'perfil', 'email', 'password', 'contraseña'] },
  { sectionId: 'agent-tokens', groupId: 'account', label: 'Agent Tokens', tags: ['tokens', 'agentes', 'session'] },
  { sectionId: 'permissions', groupId: 'account', label: 'Permissions', tags: ['permisos', 'roles', 'access'] },
  { sectionId: 'license', groupId: 'account', label: 'License', tags: ['licencia', 'plan', 'subscription', 'tier'] },
  { sectionId: 'approvals-history', groupId: 'account', label: 'Approvals History', tags: ['historial', 'aprobaciones', 'audit'] },
  // Note: my-api-keys is being moved to Gateway Models, kept reachable via URL but not in sidebar.

  // ── Apariencia ──
  { sectionId: 'dash', groupId: 'appearance', label: 'Dash', tags: ['tema', 'theme', 'colors', 'colores', 'accent', 'modules', 'branding', 'asistente', 'assistant'] },
  { sectionId: 'general', groupId: 'appearance', label: 'General', tags: ['idioma', 'language', 'timezone', 'fecha', 'date', 'time', 'hora'] },
  { sectionId: 'shortcuts', groupId: 'appearance', label: 'Shortcuts', tags: ['atajos', 'keyboard', 'teclado', 'hotkey'] },
  { sectionId: 'notifications', groupId: 'appearance', label: 'Notifications', tags: ['notificaciones', 'alerts', 'sound'] },

  // ── Inteligencia y agentes ──
  { sectionId: 'ai', groupId: 'ai-agents', label: 'AI & Intelligence', tags: ['ai', 'modelos', 'models', 'embeddings', 'ollama', 'tokens', 'thinking', 'multimodal', 'graph', 'entity'] },
  { sectionId: 'voice', groupId: 'ai-agents', label: 'Voice', tags: ['voz', 'stt', 'tts', 'speech', 'whisper'] },
  { sectionId: 'tool-access-defaults', groupId: 'ai-agents', label: 'Tool Access', tags: ['tools', 'herramientas', 'permisos', 'preset', 'minimal', 'coding'] },
  { sectionId: 'memory-search', groupId: 'ai-agents', label: 'Memory', tags: ['memory', 'memoria', 'search', 'busqueda', 'embeddings', 'hybrid', 'mmr'] },
  { sectionId: 'sessions', groupId: 'ai-agents', label: 'Sessions', tags: ['sessions', 'sesiones', 'compaction', 'context'] },
  { sectionId: 'channel-bindings', groupId: 'ai-agents', label: 'Channel Bindings', tags: ['channels', 'canales', 'queue', 'streaming', 'tts', 'reactions'] },

  // ── Aplicaciones ──
  { sectionId: 'mail', groupId: 'apps', label: 'Mail', tags: ['mail', 'email', 'imap', 'smtp', 'gmail'] },
  { sectionId: 'calendar', groupId: 'apps', label: 'Calendar', tags: ['calendar', 'calendario', 'caldav', 'events'] },
  { sectionId: 'photos', groupId: 'apps', label: 'Photos', tags: ['photos', 'fotos', 'pipeline', 'faces', 'insightface'] },
  { sectionId: 'feeds', groupId: 'apps', label: 'Feeds', tags: ['feeds', 'rss', 'atom'] },
  { sectionId: 'search', groupId: 'apps', label: 'Search', tags: ['search', 'busqueda', 'fulltext', 'semantic'] },
  { sectionId: 'digest', groupId: 'apps', label: 'Digest', tags: ['digest', 'resumen', 'daily'] },
  { sectionId: 'duplicates', groupId: 'apps', label: 'Duplicates', tags: ['duplicates', 'duplicados', 'dedupe'] },
  { sectionId: 'preferences', groupId: 'apps', label: 'Learned Preferences', tags: ['preferencias', 'aprendidas', 'learned'] },

  // ── Conectividad ──
  { sectionId: 'sync', groupId: 'connectivity', label: 'Sync', tags: ['sync', 'sincronizacion', 'connectors', 'observers', 'channel'] },
  { sectionId: 'network', groupId: 'connectivity', label: 'Red', tags: ['network', 'red', 'wifi', 'internet'] },
  { sectionId: 'gateway-auth', groupId: 'connectivity', label: 'Gateway', tags: ['gateway', 'auth', 'token', 'tls', 'mdns', 'discovery', 'tailscale', 'bind', 'devices', 'pairing'] },

  // ── Sistema ──
  { sectionId: 'storage', groupId: 'system', label: 'Storage', tags: ['storage', 'almacenamiento', 'disk', 'snapshots', 'canvas', 'paths'] },
  { sectionId: 'database', groupId: 'system', label: 'Database', tags: ['database', 'base', 'datos', 'postgres', 'backup'] },
  { sectionId: 'energy', groupId: 'system', label: 'Energia', tags: ['energy', 'energia', 'power', 'battery'] },
  { sectionId: 'services', groupId: 'system', label: 'Services', tags: ['services', 'servicios', 'lifecycle', 'mailu', 'vision'] },
  { sectionId: 'sensor-fusion', groupId: 'system', label: 'Sensor Fusion', tags: ['sensor', 'fusion', 'context'] },
  { sectionId: 'automation', groupId: 'system', label: 'Automation', tags: ['automation', 'automatizacion', 'cron', 'hooks', 'webhooks', 'jobs', 'schedule'] },

  // ── Seguridad ──
  { sectionId: 'security', groupId: 'security', label: 'Security', tags: ['security', 'seguridad', 'pin', 'shell', 'approvals', 'aprobaciones', 'forwarding', 'reenvio'] },
  { sectionId: 'sandbox', groupId: 'security', label: 'Sandbox', tags: ['sandbox', 'isolation', 'aislamiento'] },
  { sectionId: 'browser-config', groupId: 'security', label: 'Browser', tags: ['browser', 'navegador', 'web', 'allowlist', 'denylist', 'evaluate'] },
  { sectionId: 'commands', groupId: 'security', label: 'Commands', tags: ['commands', 'comandos', 'shell', 'safe', 'developer'] },

  // ── Administración (admin only) ──
  { sectionId: 'users', groupId: 'admin', label: 'Users', tags: ['users', 'usuarios', 'admin', 'roles'] },
  { sectionId: 'observability', groupId: 'admin', label: 'Observability', tags: ['observability', 'observabilidad', 'logging', 'logs', 'telemetry', 'telemetria', 'otel', 'env', 'environment', 'variables', 'redact'] },
  { sectionId: 'secrets', groupId: 'admin', label: 'Secrets', tags: ['secrets', 'secretos', 'env', 'file', 'exec', 'providers'] },
  { sectionId: 'raw', groupId: 'admin', label: 'Raw JSON', tags: ['raw', 'json', 'config', 'openclaw', 'editor'] },
];

/**
 * Filter the index by a substring query (case-insensitive). Matches
 * label first, then tags. Returns at most 30 results.
 */
export function searchSettings(query: string): SettingsSearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: SettingsSearchEntry[] = [];
  for (const entry of SETTINGS_SEARCH_INDEX) {
    const labelMatch = entry.label.toLowerCase().includes(q);
    const tagMatch = entry.tags.some((t) => t.toLowerCase().includes(q));
    if (labelMatch || tagMatch) {
      results.push(entry);
      if (results.length >= 30) break;
    }
  }
  return results;
}
