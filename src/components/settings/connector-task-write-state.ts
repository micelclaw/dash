export interface TaskWriteStateInput {
  domains: string[];
  task_write_supported?: boolean;
  task_write_certified?: boolean;
  task_write_enabled?: boolean;
  task_pending_change_count?: number | null;
}

export function taskWritePresentation(connector: TaskWriteStateInput) {
  if (!connector.domains.includes('tasks')) return null;

  const supported = connector.task_write_supported === true;
  const certified = connector.task_write_certified === true;
  const enabled = supported && certified && connector.task_write_enabled === true;

  const title = connector.task_write_supported === undefined
    ? 'Task write status unavailable'
    : !supported
      ? 'Task writing is not supported by this provider'
    : !certified
      ? 'Bidirectional writing is not certified · blocked'
      : enabled
        ? 'Bidirectional writing enabled for this connection'
        : 'Provider certified · writing blocked for this connection';

  const count = connector.task_pending_change_count;
  const pendingText = count === null || count === undefined
    ? 'Could not check the number of local changes waiting to sync.'
    : count === 0
      ? 'No local changes waiting to sync.'
      : `${count} local ${count === 1 ? 'change' : 'changes'} waiting to sync.`;

  return {
    title,
    pendingText,
    pendingCount: typeof count === 'number' && Number.isFinite(count) ? Math.max(0, count) : 0,
    blocked: !enabled,
    color: enabled ? '#22c55e' : 'var(--text-muted)',
  };
}
