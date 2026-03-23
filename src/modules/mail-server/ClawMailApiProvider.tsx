import type { ReactNode } from 'react';
import { MailServerApiContext, type MailServerApi } from '@micelclaw/mail-admin-ui';
import { api } from '@/services/api';

const PREFIX = '/mail/server';

const clawMailApi: MailServerApi = {
  // Domains
  getDomains: () => api.get<{ data: any }>(`${PREFIX}/domains`).then((r) => r.data),
  createDomain: (data) => api.post<{ data: any }>(`${PREFIX}/domains`, data).then((r) => r.data),
  getDomain: (domain) => api.get<{ data: any }>(`${PREFIX}/domains/${domain}`).then((r) => r.data),
  updateDomain: (domain, data) => api.patch<{ data: any }>(`${PREFIX}/domains/${domain}`, data).then((r) => r.data),
  deleteDomain: (domain) => api.delete(`${PREFIX}/domains/${domain}`),
  generateDkim: (domain) => api.post(`${PREFIX}/domains/${domain}/generate-dkim`),

  // Users
  getUsers: () => api.get<{ data: any }>(`${PREFIX}/users`).then((r) => r.data),
  createUser: (data) => api.post<{ data: any }>(`${PREFIX}/users`, data).then((r) => r.data),
  getUser: (email) => api.get<{ data: any }>(`${PREFIX}/users/${encodeURIComponent(email)}`).then((r) => r.data),
  updateUser: (email, data) => api.patch<{ data: any }>(`${PREFIX}/users/${encodeURIComponent(email)}`, data).then((r) => r.data),
  deleteUser: (email) => api.delete(`${PREFIX}/users/${encodeURIComponent(email)}`),

  // Aliases
  getAliases: () => api.get<{ data: any }>(`${PREFIX}/aliases`).then((r) => r.data),
  createAlias: (data) => api.post<{ data: any }>(`${PREFIX}/aliases`, data).then((r) => r.data),
  getAlias: (alias) => api.get<{ data: any }>(`${PREFIX}/aliases/${encodeURIComponent(alias)}`).then((r) => r.data),
  updateAlias: (alias, data) => api.put<{ data: any }>(`${PREFIX}/aliases/${encodeURIComponent(alias)}`, data).then((r) => r.data),
  deleteAlias: (alias) => api.delete(`${PREFIX}/aliases/${encodeURIComponent(alias)}`),

  // Relays
  getRelays: () => api.get<{ data: any }>(`${PREFIX}/relayed-domains`).then((r) => r.data),
  createRelay: (data) => api.post<{ data: any }>(`${PREFIX}/relayed-domains`, data).then((r) => r.data),
  updateRelay: (name, data) => api.put<{ data: any }>(`${PREFIX}/relayed-domains/${encodeURIComponent(name)}`, data).then((r) => r.data),
  deleteRelay: (name) => api.delete(`${PREFIX}/relayed-domains/${encodeURIComponent(name)}`),

  // Alternatives
  getAlternatives: () => api.get<{ data: any }>(`${PREFIX}/alternatives`).then((r) => r.data),
  createAlternative: (data) => api.post<{ data: any }>(`${PREFIX}/alternatives`, data).then((r) => r.data),
  deleteAlternative: (alt) => api.delete(`${PREFIX}/alternatives/${encodeURIComponent(alt)}`),

  // Tokens
  getTokens: () => api.get<{ data: any }>(`${PREFIX}/tokens`).then((r) => r.data),
  createToken: (data) => api.post<{ data: any }>(`${PREFIX}/tokens`, data).then((r) => r.data),
  deleteToken: (id) => api.delete(`${PREFIX}/tokens/${id}`),

  // Status
  getStatus: () => api.get<{ data: any }>(`${PREFIX}/status`).then((r) => r.data),

  // Broadcasts
  sendBroadcast: (subject, body) => api.post<{ data: any }>(`${PREFIX}/broadcasts`, { subject, body }).then((r) => r.data),

  // Client Setup
  getClientSetup: () => api.get<{ data: any }>(`${PREFIX}/client-setup`).then((r) => r.data),

  // === ADVANCED ===

  // DNS
  getDnsCheck: () => api.get<{ data: any }>(`${PREFIX}/dns-check`).then((r) => r.data),
  forceDnsCheck: () => api.post<{ data: any }>(`${PREFIX}/dns-check`).then((r) => r.data),

  // Queue
  getQueue: () => api.get<{ data: any }>(`${PREFIX}/queue`).then((r) => r.data),
  flushQueue: () => api.post(`${PREFIX}/queue/flush`),
  deleteQueueMessage: (id) => api.delete(`${PREFIX}/queue/${id}`),
  deleteAllQueue: () => api.delete(`${PREFIX}/queue`),
  holdMessage: (id) => api.post(`${PREFIX}/queue/${id}/hold`),
  releaseMessage: (id) => api.post(`${PREFIX}/queue/${id}/release`),

  // Rspamd
  getRspamdStats: () => api.get<{ data: any }>(`${PREFIX}/security/stats`).then((r) => r.data),
  getRspamdHistory: (limit) => api.get<{ data: any }>(`${PREFIX}/security/history`, limit ? { limit } : undefined).then((r) => r.data),
  learnSpam: (messageId) => api.post(`${PREFIX}/security/learn-spam`, { message_id: messageId }),
  learnHam: (messageId) => api.post(`${PREFIX}/security/learn-ham`, { message_id: messageId }),

  // Block/Allow
  getBlockAllowLists: () => api.get<{ data: any }>(`${PREFIX}/security/lists`).then((r) => r.data),
  addBlockAllowEntry: (entry) => api.post<{ data: any }>(`${PREFIX}/security/lists`, entry).then((r) => r.data),
  removeBlockAllowEntry: (id) => api.delete(`${PREFIX}/security/lists/${id}`),

  // Monitoring
  getMonitoringOverview: () => api.get<{ data: any }>(`${PREFIX}/monitoring`).then((r) => r.data),

  // Relay
  getRelayConfig: () => api.get<{ data: any }>(`${PREFIX}/relay`).then((r) => r.data),
  updateRelayConfig: (config) => api.put<{ data: any }>(`${PREFIX}/relay`, config).then((r) => r.data),
  testRelay: () => api.post<{ data: any }>(`${PREFIX}/relay/test`).then((r) => r.data),

  // Test email
  sendTestEmail: (to) => api.post<{ data: any }>(`${PREFIX}/test-email`, { email: to }).then((r) => r.data),
};

export function ClawMailApiProvider({ children }: { children: ReactNode }) {
  return (
    <MailServerApiContext.Provider value={clawMailApi}>
      {children}
    </MailServerApiContext.Provider>
  );
}
