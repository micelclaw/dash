import type { MockRoute } from '../api-spy';

const CRON_1 = {
  id: 'cron-1',
  name: 'daily-digest',
  schedule: '0 8 * * *',
  enabled: true,
};

export const CRON_LIST = [CRON_1];

export const gatewayMocks: MockRoute[] = [
  // List cron jobs
  {
    method: 'GET',
    path: '/gateway/cron',
    response: { data: CRON_LIST, meta: { total: 1 } },
  },
  // Update cron job
  {
    method: 'PATCH',
    path: '/gateway/cron/*',
    response: { data: { ...CRON_1, updated_at: new Date().toISOString() } },
  },
];
