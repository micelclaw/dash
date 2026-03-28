import type { MockRoute } from '../api-spy';

const POOL_1 = {
  id: 'pool-1',
  name: 'main',
  path: '/data',
  total_bytes: 1099511627776,
  used_bytes: 549755813888,
  provider: 'local',
};

const SHARE_1 = {
  id: 'share-1',
  name: 'public',
  pool_id: 'pool-1',
  path: '/data/public',
  protocol: 'smb',
};

export const storageMocks: MockRoute[] = [
  // Storage status
  {
    method: 'GET',
    path: '/hal/storage/status',
    response: { data: { healthy: true } },
  },
  // Storage capabilities
  {
    method: 'GET',
    path: '/hal/storage/capabilities',
    response: { data: { pools: true, shares: true, smart: true } },
  },
  // List disks
  {
    method: 'GET',
    path: '/hal/storage/disks',
    response: { data: [], meta: { total: 0 } },
  },
  // List volumes
  {
    method: 'GET',
    path: '/hal/storage/volumes',
    response: { data: [], meta: { total: 0 } },
  },
  // Data usage
  {
    method: 'GET',
    path: '/hal/storage/data-usage',
    response: { data: { total: 1099511627776, used: 549755813888 } },
  },
  // List pools
  {
    method: 'GET',
    path: '/hal/storage/pools',
    response: { data: [POOL_1], meta: { total: 1 } },
  },
  // List shares
  {
    method: 'GET',
    path: '/hal/storage/shares',
    response: { data: [SHARE_1], meta: { total: 1 } },
  },
  // Create pool
  {
    method: 'POST',
    path: '/hal/storage/pools',
    response: {
      data: {
        id: 'pool-new',
        name: 'new-pool',
        path: '/data/new',
        total_bytes: 0,
        used_bytes: 0,
        provider: 'local',
      },
    },
  },
  // Create share
  {
    method: 'POST',
    path: '/hal/storage/shares',
    response: {
      data: {
        id: 'share-new',
        name: 'new-share',
        pool_id: 'pool-1',
        path: '/data/new-share',
        protocol: 'smb',
      },
    },
  },
  // Detect provider
  {
    method: 'POST',
    path: '/hal/storage/detect-provider',
    response: { data: { provider: 'local', features: ['smb', 'nfs'] } },
  },
  // Delete pool
  {
    method: 'DELETE',
    path: '/hal/storage/pools/*',
    status: 204,
    response: null,
  },
  // Delete share
  {
    method: 'DELETE',
    path: '/hal/storage/shares/*',
    status: 204,
    response: null,
  },

  // ─── File Stats ────────────────────────────────────────────
  {
    method: 'GET',
    path: '/files/stats',
    response: {
      data: {
        total_files: 1234,
        total_directories: 56,
        total_size: 5368709120,
        mime_distribution: { 'image/jpeg': 400, 'application/pdf': 200, 'text/plain': 100 },
        duplicates_count: 12,
      },
    },
  },
  {
    method: 'GET',
    path: '/files/snapshots/stats',
    response: {
      data: {
        count: 89,
        files_with_snapshots: 34,
        total_snapshot_size: 1073741824,
      },
    },
  },

  // ─── File Duplicates ───────────────────────────────────────
  {
    method: 'GET',
    path: '/files/duplicates',
    response: {
      data: [
        {
          checksum: 'abc123',
          size_bytes: 1048576,
          files: [
            { id: 'f1', filename: 'photo.jpg', filepath: '/photos/photo.jpg', size_bytes: 1048576, updated_at: '2026-03-20T00:00:00Z' },
            { id: 'f2', filename: 'photo_copy.jpg', filepath: '/backup/photo_copy.jpg', size_bytes: 1048576, updated_at: '2026-03-19T00:00:00Z' },
          ],
        },
      ],
    },
  },
];
