import { api } from './api';
import type { ProductivityTabReference } from '@/modules/chat/mcp-apps/productivity/reference';
export interface McpAppEntry { id: string; server_id: string; server_label: string; title: string; tool_name: string; type: 'global' | 'thread' | 'file' | 'settings'; resource_uri: string; extensions: string[] }
export interface McpAppDescriptor { view_id: string; title: string; server_label: string; entry_id: string; interactive: false }
export interface McpAppView { view_id: string; lease_id: string; expires_at: number; title: string; sandbox_url: string; html: string; csp: Record<string, unknown>; tool_input: unknown; tool_result: unknown; host_context: Record<string, unknown>; file_access?: { writable: boolean; reason?: string }; capabilities: { server_tools: boolean; server_resources: boolean; model_context: boolean; file_resources: boolean; open_files: boolean; message: boolean } }
export interface McpAppList { enabled: boolean; owner_only: boolean; entries: McpAppEntry[]; servers: Array<{ id: string; label: string; settings_supported: boolean; mention_supported: boolean }>; views: McpAppDescriptor[] }
export interface McpAppApproval { id: string; view_id: string; tool: string; expires_at: number; allow_while_open?: boolean }
export interface McpWorkspacePreview { agent_id: string; relative_path: string; deep_link: string; preview: { filename: string; kind: 'markdown' | 'code' | 'text' | 'image' | 'pdf' | 'html'; mime_type: string; content_url: string; size_bytes: number } | null }
const base = (conversationId: string) => `/conversations/${encodeURIComponent(conversationId)}`;
const viewPath = (conversationId: string, view: McpAppView) => `${base(conversationId)}/mcp-apps/${encodeURIComponent(view.view_id)}`;
export const mcpAppsService = {
 async status() { return (await api.get<{ data: { enabled: boolean; runtime_ready: boolean; origin_configured: boolean; connection_verified: boolean } }>('/mcp-apps/status')).data; },
 async list(conversationId: string, signal?: AbortSignal) { return (await api.get<{ data: McpAppList }>(`${base(conversationId)}/mcp-apps`, undefined, { signal })).data; },
 async launch(conversationId: string, entryId: string, fileId?: string, signal?: AbortSignal) { return (await api.post<{ data: McpAppView }>(`${base(conversationId)}/mcp-apps/${encodeURIComponent(entryId)}/view`, { action: 'launch', ...(fileId ? { file_id: fileId } : {}) }, { timeout: 95_000, signal })).data; },
 /** Core resolves this inert reference from authorized conversation history. */
 async launchProductivity(conversationId: string, reference: ProductivityTabReference, signal?: AbortSignal) {
  const catalog = await mcpAppsService.list(conversationId, signal);
  const entry = catalog.entries.find(item => item.server_id === 'claw-os' && item.type === 'global' && item.resource_uri === `ui://micelclaw/productivity/${reference.area}/v1` && item.tool_name === `micelclaw_${reference.area.toLowerCase()}_view`);
  if (!entry || catalog.owner_only) throw new Error('Esta vista todavía no está disponible con tu acceso.');
  return (await api.post<{ data: McpAppView }>(`${base(conversationId)}/mcp-apps/${encodeURIComponent(entry.id)}/view`, { action: 'launch', productivity_ref: reference.id }, { timeout: 95_000, signal })).data;
 },
 async request(conversationId: string, view: McpAppView, operation: Record<string, unknown>, signal?: AbortSignal) { return (await api.post<{ data: unknown }>(`${viewPath(conversationId, view)}/request`, { lease_id: view.lease_id, operation }, { timeout: 95_000, signal })).data; },
 async close(conversationId: string, view: McpAppView) { await api.delete(`${viewPath(conversationId, view)}?lease_id=${encodeURIComponent(view.lease_id)}`); },
 async events(conversationId: string, view: McpAppView, after: number, signal?: AbortSignal) { return (await api.get<{ data: { sequence: number; events: Array<{ sequence: number; type: 'context-changed' | 'resource-updated'; uri?: string }> } }>(`${viewPath(conversationId, view)}/events`, { lease_id: view.lease_id, after }, { signal })).data; },
 async approvals(conversationId: string, signal?: AbortSignal) { return (await api.get<{ data: McpAppApproval[] }>(`${base(conversationId)}/mcp-app-approvals`, undefined, { signal })).data; },
 async approve(conversationId: string, id: string, decision: 'once' | 'open' | 'deny') { return (await api.post<{ data: { accepted: boolean } }>(`${base(conversationId)}/mcp-app-approvals/${encodeURIComponent(id)}`, { decision })).data; },
 async settings(conversationId: string, serverId: string, signal?: AbortSignal) { return (await api.get<{ data: unknown }>(`${base(conversationId)}/mcp-app-settings/${encodeURIComponent(serverId)}`, undefined, { signal })).data; },
 async saveSettings(conversationId: string, serverId: string, set: Record<string, string | number | boolean>, signal?: AbortSignal) { return (await api.patch<{ data: unknown }>(`${base(conversationId)}/mcp-app-settings/${encodeURIComponent(serverId)}`, { set }, { timeout: 95_000, signal })).data; },
 async search(conversationId: string, serverId: string, query: string, signal?: AbortSignal) { return (await api.post<{ data: unknown }>(`${base(conversationId)}/mcp-app-search/${encodeURIComponent(serverId)}`, { query }, { signal })).data; },
};
