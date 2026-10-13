import type { AgentEventBusStats } from '@/services/activity.service';

export function formatEventBusUptime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safe / 86_400);
  const hours = Math.floor((safe % 86_400) / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function eventStatsSections(stats: AgentEventBusStats) {
  return {
    sinceStart: [
      ['Uptime', formatEventBusUptime(stats.uptime_seconds)],
      ['Emits', stats.total_emits],
      ['Latency p95', `${stats.latency_ms.p95} ms`],
      ['Validation rejects', stats.validation_rejects],
      ['Top type', stats.top_types[0] ? `${stats.top_types[0].type} (${stats.top_types[0].count})` : '—'],
    ] as Array<[string, string | number]>,
    backlog: [
      ['Pending', stats.backlog.unprocessed],
      ['Older than 1h', stats.backlog.unprocessed_older_1h],
      ['Warn+ pending', stats.backlog.unprocessed_warn_plus],
    ] as Array<[string, string | number]>,
  };
}

export function shouldFetchEventStats(isOpen: boolean, hasStats: boolean): boolean {
  return isOpen && !hasStats;
}
