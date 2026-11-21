import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useChatWorkspaceStore as store, MAX_WORKSPACE_TABS } from './chat-workspace.store';
import type { WorkspaceResource } from './chat-workspace.store';
import type { McpAppView } from '@/services/mcp-apps.service';

const data = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => data.delete(key) } });
const owner = randomUUID(); const chat = randomUUID();
const view: McpAppView = { view_id: 'synthetic', lease_id: 'synthetic-live-lease', expires_at: 100, title: 'Notas', sandbox_url: 'https://sandbox.invalid/mcp-app-sandbox', html: 'SYNTHETIC-PRIVATE-HTML', csp: {}, tool_input: {}, tool_result: {}, host_context: {}, capabilities: { server_tools: false, server_resources: false, model_context: false, file_resources: false, open_files: false, message: false } };
function resource(index = 0, erp = false): Extract<WorkspaceResource, { kind: 'productivity' }> {
 const area = erp ? 'F1' : 'notes'; const id = `productivity:${area}:${index.toString(16).padStart(32, '0')}`;
 return { id, kind: 'productivity', title: erp ? 'Resumen personal' : 'Notas', sourceConversationId: chat, view,
  reference: { version: 'micelclaw-productivity-preview/v1', id: randomUUID(), conversation_id: chat, area, title: 'Notas', resource_id: id, erp_profile_id: erp ? randomUUID() : null } };
}
const workspace = () => store.getState().byConversation[chat]!;
beforeEach(() => { data.clear(); store.setState({ owner, generation: 1, byConversation: {} }); });
test('productivity tabs deduplicate updates and persist only inert lookup references', () => {
 const first = resource(); store.getState().upsert(chat, first, true);
 store.getState().upsert(chat, { ...first, reference: { ...first.reference, id: randomUUID() } });
 assert.equal(workspace().openIds.length, 1);
 const persisted = [...data.values()].join(''); assert.equal(persisted.includes('SYNTHETIC-PRIVATE-HTML'), false); assert.equal(persisted.includes('synthetic-live-lease'), false);
 store.setState({ byConversation: {} }); store.getState().ensure(chat);
 const restored = workspace().resources[first.id]!; assert.equal(restored.kind, 'productivity'); if (restored.kind === 'productivity') assert.equal(restored.view, null);
});
test('closing/reopening never revives a lease and the eight-tab limit is preserved', () => {
 for (let index = 0; index < MAX_WORKSPACE_TABS + 1; index++) store.getState().upsert(chat, resource(index), true);
 assert.equal(workspace().openIds.length, MAX_WORKSPACE_TABS);
 const id = workspace().openIds[0]!; store.getState().close(chat, id); store.getState().open(chat, id);
 const reopened = workspace().resources[id]!; if (reopened.kind === 'productivity') assert.equal(reopened.view, null); else assert.fail('Expected productivity reference');
});
test('ERP changes clear live views; conversation revocation rejects late results', () => {
 const finance = resource(0, true); const notes = resource(1); store.getState().upsert(chat, finance, true); store.getState().upsert(chat, notes, true);
 store.getState().invalidateProductivityProfiles();
 const cleared = workspace().resources[finance.id]!; if (cleared.kind === 'productivity') assert.equal(cleared.view, null);
 const ordinary = workspace().resources[notes.id]!; if (ordinary.kind === 'productivity') assert.equal(ordinary.view, view);
 store.getState().revokeSource(chat); assert.equal(store.getState().upsert(chat, finance, true), false); assert.deepEqual(workspace().resources, {});
});
test('another owner or conversation cannot restore the stored lookup reference', () => {
 const first = resource(); store.getState().upsert(chat, first, true);
 store.setState({ owner: randomUUID(), byConversation: {} }); store.getState().ensure(chat); assert.deepEqual(workspace().resources, {});
 store.setState({ owner, byConversation: {} }); const other = randomUUID();
 data.set(`micelclaw.chat-workspace.v1.${owner}.${other}`, JSON.stringify({ version: 1, resources: [{ ...first, sourceConversationId: other }] }));
 store.getState().ensure(other); assert.deepEqual(store.getState().byConversation[other]!.resources, {});
});
