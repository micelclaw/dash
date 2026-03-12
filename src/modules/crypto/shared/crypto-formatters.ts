// Shared formatting utilities for crypto dashboard cards

export function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
  return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
}

export function formatHashRate(hps: number): string {
  if (hps >= 1e18) return `${(hps / 1e18).toFixed(1)} EH/s`;
  if (hps >= 1e15) return `${(hps / 1e15).toFixed(1)} PH/s`;
  if (hps >= 1e12) return `${(hps / 1e12).toFixed(1)} TH/s`;
  if (hps >= 1e9) return `${(hps / 1e9).toFixed(1)} GH/s`;
  if (hps >= 1e6) return `${(hps / 1e6).toFixed(1)} MH/s`;
  return `${hps.toFixed(0)} H/s`;
}

export function formatDifficulty(d: number): string {
  if (d >= 1e12) return `${(d / 1e12).toFixed(2)} T`;
  if (d >= 1e9) return `${(d / 1e9).toFixed(2)} G`;
  if (d >= 1e6) return `${(d / 1e6).toFixed(2)} M`;
  if (d >= 1e3) return `${(d / 1e3).toFixed(2)} K`;
  return d.toFixed(2);
}

export function formatSatVB(fee: number | null): string {
  if (fee == null) return 'N/A';
  return `~${fee} sat/vB`;
}

export function formatRelativeTime(unixTs: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixTs;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatTraffic(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function formatUptime(s: number | null): string {
  if (!s) return '-';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const h = Math.floor(s / 3600);
  return `${h}h`;
}

export function formatEta(seconds: number | null): string {
  if (!seconds) return '';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function truncateId(id: string, chars = 8): string {
  if (id.length <= chars * 2 + 3) return id;
  return `${id.slice(0, chars)}...${id.slice(-chars)}`;
}

export function formatMsat(msat: number): string {
  const sats = Math.round(msat / 1000);
  return `${sats.toLocaleString()} sat`;
}

export function formatXmr(piconero: number): string {
  const xmr = piconero / 1e12;
  if (xmr >= 1) return `${xmr.toFixed(4)} XMR`;
  if (xmr >= 0.001) return `${xmr.toFixed(6)} XMR`;
  return `${piconero.toLocaleString()} pico`;
}

export function formatMoneroVersion(v: string): string {
  return v || 'unknown';
}
