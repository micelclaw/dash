/**
 * Outbound compatibility boundary for settings removed by OpenClaw 2026.9.4.
 *
 * Keep this module free of browser/API dependencies so the exact payloads can
 * be verified with Node's test runner. The functions never mutate their input.
 */

type ConfigRecord = Record<string, unknown>;

export const OPENCLAW_QUEUE_DEBOUNCE_MS = 500;
export const OPENCLAW_AGENT_EXCHANGES = 5;

function isRecord(value: unknown): value is ConfigRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withoutKeys(source: ConfigRecord, keys: readonly string[]): ConfigRecord {
  const result = { ...source };
  for (const key of keys) delete result[key];
  return result;
}

function hasOwn(source: ConfigRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function sanitizeStatusReactions(value: unknown): unknown {
  return isRecord(value) ? withoutKeys(value, ['timing']) : value;
}

export function sanitizeMessagesConfigPayload(config: ConfigRecord): ConfigRecord {
  const result = { ...config };
  if (isRecord(config.queue)) {
    result.queue = withoutKeys(config.queue, ['debounceMs', 'debounce_ms']);
  }

  // The GET contract is snake_case while this legacy PATCH route consumes its
  // explicit camelCase DTO. Normalize the three reaction fields in one place.
  const aliases: Array<[string, string]> = [
    ['status_reactions', 'statusReactions'],
    ['ack_reaction', 'ackReaction'],
    ['ack_reaction_scope', 'ackReactionScope'],
  ];
  for (const [alias, canonical] of aliases) {
    if (!hasOwn(result, canonical) && hasOwn(config, alias)) result[canonical] = config[alias];
    delete result[alias];
  }
  if (hasOwn(result, 'statusReactions')) {
    result.statusReactions = sanitizeStatusReactions(result.statusReactions);
  }
  return result;
}

function sanitizeMemorySearch(value: ConfigRecord): ConfigRecord {
  const search = withoutKeys(value, [
    'chunking',
    'sync',
    'chunkSize',
    'chunk_size',
    'chunkOverlap',
    'chunk_overlap',
    'maxResults',
    'max_results',
    'qmd',
  ]);
  if (search.provider === 'auto') search.provider = 'openai';
  if (isRecord(search.query)) {
    search.query = withoutKeys(search.query, [
      'hybrid',
      'mmr',
      'temporalDecay',
      'temporal_decay',
      'vectorWeight',
      'vector_weight',
      'textWeight',
      'text_weight',
    ]);
  }
  if (isRecord(search.store)) search.store = withoutKeys(search.store, ['path']);
  return search;
}

function canonicalizeLanceDbStorageOptions(value: ConfigRecord): ConfigRecord {
  const result = { ...value };
  if (!hasOwn(result, 'access_key')) {
    if (hasOwn(value, 'access_key_id')) result.access_key = value.access_key_id;
    else if (hasOwn(value, 'accessKeyId')) result.access_key = value.accessKeyId;
  }
  if (!hasOwn(result, 'secret_key')) {
    if (hasOwn(value, 'secret_access_key')) result.secret_key = value.secret_access_key;
    else if (hasOwn(value, 'secretAccessKey')) result.secret_key = value.secretAccessKey;
  }
  for (const key of ['access_key_id', 'accessKeyId', 'secret_access_key', 'secretAccessKey']) {
    delete result[key];
  }
  return result;
}

function sanitizeLanceDbConfig(value: ConfigRecord): ConfigRecord {
  const result = { ...value };
  const storage = isRecord(value.storageOptions)
    ? value.storageOptions
    : isRecord(value.storage_options)
      ? value.storage_options
      : null;
  if (storage) result.storageOptions = canonicalizeLanceDbStorageOptions(storage);
  delete result.storage_options;
  if (!hasOwn(result, 'dbPath') && hasOwn(value, 'db_path')) result.dbPath = value.db_path;
  delete result.db_path;
  return result;
}

export function sanitizeMemoryConfigPayload(config: ConfigRecord): ConfigRecord {
  const result = { ...config };

  for (const key of ['memorySearch', 'memory_search'] as const) {
    const value = config[key];
    if (!isRecord(value)) continue;
    result[key] = sanitizeMemorySearch(value);
  }

  if (isRecord(config.memory)) {
    const memory = withoutKeys(config.memory, ['backend', 'qmd']);
    if (isRecord(memory.search)) memory.search = sanitizeMemorySearch(memory.search);
    result.memory = memory;
  }

  for (const key of ['memoryLancedb', 'memory_lancedb'] as const) {
    if (isRecord(config[key])) result[key] = sanitizeLanceDbConfig(config[key]);
  }

  return result;
}

export function sanitizeSessionConfigPayload(config: ConfigRecord): ConfigRecord {
  const result = withoutKeys(config, [
    'agentToAgent',
    'agent_to_agent',
    'typingIntervalSeconds',
    'typing_interval_seconds',
    'writeLock',
    'write_lock',
  ]);
  if (isRecord(result.reset) && result.reset.mode === 'disabled') {
    result.reset = { ...result.reset, mode: 'none' };
  }
  return result;
}

export function sanitizeLoggingConfigPayload(config: ConfigRecord): ConfigRecord {
  const result = withoutKeys(config, ['redactSensitive', 'redact_sensitive']);
  if (result.consoleStyle === 'compact') result.consoleStyle = 'pretty';
  if (result.console_style === 'compact') result.console_style = 'pretty';
  // An explicitly present undefined file path would disappear in
  // JSON.stringify. Null is config.patch's supported delete marker.
  if (hasOwn(config, 'file') && config.file === undefined) result.file = null;
  return result;
}

export function sanitizeCanvasConfigPayload(config: ConfigRecord): ConfigRecord {
  return typeof config.enabled === 'boolean' ? { enabled: config.enabled } : {};
}

export function sanitizeUiConfigPayload(config: ConfigRecord): ConfigRecord {
  return withoutKeys(config, ['assistant']);
}
