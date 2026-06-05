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
 * Each entry maps a sectionId → searchable strings:
 *   - `label`:    the section's user-visible name
 *   - `tags`:     concept synonyms (Spanish + English + technical terms)
 *   - `settings`: concrete setting names exposed in that section, so a
 *                 user typing "WoL" or "PATH" finds the right section
 *                 even if those words aren't in the section title or
 *                 generic tags
 *
 * Maintained by hand because we want bilingual synonyms and because
 * field names alone aren't enough — users think in concepts.
 *
 * Drift protection: `validateSearchIndex(knownIds)` runs in dev mode
 * from SettingsPage and console-warns when registered sections are
 * missing from the index, or when the index references unknown IDs.
 */

export interface SettingsSearchEntry {
  sectionId: string;
  groupId: string;
  label: string;
  tags: string[];
  /**
   * Concrete setting names visible in this section. Matching against
   * these surfaces the section AND tells the user *which* setting
   * matched — see `SettingsSearchResult.match.term`.
   */
  settings?: string[];
}

export type SettingsSearchMatchField = 'label' | 'tag' | 'setting';

export interface SettingsSearchMatch {
  /** Where the match came from, for the result-row hint. */
  field: SettingsSearchMatchField;
  /** The exact substring matched (the tag/setting/label text). */
  term: string;
}

export interface SettingsSearchResult {
  entry: SettingsSearchEntry;
  match: SettingsSearchMatch;
}

export const SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = [
  // ── Cuenta ──
  { sectionId: 'account', groupId: 'account', label: 'Account',
    tags: ['cuenta', 'profile', 'perfil', 'email', 'password', 'contraseña'],
    settings: ['display name', 'email', 'password', 'avatar', 'language'] },
  { sectionId: 'agent-tokens', groupId: 'dev', label: 'Agent Tokens',
    tags: ['tokens', 'agentes', 'session', 'api', 'keys', 'developer'],
    settings: ['session token', 'static token', 'revoke', 'rotate'] },
  { sectionId: 'permissions', groupId: 'account', label: 'Permissions',
    tags: ['permisos', 'roles', 'access'],
    settings: ['allowed domains', 'tag filter', 'include only', 'exclude'] },
  { sectionId: 'license', groupId: 'account', label: 'License',
    tags: ['licencia', 'plan', 'subscription', 'tier'],
    settings: ['plan', 'tier', 'upgrade', 'billing'] },
  { sectionId: 'approvals-history', groupId: 'account', label: 'Approvals History',
    tags: ['historial', 'aprobaciones', 'audit'],
    settings: ['approval history', 'audit log'] },

  // ── Apariencia ──
  { sectionId: 'dash', groupId: 'appearance', label: 'Dash',
    tags: ['tema', 'theme', 'colors', 'colores', 'accent', 'modules', 'branding', 'asistente', 'assistant'],
    settings: ['accent color', 'seam color', 'module colors', 'assistant name', 'assistant avatar', 'openclaw branding'] },
  { sectionId: 'general', groupId: 'appearance', label: 'General',
    tags: ['idioma', 'language', 'timezone', 'fecha', 'date', 'time', 'hora'],
    settings: ['language', 'timezone', 'date format', 'time format', 'first day of week'] },
  { sectionId: 'shortcuts', groupId: 'appearance', label: 'Shortcuts',
    tags: ['atajos', 'keyboard', 'teclado', 'hotkey'],
    settings: ['keyboard shortcuts', 'command palette', 'global hotkeys'] },
  { sectionId: 'notifications', groupId: 'appearance', label: 'Notifications',
    tags: ['notificaciones', 'alerts', 'sound'],
    settings: ['desktop notifications', 'notification sound', 'badge counts'] },

  // ── Inteligencia y agentes ──
  { sectionId: 'ai', groupId: 'ai-agents', label: 'AI & Intelligence',
    tags: ['ai', 'modelos', 'models', 'embeddings', 'ollama', 'tokens', 'thinking', 'multimodal', 'graph', 'entity'],
    settings: ['default model', 'fallback model', 'embedding provider', 'thinking level', 'reasoning', 'entity extraction'] },
  { sectionId: 'voice', groupId: 'ai-agents', label: 'Voice',
    tags: ['voz', 'stt', 'tts', 'speech', 'whisper'],
    settings: ['stt engine', 'tts provider', 'voice', 'whisper', 'wake word', 'wave5'] },
  { sectionId: 'tool-access-defaults', groupId: 'ai-agents', label: 'Tool Access',
    tags: ['tools', 'herramientas', 'permisos', 'preset', 'minimal', 'coding'],
    settings: ['preset', 'minimal', 'coding', 'messaging', 'full', 'inherit', 'allow', 'deny'] },
  { sectionId: 'memory-search', groupId: 'ai-agents', label: 'Memory',
    tags: ['memory', 'memoria', 'search', 'busqueda', 'embeddings', 'hybrid', 'mmr'],
    settings: ['embedding provider', 'max results', 'mmr', 'hybrid search', 'citations'] },
  { sectionId: 'sessions', groupId: 'ai-agents', label: 'Sessions',
    tags: ['sessions', 'sesiones', 'compaction', 'context'],
    settings: ['dm scope', 'reset mode', 'idle minutes', 'thread bindings', 'prune after', 'max disk', 'agent to agent'] },
  { sectionId: 'channel-bindings', groupId: 'ai-agents', label: 'Channel Bindings',
    tags: ['channels', 'canales', 'queue', 'streaming', 'tts', 'reactions'],
    settings: ['queue mode', 'collect', 'steer', 'follow-up', 'interrupt', 'typing mode', 'human delay', 'bot tts', 'ack reaction'] },

  // ── Aplicaciones ──
  { sectionId: 'mail', groupId: 'apps', label: 'Mail',
    tags: ['mail', 'email', 'imap', 'smtp', 'gmail'],
    settings: ['imap', 'smtp', 'sync interval', 'signatures', 'aliases'] },
  { sectionId: 'calendar', groupId: 'apps', label: 'Calendar',
    tags: ['calendar', 'calendario', 'caldav', 'events'],
    settings: ['caldav', 'sync interval', 'default calendar', 'event reminders'] },
  { sectionId: 'photos', groupId: 'apps', label: 'Photos',
    tags: ['photos', 'fotos', 'pipeline', 'faces', 'insightface'],
    settings: ['ai worker', 'face recognition', 'face match threshold', 'visual similarity', 'concept similarity', 'guest upload limit'] },
  { sectionId: 'feeds', groupId: 'apps', label: 'Feeds',
    tags: ['feeds', 'rss', 'atom'],
    settings: ['rss', 'atom', 'sync interval', 'feed list'] },
  { sectionId: 'search', groupId: 'apps', label: 'Search',
    tags: ['search', 'busqueda', 'fulltext', 'semantic'],
    settings: ['search mode', 'fulltext', 'semantic search', 'pro tier'] },
  { sectionId: 'digest', groupId: 'apps', label: 'Digest',
    tags: ['digest', 'resumen', 'daily'],
    settings: ['digest schedule', 'channels', 'sections'] },
  { sectionId: 'duplicates', groupId: 'apps', label: 'Duplicates',
    tags: ['duplicates', 'duplicados', 'dedupe'],
    settings: ['scan duplicates', 'merge', 'threshold'] },
  { sectionId: 'preferences', groupId: 'ai-agents', label: 'Learned Preferences',
    tags: ['preferencias', 'aprendidas', 'learned', 'agent', 'preferences'],
    settings: ['learned preferences', 'agent preferences', 'context'] },

  // ── Conectividad ──
  { sectionId: 'sync', groupId: 'connectivity', label: 'Sync',
    tags: ['sync', 'sincronizacion', 'connectors', 'observers', 'channel'],
    settings: ['integrations', 'connectors', 'sync interval', 'channel observers', 'rss observer', 'slack observer'] },
  { sectionId: 'network', groupId: 'connectivity', label: 'Network',
    tags: ['network', 'red', 'wifi', 'internet'],
    settings: ['interfaces', 'firewall', 'open ports', 'vpn', 'wireguard', 'proxy', 'ssh exposure'] },
  { sectionId: 'gateway-auth', groupId: 'connectivity', label: 'Gateway',
    tags: ['gateway', 'auth', 'token', 'tls', 'mdns', 'discovery', 'tailscale', 'bind', 'devices', 'pairing'],
    settings: ['auth mode', 'bind address', 'tls', 'tailscale', 'reload mode', 'mdns', 'discovery', 'paired devices'] },

  // ── Sistema ──
  { sectionId: 'storage', groupId: 'system', label: 'Storage',
    tags: ['storage', 'almacenamiento', 'disk', 'snapshots', 'canvas', 'paths'],
    settings: ['data path', 'files path', 'backup path', 'file snapshots', 'rotation policy', 'excluded patterns', 'canvas host', 'canvas port'] },
  { sectionId: 'database', groupId: 'system', label: 'Database',
    tags: ['database', 'base', 'datos', 'postgres', 'backup'],
    settings: ['postgresql credentials', 'mariadb credentials', 'reveal credentials'] },
  { sectionId: 'energy', groupId: 'system', label: 'Energy',
    tags: ['energy', 'energia', 'power', 'battery'],
    settings: ['power status', 'ups', 'suspend', 'hibernate', 'reboot', 'shutdown', 'wake-on-lan', 'wol', 'mac address', 'schedule mode'] },
  { sectionId: 'services', groupId: 'system', label: 'Services',
    tags: ['services', 'servicios', 'lifecycle', 'mailu', 'vision'],
    settings: ['service lifecycle', 'mailu', 'vision', 'restart service', 'stop service'] },
  { sectionId: 'automation', groupId: 'system', label: 'Automation',
    tags: ['automation', 'automatizacion', 'cron', 'hooks', 'webhooks', 'jobs', 'schedule'],
    settings: ['cron jobs', 'max concurrent runs', 'retry attempts', 'backoff', 'failure alerts', 'webhook mappings', 'internal hooks', 'webhook token'] },

  // ── Seguridad ──
  { sectionId: 'security', groupId: 'security', label: 'Security',
    tags: ['security', 'seguridad', 'pin', 'shell', 'approvals', 'aprobaciones', 'forwarding', 'reenvio'],
    settings: ['security pin', 'unrestricted shell', 'approval levels', 'reminder timeout', 'escalation timeout', 'expiry timeout', 'approvals forwarding'] },
  { sectionId: 'sandbox', groupId: 'security', label: 'Sandbox',
    tags: ['sandbox', 'isolation', 'aislamiento'],
    settings: ['sandbox mode', 'container scope', 'workspace access', 'idle prune', 'max age'] },
  { sectionId: 'browser-config', groupId: 'security', label: 'Browser',
    tags: ['browser', 'navegador', 'web', 'allowlist', 'denylist', 'evaluate'],
    settings: ['browser enabled', 'headless', 'javascript evaluation', 'private network', 'default profile', 'ssrf'] },
  { sectionId: 'commands', groupId: 'security', label: 'Commands',
    tags: ['commands', 'comandos', 'shell', 'safe', 'developer'],
    settings: ['native slash commands', 'shell access', 'bash mode', '/config', '/debug', '/restart'] },

  // ── Administración (admin only) ──
  { sectionId: 'users', groupId: 'admin', label: 'Users',
    tags: ['users', 'usuarios', 'admin', 'roles'],
    settings: ['create user', 'edit user', 'change role', 'delete user', 'reset password'] },
  { sectionId: 'observability', groupId: 'admin', label: 'Observability',
    tags: ['observability', 'observabilidad', 'logging', 'logs', 'telemetry', 'telemetria', 'otel', 'env', 'environment', 'variables', 'redact'],
    settings: ['log level', 'console style', 'redact patterns', 'otel endpoint', 'otel headers', 'sample rate', 'env vars', 'shell env'] },
  { sectionId: 'secrets', groupId: 'admin', label: 'Secrets',
    tags: ['secrets', 'secretos', 'env', 'file', 'exec', 'providers'],
    settings: ['env provider', 'file provider', 'exec provider', 'allowlist', 'json only', 'test secret'] },
  { sectionId: 'raw', groupId: 'admin', label: 'Raw JSON',
    tags: ['raw', 'json', 'config', 'openclaw', 'editor'],
    settings: ['openclaw.json', 'raw editor', 'config schema', 'backups'] },
];

/**
 * Search the index for entries matching `query` (case-insensitive
 * substring). Returns at most 30 results, ordered by match field
 * priority: label > setting > tag — so the section name match always
 * floats above keyword matches.
 *
 * Each result carries the matched field and term so the consumer can
 * render a "matched setting: WoL MAC" hint under the section name.
 */
export function searchSettings(query: string): SettingsSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  // Score lower = better, so we sort ascending. Label hits beat
  // setting hits beat tag hits; within the same field, hits where
  // the matched term *starts with* the query rank above mid-string
  // hits (so typing "ene" surfaces "Energy" before "Performance" if
  // both contained those letters).
  const FIELD_RANK: Record<SettingsSearchMatchField, number> = {
    label: 0,
    setting: 1,
    tag: 2,
  };

  const matched: Array<{
    entry: SettingsSearchEntry;
    match: SettingsSearchMatch;
    score: number;
  }> = [];

  for (const entry of SETTINGS_SEARCH_INDEX) {
    const m = findFirstMatch(entry, q);
    if (!m) continue;
    const fieldRank = FIELD_RANK[m.field] * 10;
    const startBonus = m.term.toLowerCase().startsWith(q) ? 0 : 5;
    matched.push({ entry, match: m, score: fieldRank + startBonus });
  }

  matched.sort((a, b) => a.score - b.score);
  return matched.slice(0, 30).map(({ entry, match }) => ({ entry, match }));
}

function findFirstMatch(
  entry: SettingsSearchEntry,
  q: string,
): SettingsSearchMatch | null {
  if (entry.label.toLowerCase().includes(q)) {
    return { field: 'label', term: entry.label };
  }
  for (const setting of entry.settings ?? []) {
    if (setting.toLowerCase().includes(q)) {
      return { field: 'setting', term: setting };
    }
  }
  for (const tag of entry.tags) {
    if (tag.toLowerCase().includes(q)) {
      return { field: 'tag', term: tag };
    }
  }
  return null;
}

/**
 * Dev-time consistency check. Compares the search index against the
 * authoritative list of registered section IDs and console-warns when
 * they drift apart. Designed to be called once at SettingsPage mount
 * in `import.meta.env.DEV` mode — does nothing in production builds.
 *
 * Two failure modes detected:
 *   1. Sections registered in `SECTION_REGISTRY` but missing here →
 *      a user typing the section's name into search wouldn't find it.
 *   2. Entries here pointing at IDs that don't exist (typo, removed
 *      section that wasn't cleaned up) → "ghost" results that 404.
 */
export function validateSearchIndex(knownIds: readonly string[]): void {
  const indexed = new Set(SETTINGS_SEARCH_INDEX.map((e) => e.sectionId));
  const known = new Set(knownIds);

  const missing: string[] = [];
  for (const id of knownIds) {
    if (!indexed.has(id)) missing.push(id);
  }

  const ghost: string[] = [];
  for (const entry of SETTINGS_SEARCH_INDEX) {
    if (!known.has(entry.sectionId)) ghost.push(entry.sectionId);
  }

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[settings-search-index] ${missing.length} registered section(s) missing from search index — search won't surface them: ${missing.join(', ')}`,
    );
  }
  if (ghost.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[settings-search-index] ${ghost.length} index entr${ghost.length === 1 ? 'y points' : 'ies point'} at unknown section ID(s): ${ghost.join(', ')}`,
    );
  }
}
