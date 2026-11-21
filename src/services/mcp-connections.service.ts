import { api } from './api';

export interface McpTool { name: string; description?: string; ui_resource_uri?: string }
export interface McpTestReport {
  ok: boolean; status: 'verified' | 'server_responds' | 'auth_required' | 'error'; checked_at: string;
  transport: 'passed' | 'failed' | 'unverified' | 'required';
  authorization: 'passed' | 'failed' | 'unverified' | 'required';
  discovery: 'passed' | 'failed' | 'unverified' | 'required';
  functional: 'passed' | 'failed' | 'unverified' | 'required';
  tools: McpTool[]; tool_count: number; visual_interface: 'advertised' | 'none' | 'unchecked';
  functional_tool?: string; functional_reference?: string; error?: string;
  account_label?: string;
}
export interface McpCatalogItem {
  id: string; name: string; provider: string; description: string; url: string;
  transport: 'streamable-http' | 'sse'; auth_mode: 'oauth' | 'unknown';
  provider_slug?: string; documentation_url?: string; maturity?: string; preparation?: 'google-client' | 'slack-app';
  default_scope?: string;
  required_headers?: Array<{ name: string; description: string; secret: boolean }>;
}
export interface McpCatalog {
  popular: McpCatalogItem[]; results: McpCatalogItem[]; stale: boolean; refreshing: boolean;
  registry_error: boolean; updated_at: string | null;
}
export interface McpConnection {
  id: string; template_id: string | null; display_name: string; owner_type: 'personal' | 'shared';
  status: string; enabled: boolean; tool_count: number; tools: McpTool[]; provider: string | null;
  provider_slug?: string; domains: string[]; last_probe_at: string | null; last_error: string | null;
  url: string; transport: 'streamable-http' | 'sse'; auth_mode: 'oauth' | 'bearer' | 'headers' | 'none';
  has_credentials: boolean; has_oauth_client: boolean; has_oauth_client_secret: boolean; updated_at: string;
  account_label?: string | null;
  oauth_client_id?: string | null; oauth_issuer?: string | null; oauth_scope?: string | null;
  can_manage: boolean; can_test: boolean; can_grant: boolean;
  visual_interface: 'advertised' | 'none' | 'unchecked'; test_report: McpTestReport | null;
  preparation?: 'google-client' | 'slack-app'; documentation_url?: string;
  maturity?: string;
  required_headers: Array<{ name: string; description: string; secret: boolean }>;
}
export interface McpConnectionInput {
  display_name: string; url: string; transport: 'streamable-http' | 'sse';
  auth_mode: 'oauth' | 'bearer' | 'headers' | 'none'; owner_type?: 'personal' | 'shared';
  bearer_token?: string; headers?: Record<string, string>; expected_updated_at?: string;
  catalog_id?: string;
}
type Envelope<T> = { data: T };
const data = async <T>(promise: Promise<Envelope<T>>) => (await promise).data;
export const mcpConnectionsApi = {
  list: (signal?: AbortSignal) => data(api.get<Envelope<McpConnection[]>>('/mcp-connections', undefined, { signal })),
  catalog: (q = '', signal?: AbortSignal) => data(api.get<Envelope<McpCatalog>>('/mcp-connections/catalog', { q }, { signal })),
  create: (body: McpConnectionInput) => data(api.post<Envelope<McpConnection>>('/mcp-connections', body)),
  update: (id: string, body: McpConnectionInput) => data(api.patch<Envelope<McpConnection>>(`/mcp-connections/${id}`, body)),
  remove: (id: string) => data(api.delete<Envelope<{ deleted: true }>>(`/mcp-connections/${id}`)),
  test: (id: string) => data(api.post<Envelope<McpTestReport>>(`/mcp-connections/${id}/test`, undefined, { timeout: 90_000 })),
  grants: (id: string) => data(api.get<Envelope<Array<{ agent_id: string; tool_filter: string[] }>>>(`/mcp-connections/${id}/grants`)),
  grant: (id: string, agentId: string) => data(api.post<Envelope<{ session_reset_required: boolean }>>(`/mcp-connections/${id}/grants`, { agent_id: agentId })),
  revoke: (id: string, agentId: string) => data(api.delete<Envelope<{ session_reset_required: boolean }>>(`/mcp-connections/${id}/grants/${agentId}`)),
  userGrant: (id: string) => data(api.post<Envelope<unknown>>(`/mcp-connections/${id}/user-grant`)),
  system: (signal?: AbortSignal) => data(api.get<Envelope<{ id: 'system:claw-os'; name: 'Micelclaw'; tools: McpTool[]; tool_count: number; enabled: boolean }>>('/mcp-connections/system', undefined, { signal })),
  systemTest: () => data(api.post<Envelope<McpTestReport>>('/mcp-connections/system/test', undefined, { timeout: 60_000 })),
  authorize: (id: string, input: { expected_updated_at: string; session_key: string; redirect_url: string; client_id?: string; client_secret?: string; issuer?: string; scope?: string }) => data(api.post<Envelope<{ authorization_url: string; state: string; expires_at: string }>>(`/mcp-connections/${id}/oauth/start`, input, { timeout: 60_000 })),
  complete: (body: { state: string; session_key: string; code?: string; error?: string }) => data(api.post<Envelope<{ connection_id: string; authorized: boolean }>>('/mcp-connections/oauth/complete', body, { timeout: 60_000 })),
};
