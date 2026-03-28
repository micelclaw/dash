import type { MockRoute } from '../api-spy';

export const financeMocks: MockRoute[] = [
  // Finance suite status
  {
    method: 'GET',
    path: '/finance/status',
    response: {
      data: {
        firefly: { installed: true, running: false },
        solidinvoice: { installed: false, running: false },
      },
    },
  },
  // Start a finance service
  {
    method: 'POST',
    path: '/finance/**/start',
    response: { data: { status: 'starting' } },
  },
];
