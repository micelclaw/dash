import type { MockRoute } from '../api-spy';

const APPROVAL_PENDING = {
  id: 'approval-1',
  type: 'command',
  description: 'Run deploy script',
  status: 'pending',
  created_at: '2026-03-26T09:00:00Z',
};

export const APPROVALS_LIST = [APPROVAL_PENDING];

export const securityMocks: MockRoute[] = [
  // List approvals
  {
    method: 'GET',
    path: '/approvals',
    response: { data: APPROVALS_LIST, meta: { total: 1 } },
  },
  // Approve a request
  {
    method: 'POST',
    path: '/approvals/**/approve',
    response: { data: { status: 'approved' } },
  },
  // Reject a request
  {
    method: 'POST',
    path: '/approvals/**/reject',
    response: { data: { status: 'rejected' } },
  },
  // Set up PIN
  {
    method: 'POST',
    path: '/auth/pin',
    response: { data: { set: true } },
  },
  // Remove PIN
  {
    method: 'DELETE',
    path: '/auth/pin',
    response: null,
    status: 204,
  },
];
