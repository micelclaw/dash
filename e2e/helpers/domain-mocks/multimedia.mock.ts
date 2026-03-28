import type { MockRoute } from '../api-spy';

const APPS = [
  { name: 'jellyfin', display_name: 'Jellyfin', installed: true, running: false, url: null, ram_mb: null, uptime_seconds: null },
  { name: 'navidrome', display_name: 'Navidrome', installed: false, running: false, url: null, ram_mb: null, uptime_seconds: null },
  { name: 'calibreweb', display_name: 'Calibre-Web', installed: false, running: false, url: null, ram_mb: null, uptime_seconds: null },
  { name: 'audiobookshelf', display_name: 'Audiobookshelf', installed: false, running: false, url: null, ram_mb: null, uptime_seconds: null },
  { name: 'qbittorrent', display_name: 'qBittorrent', installed: false, running: false, url: null, ram_mb: null, uptime_seconds: null },
  { name: 'radarr', display_name: 'Radarr', installed: false, running: false, url: null, ram_mb: null, uptime_seconds: null },
  { name: 'sonarr', display_name: 'Sonarr', installed: false, running: false, url: null, ram_mb: null, uptime_seconds: null },
  { name: 'lidarr', display_name: 'Lidarr', installed: false, running: false, url: null, ram_mb: null, uptime_seconds: null },
  { name: 'readarr', display_name: 'Readarr', installed: false, running: false, url: null, ram_mb: null, uptime_seconds: null },
  { name: 'jackett', display_name: 'Jackett', installed: false, running: false, url: null, ram_mb: null, uptime_seconds: null },
  { name: 'jellyseerr', display_name: 'Jellyseerr', installed: false, running: false, url: null, ram_mb: null, uptime_seconds: null },
];

const SUITE_STATUS = {
  media_dirs: [],
  apps: APPS,
};

export const multimediaMocks: MockRoute[] = [
  // Status
  {
    method: 'GET',
    path: '/multimedia/status',
    response: { data: SUITE_STATUS },
  },
  // Catch-all for any POST under /multimedia/ (start, stop, install, uninstall)
  {
    method: 'POST',
    path: '/multimedia/**',
    response: { data: { status: 'ok' } },
  },
  // Autowire
  {
    method: 'POST',
    path: '/multimedia/autowire',
    response: { data: { configured: true } },
  },
];
