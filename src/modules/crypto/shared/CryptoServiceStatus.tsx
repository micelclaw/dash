interface ServiceInfo {
  installed: boolean;
  running: boolean;
  phase: string;
}

export function getDotColor(svc: ServiceInfo | undefined): string {
  if (!svc || !svc.installed) return '#ef4444';
  if (!svc.running) return '#f59e0b';
  if (svc.phase === 'syncing') return '#f59e0b';
  return '#22c55e';
}

export function getStatusLabel(svc: ServiceInfo | undefined): string {
  if (!svc || !svc.installed) return 'Not installed';
  if (!svc.running) return 'Stopped';
  if (svc.phase === 'syncing') return 'Syncing';
  return 'Running';
}
